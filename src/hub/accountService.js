'use strict';

const crypto = require('node:crypto');
const net = require('node:net');
const { encryptCredential, decryptCredential } = require('./accountCrypto');
const { LIMIT_PROVIDER_IDS } = require('../shared/limitProviders');
const { normalizeLimitProvider, normalizeLimitsSummary } = require('../shared/limits');
const { HUB_MANUAL_PROVIDER_IDS } = require('../shared/limitProviderSources');
const { probeLimitProvider } = require('../shared/limitCollector');
const { createMimoManagedAccount } = require('../shared/mimoLimits');
const { normalizeThirdPartyBaseUrl } = require('../shared/thirdPartyLimits');

const MAX_ACCOUNT_NAME_LENGTH = 128;
const MAX_ACCOUNT_LABEL_LENGTH = 256;
const MAX_CREDENTIAL_BYTES = 128 * 1024;
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;
const DEFAULT_CONCURRENCY = 4;

// These providers already accept an explicit API key, Cookie, or profile. The
// remaining providers currently depend on a local CLI, browser profile, or OS
// credential store and must not silently fall back to those sources on the Hub.
const HUB_MANUAL_PROVIDERS = HUB_MANUAL_PROVIDER_IDS;

function cleanText(value, maxLength = 512) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function accountId(value) {
  const text = cleanText(value, 128);
  return text || crypto.randomUUID();
}

function providerId(value) {
  const provider = cleanText(value, 64).toLowerCase();
  if (!LIMIT_PROVIDER_IDS.includes(provider)) {
    const error = new Error('Unsupported limit provider');
    error.code = 'provider_unsupported';
    throw error;
  }
  if (!HUB_MANUAL_PROVIDERS.has(provider)) {
    const error = new Error(`Provider ${provider} has no Hub-side manual login adapter yet`);
    error.code = 'provider_manual_login_unavailable';
    throw error;
  }
  return provider;
}

function credentialObject(input) {
  let value = input;
  if (typeof value === 'string') value = { value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('credential must be an object or string');
    error.code = 'credential_required';
    throw error;
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CREDENTIAL_BYTES) {
    const error = new Error('credential is too large');
    error.code = 'credential_too_large';
    throw error;
  }
  return value;
}

function field(credential, ...names) {
  for (const name of names) {
    if (credential[name] !== undefined && credential[name] !== null) return credential[name];
    if (credential.fields && credential.fields[name] !== undefined && credential.fields[name] !== null) {
      return credential.fields[name];
    }
  }
  return '';
}

function ipv4IsNonPublic(hostname) {
  const octets = hostname.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51)
    || (first === 203 && second === 0 && octets[2] === 113)
    || first >= 224;
}

function hostnameIsNonPublic(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!normalized) return true;
  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) return ipv4IsNonPublic(normalized);
  if (ipVersion === 6) {
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice('::ffff:'.length);
      if (net.isIP(mapped) === 4) return ipv4IsNonPublic(mapped);
    }
    return normalized === '::'
      || normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || /^fe[89ab]/u.test(normalized)
      || normalized.startsWith('ff');
  }
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized.endsWith('.lan')
    || normalized === 'metadata.google.internal'
    || normalized === 'instance-data.ec2.internal';
}

function validateHubThirdPartyCredential(credential) {
  const profile = credential?.profile && typeof credential.profile === 'object'
    ? credential.profile
    : credential;
  const normalized = normalizeThirdPartyBaseUrl(profile?.baseUrl, {
    stripTerminalV1: profile?.adapter !== 'custom'
  });
  let parsed;
  try { parsed = new URL(normalized); } catch (_) { parsed = null; }
  if (!parsed || parsed.protocol !== 'https:' || hostnameIsNonPublic(parsed.hostname)) {
    const error = new Error('Hub third-party accounts require an HTTPS public endpoint');
    error.code = 'credential_invalid';
    throw error;
  }
}

function profileName(account) {
  return cleanText(account.name || account.label || account.id || 'hub-account', 128) || 'hub-account';
}

function providerOptions(account, credential) {
  const name = profileName(account);
  const cookie = field(credential, 'cookie', 'cookieHeader', 'value');
  const apiKey = field(credential, 'apiKey', 'key', 'value');
  const accessToken = field(credential, 'accessToken', 'token', 'value');
  const options = {
    limitProviders: account.provider,
    limitProviderAuthority: 'hub',
    limitProviderAutoDetectDisabled: account.provider,
    suppressAutoDetectedAccounts: true,
    opencodeAmbientEnabled: false,
    opencodeLocalLimitsEnabled: false
  };
  switch (account.provider) {
    case 'claude': return { ...options, claudeWebCookie: cookie };
    case 'codex': {
      const authJson = credential.authJson || (credential.tokens ? credential : null);
      const codexAccessToken = accessToken || field(credential, 'access_token');
      const codexAccountId = field(credential, 'account_id', 'accountId');
      return {
        ...options,
        codexAuthJson: authJson,
        codexAccessToken,
        codexAccountId,
        codexAccountLabel: cleanText(account.label, MAX_ACCOUNT_LABEL_LENGTH)
      };
    }
    case 'antigravity': {
      const antigravityEndpoint = field(credential, 'endpoint', 'url') || 'http://127.0.0.1:0';
      const antigravityCsrfToken = field(credential, 'csrfToken', 'token', 'csrf');
      return {
        ...options,
        antigravityEndpoint,
        antigravityCsrfToken
      };
    }
    case 'opencode':
      return {
        ...options,
        opencodeCookie: field(credential, 'cookie', 'cookieHeader'),
        opencodeProfiles: {
          [name]: {
            cookie: field(credential, 'cookie', 'cookieHeader'),
            apiKey: field(credential, 'apiKey', 'key'),
            enabled: true
          }
        }
      };
    case 'openrouter':
      return { ...options, openrouterProfiles: { [name]: { apiKey, enabled: true } } };
    case 'deepseek': return { ...options, deepseekApiKey: apiKey };
    case 'minimax': return { ...options, minimaxApiKey: apiKey };
    case 'mimo': {
      const created = createMimoManagedAccount(cookie, []);
      if (!created.ok) {
        const error = new Error('Invalid MiMo credential');
        error.code = 'credential_invalid';
        throw error;
      }
      return {
        ...options,
        mimoManagedAccounts: [{
          ...created.account,
          id: account.id,
          accountLabel: cleanText(account.label, MAX_ACCOUNT_LABEL_LENGTH)
        }]
      };
    }
    case 'copilot': return { ...options, copilotApiToken: accessToken, copilotEnterpriseHost: field(credential, 'enterpriseHost', 'host') };
    case 'zai': return { ...options, zaiApiKey: apiKey, zaiApiRegion: field(credential, 'region') || 'global' };
    case 'zaiteam':
      return {
        ...options,
        zaiTeamApiKey: apiKey,
        zaiTeamOrganizationId: field(credential, 'organizationId', 'organization'),
        zaiTeamProjectId: field(credential, 'projectId', 'project')
      };
    case 'volcengine':
      return {
        ...options,
        volcengineAccessKeyId: field(credential, 'accessKeyId', 'accessKey'),
        volcengineSecretAccessKey: field(credential, 'secretAccessKey', 'secret'),
        volcengineApiKey: apiKey,
        volcengineRegion: field(credential, 'region')
      };
    case 'qoder':
      return { ...options, qoderCookie: cookie, qoderSite: field(credential, 'site') || 'global', qoderCookieMode: 'manual' };
    case 'commandcode': return { ...options, commandcodeCookie: cookie };
    case 'ollama': return { ...options, ollamaCookie: cookie };
    case 'kimi': return { ...options, kimiApiKey: apiKey, kimiWebAccessToken: accessToken };
    case 'thirdparty': {
      const profile = credential.profile && typeof credential.profile === 'object'
        ? credential.profile
        : credential;
      return { ...options, thirdPartyProfiles: { [name]: { ...profile, enabled: true } } };
    }
    default: return options;
  }
}

function publicAccount(account, snapshot = null) {
  const current = snapshot?.provider || null;
  return {
    id: account.id,
    provider: account.provider,
    name: account.name,
    label: account.label,
    accountKey: account.accountKey || current?.accountKey || '',
    accountEmail: account.accountEmail || current?.accountEmail || '',
    accountLabel: account.accountLabel || current?.accountLabel || '',
    enabled: account.enabled !== false,
    status: account.status || current?.status || 'notConfigured',
    lastErrorCode: account.lastErrorCode || '',
    lastErrorMessage: account.lastErrorMessage || '',
    lastAttemptAt: account.lastAttemptAt || null,
    lastSuccessAt: account.lastSuccessAt || null,
    nextRefreshAt: account.nextRefreshAt || null,
    createdAt: account.createdAt || null,
    updatedAt: account.updatedAt || null,
    limits: current
  };
}

function statusFromError(error) {
  const status = cleanText(error?.status || error?.code, 64);
  return ['unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'notConfigured'].includes(status)
    ? status
    : 'error';
}

function errorMessage(error) {
  return cleanText(error?.message || 'limit refresh failed', 512)
    .replace(/cookie|token|secret|api[_ -]?key|authorization/gi, '[redacted]');
}

function rowsFromProbe(result) {
  return (Array.isArray(result) ? result : [result])
    .filter(Boolean)
    .map((row) => normalizeLimitProvider(row));
}

function createHubAccountService({
  store,
  credentialKey,
  refreshMs = DEFAULT_REFRESH_MS,
  concurrency = DEFAULT_CONCURRENCY,
  probe = probeLimitProvider,
  logger = console,
  onUpdate = null,
  now = Date.now
} = {}) {
  if (!store || typeof store.listHubAccounts !== 'function') {
    throw new TypeError('Hub account repository methods are required');
  }
  const intervalMs = Number.isFinite(Number(refreshMs)) && Number(refreshMs) > 0
    ? Number(refreshMs)
    : DEFAULT_REFRESH_MS;
  const maxConcurrency = Math.max(1, Math.min(32, Number(concurrency) || DEFAULT_CONCURRENCY));
  let timer = null;
  let stopped = false;
  let refreshPromise = null;

  async function runTransaction(work) {
    if (typeof store.transaction === 'function') return store.transaction(work);
    return work(store);
  }

  async function accountWithSnapshot(id) {
    const account = await store.getHubAccount(id);
    if (!account) return null;
    const snapshot = typeof store.getHubAccountSnapshot === 'function'
      ? await store.getHubAccountSnapshot(id)
      : null;
    return { account, snapshot };
  }

  async function listAccounts() {
    const accounts = await store.listHubAccounts();
    const result = [];
    for (const account of accounts) {
      const snapshot = typeof store.getHubAccountSnapshot === 'function'
        ? await store.getHubAccountSnapshot(account.id)
        : null;
      result.push(publicAccount(account, snapshot));
    }
    return result;
  }

  async function getLimitsSummary() {
    const accounts = await store.listHubAccounts();
    const providers = [];
    for (const account of accounts) {
      const snapshot = typeof store.getHubAccountSnapshot === 'function'
        ? await store.getHubAccountSnapshot(account.id)
        : null;
      if (snapshot?.provider) providers.push({ ...snapshot.provider, authority: 'hub', accountId: account.id });
    }
    return normalizeLimitsSummary({
      updatedAt: new Date(now()).toISOString(),
      refreshMs: intervalMs,
      providers
    });
  }

  async function probeAccount(account, credential) {
    if (account.provider === 'thirdparty') validateHubThirdPartyCredential(credential);
    const options = providerOptions(account, credential);
    const result = await probe(account.provider, options, {}, {
      env: Object.create(null),
      homeDir: '',
      platform: 'linux'
    });
    const rows = rowsFromProbe(result);
    const usable = rows.find((row) => row.status === 'ok') || rows[0];
    if (!usable || usable.status !== 'ok') {
      const error = new Error(`Provider validation failed: ${usable?.status || 'unavailable'}`);
      error.code = usable?.status || 'unavailable';
      error.providerRow = usable || null;
      throw error;
    }
    return usable;
  }

  async function refreshOne(id, reason = 'manual') {
    const entry = await accountWithSnapshot(id);
    if (!entry) return null;
    const { account, snapshot } = entry;
    const attemptAt = new Date(now()).toISOString();
    if (account.enabled === false) {
      const disabled = normalizeLimitProvider({
        ...(snapshot?.provider || {}),
        provider: account.provider,
        status: 'disabled',
        updatedAt: attemptAt,
        windows: []
      });
      await runTransaction(async (executor) => {
        await store.updateHubAccount(account.id, {
          status: 'disabled',
          lastAttemptAt: attemptAt,
          nextRefreshAt: new Date(now() + intervalMs).toISOString()
        }, executor);
        await store.saveHubAccountSnapshot(account.id, {
          provider: disabled,
          lastGood: snapshot?.lastGood || null,
          updatedAt: attemptAt
        }, executor);
      });
      return disabled;
    }
    await store.updateHubAccount(account.id, {
      status: 'refreshing',
      lastAttemptAt: attemptAt,
      lastErrorCode: '',
      lastErrorMessage: ''
    });
    try {
      const credentialEnvelope = await store.getHubAccountCredential(account.id);
      const credential = decryptCredential(credentialEnvelope, credentialKey);
      const row = await probeAccount(account, credential);
      await runTransaction(async (executor) => {
        await store.updateHubAccount(account.id, {
          accountKey: row.accountKey || account.accountKey || '',
          accountEmail: row.accountEmail || account.accountEmail || '',
          accountLabel: row.accountLabel || account.accountLabel || '',
          status: 'ok',
          lastAttemptAt: attemptAt,
          lastSuccessAt: attemptAt,
          lastErrorCode: '',
          lastErrorMessage: '',
          nextRefreshAt: new Date(now() + intervalMs).toISOString()
        }, executor);
        await store.saveHubAccountSnapshot(account.id, {
          provider: row,
          lastGood: row,
          updatedAt: attemptAt
        }, executor);
      });
      await onUpdate?.({ type: 'account-refresh', accountId: account.id, reason });
      return row;
    } catch (error) {
      const status = statusFromError(error);
      const previous = snapshot?.lastGood || snapshot?.provider || null;
      const failed = normalizeLimitProvider({
        ...(previous || {}),
        provider: account.provider,
        accountKey: account.accountKey || previous?.accountKey || '',
        accountEmail: account.accountEmail || previous?.accountEmail || '',
        accountLabel: account.accountLabel || previous?.accountLabel || '',
        status,
        updatedAt: attemptAt,
        stale: Boolean(previous),
        windows: previous?.windows || []
      });
      await runTransaction(async (executor) => {
        await store.updateHubAccount(account.id, {
          status,
          lastAttemptAt: attemptAt,
          lastErrorCode: cleanText(error?.code || status, 64),
          lastErrorMessage: errorMessage(error),
          nextRefreshAt: new Date(now() + intervalMs).toISOString()
        }, executor);
        await store.saveHubAccountSnapshot(account.id, {
          provider: failed,
          lastGood: previous,
          updatedAt: attemptAt
        }, executor);
      });
      logger.warn?.(`[hub-accounts] ${account.provider}/${account.id} refresh failed (${status})`);
      await onUpdate?.({ type: 'account-refresh-failed', accountId: account.id, reason });
      return failed;
    }
  }

  async function refreshAll(reason = 'interval') {
    if (stopped) return [];
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const accounts = await store.listHubAccounts();
      const results = [];
      let cursor = 0;
      async function worker() {
        for (;;) {
          const index = cursor;
          cursor += 1;
          if (index >= accounts.length) return;
          const account = accounts[index];
          try { results[index] = await refreshOne(account.id, reason); }
          catch (error) { logger.warn?.(`[hub-accounts] refresh crashed: ${error.message}`); }
        }
      }
      await Promise.all(Array.from({ length: Math.min(maxConcurrency, accounts.length) }, () => worker()));
      return results.filter(Boolean);
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  async function addAccount({ provider, name = '', label = '', credential }) {
    const normalizedProvider = providerId(provider);
    const normalizedCredential = credentialObject(credential);
    const id = accountId();
    const account = {
      id,
      provider: normalizedProvider,
      name: cleanText(name, MAX_ACCOUNT_NAME_LENGTH) || `${normalizedProvider}-${id.slice(0, 8)}`,
      label: cleanText(label, MAX_ACCOUNT_LABEL_LENGTH),
      accountKey: '',
      accountEmail: '',
      accountLabel: '',
      enabled: true,
      status: 'pending',
      createdAt: new Date(now()).toISOString(),
      updatedAt: new Date(now()).toISOString()
    };
    const row = await probeAccount(account, normalizedCredential);
    const duplicate = typeof store.findHubAccount === 'function'
      ? await store.findHubAccount(normalizedProvider, row.accountKey || '', row.accountEmail || '')
      : null;
    if (duplicate) {
      const error = new Error('This provider account is already registered');
      error.code = 'account_duplicate';
      throw error;
    }
    const envelope = encryptCredential(normalizedCredential, credentialKey);
    account.accountKey = row.accountKey || '';
    account.accountEmail = row.accountEmail || '';
    account.accountLabel = row.accountLabel || '';
    account.status = 'ok';
    account.lastAttemptAt = account.createdAt;
    account.lastSuccessAt = account.createdAt;
    account.nextRefreshAt = new Date(now() + intervalMs).toISOString();
    await runTransaction((executor) => store.createHubAccount(
      account,
      envelope,
      { provider: row, lastGood: row, updatedAt: account.createdAt },
      executor
    ));
    await onUpdate?.({ type: 'account-added', accountId: id });
    return publicAccount(account, { provider: row });
  }

  async function updateAccount(id, patch = {}) {
    const entry = await accountWithSnapshot(id);
    if (!entry) return null;
    const next = {};
    if (patch.name !== undefined) next.name = cleanText(patch.name, MAX_ACCOUNT_NAME_LENGTH);
    if (patch.label !== undefined) next.label = cleanText(patch.label, MAX_ACCOUNT_LABEL_LENGTH);
    if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
    if (patch.credential !== undefined) {
      const credential = credentialObject(patch.credential);
      const row = await probeAccount({ ...entry.account, ...next }, credential);
      const envelope = encryptCredential(credential, credentialKey);
      const updatedAt = new Date(now()).toISOString();
      await runTransaction(async (executor) => {
        await store.replaceHubAccountCredential(id, envelope, executor);
        await store.updateHubAccount(id, {
          ...next,
          accountKey: row.accountKey || entry.account.accountKey || '',
          accountEmail: row.accountEmail || entry.account.accountEmail || '',
          accountLabel: row.accountLabel || entry.account.accountLabel || '',
          status: 'ok',
          lastAttemptAt: updatedAt,
          lastSuccessAt: updatedAt,
          lastErrorCode: '',
          lastErrorMessage: '',
          nextRefreshAt: new Date(now() + intervalMs).toISOString(),
          updatedAt
        }, executor);
        await store.saveHubAccountSnapshot(id, {
          provider: row,
          lastGood: row,
          updatedAt
        }, executor);
      });
    } else if (Object.keys(next).length) {
      await store.updateHubAccount(id, { ...next, updatedAt: new Date(now()).toISOString() });
    }
    const refreshed = await accountWithSnapshot(id);
    await onUpdate?.({ type: 'account-updated', accountId: id });
    return publicAccount(refreshed.account, refreshed.snapshot);
  }

  async function deleteAccount(id) {
    const existing = await store.getHubAccount(id);
    if (!existing) return false;
    await store.deleteHubAccount(id);
    await onUpdate?.({ type: 'account-deleted', accountId: id });
    return true;
  }

  function start() {
    if (timer || stopped) return;
    timer = setInterval(() => { void refreshAll('interval'); }, intervalMs);
    timer.unref?.();
    void refreshAll('startup');
  }

  async function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
    await refreshPromise?.catch(() => {});
  }

  return {
    addAccount,
    deleteAccount,
    getLimitsSummary,
    listAccounts,
    refreshAccount: (id) => refreshOne(id, 'manual'),
    refreshAll,
    start,
    stop,
    updateAccount,
    supportedProviders: () => [...HUB_MANUAL_PROVIDERS]
  };
}

module.exports = {
  DEFAULT_CONCURRENCY,
  DEFAULT_REFRESH_MS,
  HUB_MANUAL_PROVIDERS,
  MAX_CREDENTIAL_BYTES,
  createHubAccountService,
  providerOptions
};
