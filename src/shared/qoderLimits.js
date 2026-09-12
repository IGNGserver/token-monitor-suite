'use strict';

const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');
const { BROWSER_USER_AGENT } = require('./browserUserAgent');
const {
  importQoderChromeCookies,
  parseQoderCookieInput
} = require('./qoderCookieCapture');

const QODER_FETCH_TIMEOUT_MS = 12_000;
const QODER_COOKIE_CACHE_MAX_ENTRIES = 8;
const QODER_COOKIE_MODES = Object.freeze(['auto', 'manual', 'off']);

function cleanSecret(value) {
  let raw = value;
  if (typeof raw !== 'string') return '';
  raw = raw.trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}

function qoderCookie(env = process.env, options = {}) {
  const explicit = cleanSecret(options.qoderCookie);
  if (explicit) return explicit;
  for (const name of ['QODER_COOKIE', 'TOKEN_MONITOR_QODER_COOKIE']) {
    const raw = cleanSecret(env[name]);
    if (raw) return raw;
  }
  return '';
}

function normalizeQoderCookieMode(value, fallback = 'auto') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'automatic' || raw === 'browser') return 'auto';
  if (raw === 'manual-only' || raw === 'paste') return 'manual';
  if (raw === 'disabled' || raw === 'none') return 'off';
  if (QODER_COOKIE_MODES.includes(raw)) return raw;
  return QODER_COOKIE_MODES.includes(fallback) ? fallback : 'auto';
}

function qoderCookieMode(options = {}, env = process.env) {
  const configured = options.qoderCookieMode ?? options.qoderSource
    ?? env.TOKEN_MONITOR_QODER_COOKIE_MODE ?? env.TOKEN_MONITOR_QODER_SOURCE;
  return normalizeQoderCookieMode(configured, 'auto');
}

function qoderSite(options = {}, env = process.env) {
  const value = String(options.qoderSite || env.QODER_SITE || env.TOKEN_MONITOR_QODER_SITE || '').trim().toLowerCase();
  if (value === 'cn' || value === 'china' || value.includes('qoder.com.cn')) return 'cn';
  return 'global';
}

function qoderOrigin(site) {
  return site === 'cn' ? 'https://qoder.com.cn' : 'https://qoder.com';
}

function qoderUsageUrl(site = 'global') {
  return `${qoderOrigin(site)}/api/v2/me/usages/big_model_credits`;
}

function qoderUserPlanUrl(site = 'global') {
  return `${qoderOrigin(site)}/api/v1/me/userplan`;
}

function qoderSiteFilter(options = {}, env = process.env) {
  const raw = options.qoderSite ?? env.QODER_SITE ?? env.TOKEN_MONITOR_QODER_SITE;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  return qoderSite(options, env);
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value < 20_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function read(obj, camel, snake) {
  return obj?.[camel] ?? obj?.[snake];
}

function planText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw
    .replace(/^ORGANIZATION_PLAN_TIER_/i, 'PLAN_TIER_')
    .replace(/^PLAN_TIER_/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const known = {
    free: 'Community Edition',
    community: 'Community Edition',
    communityedition: 'Community Edition',
    'community edition': 'Community Edition',
    protrial: 'Pro Trial',
    'pro trial': 'Pro Trial',
    pro: 'Pro',
    proplus: 'Pro+',
    'pro plus': 'Pro+',
    'pro+': 'Pro+',
    ultra: 'Ultra',
    team: 'Teams',
    teams: 'Teams',
    enterprise: 'Enterprise'
  };
  if (known[normalized]) return known[normalized];
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bpro\s+plus\b/i, 'Pro+')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstPlanLabel(source) {
  if (!source || typeof source !== 'object') return '';
  for (const field of [
    'plan_tier',
    'planTier',
    'plan',
    'tier',
    'name',
    'product_name',
    'productName',
    'subscription_type',
    'subscriptionType'
  ]) {
    const label = planText(source[field]);
    if (label) return label;
  }
  return '';
}

function parseQoderPlanLabel(body) {
  const direct = firstPlanLabel(body);
  if (direct) return direct;
  const data = body?.data;
  const dataLabel = firstPlanLabel(data);
  if (dataLabel) return dataLabel;
  const subscription = data?.subscription || body?.subscription || null;
  const subscriptionLabel = firstPlanLabel(subscription);
  if (subscriptionLabel) return subscriptionLabel;
  const current = data?.current || data?.currentPlan || data?.current_plan || body?.current || body?.currentPlan || body?.current_plan || null;
  return firstPlanLabel(current);
}

function quotaSummary(container) {
  return read(container, 'quotaSummary', 'quota_summary') || null;
}

function parseSummary(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const used = numberOrNull(read(summary, 'usedValue', 'used_value'));
  const total = numberOrNull(read(summary, 'limitValue', 'limit_value'));
  const explicitRemaining = numberOrNull(read(summary, 'remainingValue', 'remaining_value'));
  if (used === null || total === null || used < 0 || total < 0) return null;
  const remaining = explicitRemaining === null ? Math.max(0, total - used) : Math.max(0, explicitRemaining);
  const explicitPercentage = numberOrNull(read(summary, 'usagePercentage', 'usage_percentage'));
  const usagePercentage = explicitPercentage === null && total > 0 ? (used / total) * 100 : explicitPercentage;
  return {
    used,
    total,
    remaining,
    usagePercentage: Math.max(0, Math.min(100, usagePercentage ?? (total === 0 ? 100 : 0))),
    unit: String(summary.unit || '').trim()
  };
}

function parseQoderUsage(body) {
  const payload = body?.data && typeof body.data === 'object' ? body.data : body;
  const total = parseSummary(quotaSummary(read(payload, 'totalQuota', 'total_quota')));
  if (!total) throw new Error('missing totalQuota.quotaSummary');
  const shared = parseSummary(quotaSummary(read(payload, 'sharedQuota', 'shared_quota')));
  const usedCredits = total.used + (shared?.used || 0);
  const totalCredits = total.total + (shared?.total || 0);
  const remainingCredits = total.remaining + (shared?.remaining || 0);
  const usagePercentage = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : total.usagePercentage;
  const resetsAt = toIso(read(payload, 'nextResetAt', 'next_reset_at'));
  const window = {
    kind: 'billing',
    label: 'Credits',
    used: usedCredits,
    limit: totalCredits,
    remaining: remainingCredits,
    usedPercent: usagePercentage,
    remainingPercent: Math.max(0, Math.min(100, 100 - usagePercentage)),
    resetsAt,
    showMeter: true
  };
  return {
    usedCredits,
    totalCredits,
    remainingCredits,
    usagePercentage,
    unit: total.unit || shared?.unit || '',
    resetsAt,
    window
  };
}

function fetchJsonWithDeadline(url, init, deps = {}) {
  const deadlineMs = Number(deps.qoderFetchTimeoutMs || deps.fetchTimeoutMs || QODER_FETCH_TIMEOUT_MS);
  return runWithProbeDeadline(
    async ({ signal }) => {
      const response = await (deps.fetch || fetch)(url, { ...init, signal });
      const body = response.ok ? await response.json() : null;
      return { response, body };
    },
    { signal: deps.signal, deadlineMs }
  );
}

function qoderAccountIdentity(body) {
  const candidates = [
    body,
    body?.data,
    body?.user,
    body?.data?.user,
    body?.account,
    body?.data?.account
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    for (const field of ['userId', 'user_id', 'uid', 'accountId', 'account_id', 'id']) {
      const value = String(candidate[field] ?? '').trim();
      if (value && value.length <= 256) return value;
    }
  }
  return '';
}

function qoderAccountMetadata(body) {
  const candidates = [body?.user, body?.data?.user, body?.account, body?.data?.account, body?.data, body];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const email = String(candidate.email || candidate.emailAddress || candidate.email_address || '').trim();
    const name = String(candidate.name || candidate.displayName || candidate.display_name || '').trim();
    if (email || name) return { accountEmail: email, accountName: name };
  }
  return { accountEmail: '', accountName: '' };
}

function cacheReader(deps) {
  if (typeof deps.readQoderCookieCache === 'function') return deps.readQoderCookieCache;
  if (deps.qoderCookieCache instanceof Map) return () => [...deps.qoderCookieCache.values()];
  return () => deps.qoderCookieCache;
}

function cacheWriter(deps) {
  if (typeof deps.writeQoderCookieCache === 'function') return deps.writeQoderCookieCache;
  if (deps.qoderCookieCache instanceof Map) {
    return (entries) => {
      deps.qoderCookieCache.clear();
      for (const entry of entries) deps.qoderCookieCache.set(`${entry.site}:${entry.cookie}`, entry);
    };
  }
  return null;
}

function normalizeCachedQoderCandidates(value) {
  const raw = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
  const candidates = [];
  const seen = new Set();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    let parsed;
    try {
      parsed = parseQoderCookieInput(entry.cookie, { site: entry.site, source: 'cache' });
    } catch (_) {
      continue;
    }
    const key = `${parsed.site}:${parsed.cookie}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ ...parsed, profile: String(entry.profile || '').slice(0, 64), validatedAt: entry.validatedAt || null });
    if (candidates.length >= QODER_COOKIE_CACHE_MAX_ENTRIES) break;
  }
  return candidates;
}

async function readQoderCookieCandidates(deps = {}, options = {}, env = process.env) {
  const mode = qoderCookieMode(options, env);
  let cached = [];
  if (mode !== 'manual') {
    try { cached = normalizeCachedQoderCandidates(await cacheReader(deps)()); } catch (_) {}
  }
  const result = [];
  const seen = new Set(result.map((candidate) => `${candidate.site}:${candidate.cookie}`));
  const siteFilter = qoderSiteFilter(options, env);
  const add = (value, source, extra = {}) => {
    if (!value) return;
    try {
      const parsed = parseQoderCookieInput(value, { site: extra.site, source });
      if (siteFilter && parsed.site !== siteFilter) return;
      const key = `${parsed.site}:${parsed.cookie}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ ...parsed, ...extra });
    } catch (_) {}
  };
  // A GUI cookie is an explicit manual credential. It takes precedence over
  // cached/browser credentials so a deliberate account change is effective on
  // the very next probe. Manual-only mode intentionally excludes every other
  // source, including an automatic cache from a previous run.
  if (options.qoderCookie) add(options.qoderCookie, 'manual', { site: siteFilter || qoderSite(options, env) });
  if (mode === 'auto' && !options.qoderCookie) {
    for (const candidate of cached) {
      add(candidate.cookie, candidate.source || 'cache', {
        site: candidate.site,
        profile: candidate.profile,
        validatedAt: candidate.validatedAt
      });
    }
    add(qoderCookie(env), 'env', { site: siteFilter || undefined });
    const importer = deps.importQoderCookies || ((importOptions) => importQoderChromeCookies(importOptions, deps));
    if (!siteFilter || siteFilter === 'global' || siteFilter === 'cn') {
      try {
        const imported = await importer({
          platform: deps.platform || process.platform,
          homeDir: deps.homeDir,
          site: siteFilter
        });
        for (const candidate of Array.isArray(imported) ? imported : []) {
          add(candidate.cookie, candidate.source || 'chrome', {
            site: candidate.site,
            profile: candidate.profile
          });
        }
      } catch (_) {}
    }
  }
  return result.filter((candidate) => !siteFilter || candidate.site === siteFilter);
}

function qoderStatusRow(site, updatedAt, status, extra = {}) {
  return normalizeLimitProvider({
    provider: 'qoder',
    source: 'web',
    status,
    updatedAt,
    windows: [],
    region: site === 'cn' ? 'cn' : 'global',
    ...extra
  });
}

async function fetchQoderCandidate(candidate, deps, now) {
  const site = candidate.site === 'cn' ? 'cn' : 'global';
  const updatedAt = new Date(now).toISOString();
  const origin = qoderOrigin(site);
  const headers = {
    Cookie: candidate.cookie,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': BROWSER_USER_AGENT,
    Origin: origin,
    Referer: `${origin}/account/usage`,
    'X-Requested-With': 'XMLHttpRequest',
    'Bx-V': '2.5.35'
  };
  try {
    const { response, body } = await fetchJsonWithDeadline(qoderUsageUrl(site), { headers }, deps);
    if (!response.ok) {
      const status = Number(response.status);
      const result = qoderStatusRow(site, updatedAt,
        status === 401 || status === 403 ? 'unauthorized' : status === 429 ? 'sourceRateLimited' : 'unavailable',
        { credentialOrigin: candidate.source === 'manual' ? 'manual' : 'automatic' });
      return { row: result, invalidCredential: status === 401 || status === 403 };
    }
    const usage = parseQoderUsage(body);
    let accountLabel = '';
    let planBody = null;
    try {
      const { response: planResponse, body: fetchedPlanBody } = await fetchJsonWithDeadline(
        qoderUserPlanUrl(site), { headers }, deps
      );
      if (planResponse.ok) {
        planBody = fetchedPlanBody;
        accountLabel = parseQoderPlanLabel(planBody);
      }
    } catch (_) {}
    // The usage and user-plan endpoints do not have to expose the same
    // account envelope. Prefer a stable ID from either successful response so
    // rotating a Cookie does not create a duplicate account row; use plan
    // metadata only when the usage response did not provide it.
    const stableId = qoderAccountIdentity(body) || qoderAccountIdentity(planBody);
    const usageMetadata = qoderAccountMetadata(body);
    const planMetadata = qoderAccountMetadata(planBody);
    const metadata = {
      accountEmail: usageMetadata.accountEmail || planMetadata.accountEmail,
      accountName: usageMetadata.accountName || planMetadata.accountName
    };
    const row = normalizeLimitProvider({
      provider: 'qoder',
      accountKey: hashKey(stableId ? 'qoder-account' : 'qoder', stableId || candidate.cookie),
      ...metadata,
      accountLabel,
      source: 'web',
      sourceDetail: candidate.source === 'chrome' ? 'app' : 'managed',
      credentialOrigin: candidate.source === 'manual' ? 'manual' : 'automatic',
      status: 'ok',
      updatedAt,
      windows: [usage.window],
      region: site
    });
    return { row, valid: true, candidate };
  } catch (error) {
    const status = error?.status === 'timeout' ? 'unavailable' : error?.status || 'unavailable';
    return {
      row: qoderStatusRow(site, updatedAt, status, {
        credentialOrigin: candidate.source === 'manual' ? 'manual' : 'automatic'
      }),
      invalidCredential: false,
      error
    };
  }
}

async function rememberQoderCookieCandidate(candidate, deps = {}, now = Date.now()) {
  if (!candidate || candidate.source === 'manual') return;
  const reader = cacheReader(deps);
  const writer = cacheWriter(deps);
  if (!writer) return;
  let entries = [];
  try { entries = normalizeCachedQoderCandidates(await reader()); } catch (_) {}
  const key = `${candidate.site}:${candidate.cookie}`;
  entries = [{
    cookie: candidate.cookie,
    site: candidate.site,
    source: candidate.source,
    profile: candidate.profile || '',
    validatedAt: new Date(now).toISOString()
  }, ...entries.filter((entry) => `${entry.site}:${entry.cookie}` !== key)].slice(0, QODER_COOKIE_CACHE_MAX_ENTRIES);
  try { await writer(entries); } catch (_) {}
}

async function invalidateQoderCookieCandidate(candidate, deps = {}) {
  if (!candidate) return;
  const writer = cacheWriter(deps);
  if (!writer) return;
  let entries = [];
  try { entries = normalizeCachedQoderCandidates(await cacheReader(deps)()); } catch (_) {}
  const key = `${candidate.site}:${candidate.cookie}`;
  try {
    await writer(entries.filter((entry) => `${entry.site}:${entry.cookie}` !== key));
  } catch (_) {}
}

async function fetchQoderLimits(options = {}, deps = {}) {
  const env = deps.env || process.env;
  const now = (deps.now || Date.now)();
  const updatedAt = new Date(now).toISOString();
  const configuredMode = qoderCookieMode(options, env);
  // The generic provider source policy is independent from Qoder's own
  // auto/manual/off setting. When the former disables automatic discovery,
  // retain an explicitly saved Cookie but do not let the latter's default
  // `auto` value reopen env/cache/Chrome candidates.
  const mode = configuredMode === 'auto' && options.suppressAutoDetectedAccounts === true
    ? 'manual'
    : configuredMode;
  const site = qoderSite(options, env);
  if (mode === 'off') return qoderStatusRow(site, updatedAt, 'disabled', { credentialOrigin: 'unknown' });

  const candidateOptions = mode === configuredMode ? options : { ...options, qoderCookieMode: mode };
  const candidates = await readQoderCookieCandidates(deps, candidateOptions, env);
  if (candidates.length === 0) return qoderStatusRow(site, updatedAt, 'notConfigured');
  let lastRow = qoderStatusRow(site, updatedAt, 'unavailable');
  for (const candidate of candidates) {
    const result = await fetchQoderCandidate(candidate, deps, now);
    lastRow = result.row || lastRow;
    if (result.valid) {
      await rememberQoderCookieCandidate(candidate, deps, now);
      return result.row;
    }
    if (mode === 'auto' && result.invalidCredential) {
      await invalidateQoderCookieCandidate(candidate, deps);
      continue;
    }
    return result.row;
  }
  return lastRow;
}

module.exports = {
  QODER_COOKIE_MODES,
  QODER_FETCH_TIMEOUT_MS,
  qoderCookie,
  qoderCookieMode,
  qoderSite,
  qoderOrigin,
  qoderUsageUrl,
  qoderUserPlanUrl,
  normalizeQoderCookieMode,
  parseQoderPlanLabel,
  parseQoderUsage,
  fetchQoderLimits
};
