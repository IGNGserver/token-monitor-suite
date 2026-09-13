'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { decryptCredential, encryptCredential } = require('../../src/hub/accountCrypto');
const { createHubAccountService, providerOptions } = require('../../src/hub/accountService');
const { MemoryRepository } = require('./memory-repository');

function probeRow(provider, accountKey = `${provider}-account`) {
  return {
    provider,
    status: 'ok',
    accountKey,
    accountEmail: `${accountKey}@example.test`,
    accountLabel: 'Manual Hub account',
    windows: [{ label: 'daily', used: 10, limit: 100, remaining: 90, unit: 'tokens' }]
  };
}

test('Hub credential envelopes round-trip and reject a different key', () => {
  const envelope = encryptCredential({ apiKey: 'keep-this-on-hub' }, 'hub-key');
  assert.notEqual(envelope.ciphertext, 'keep-this-on-hub');
  assert.deepEqual(decryptCredential(envelope, 'hub-key'), { apiKey: 'keep-this-on-hub' });
  assert.throws(() => decryptCredential(envelope, 'wrong-key'));
});

test('Hub account service validates, encrypts, and exposes only manual account metadata', async () => {
  const repository = new MemoryRepository();
  const seen = [];
  const service = createHubAccountService({
    store: repository,
    credentialKey: 'hub-key',
    refreshMs: 10_000,
    probe: async (provider, options, context, runtime) => {
      seen.push({ provider, options, context, runtime });
      return probeRow(provider);
    },
    now: () => Date.parse('2026-09-11T00:00:00.000Z')
  });

  const account = await service.addAccount({
    provider: 'deepseek',
    name: 'work',
    label: 'Work account',
    credential: { apiKey: 'secret-api-key' }
  });

  assert.equal(account.provider, 'deepseek');
  assert.equal(account.status, 'ok');
  assert.equal(account.accountEmail, 'deepseek-account@example.test');
  assert.equal(Object.prototype.hasOwnProperty.call(account, 'credential'), false);
  assert.equal(JSON.stringify(account).includes('secret-api-key'), false);

  const storedEnvelope = repository.hubCredentials.get(account.id);
  assert.ok(storedEnvelope);
  assert.equal(JSON.stringify(storedEnvelope).includes('secret-api-key'), false);
  assert.deepEqual(decryptCredential(storedEnvelope, 'hub-key'), { apiKey: 'secret-api-key' });

  assert.equal(seen.length, 1);
  assert.equal(seen[0].options.limitProviderAuthority, 'hub');
  assert.equal(seen[0].options.suppressAutoDetectedAccounts, true);
  assert.deepEqual({ ...seen[0].runtime.env }, {});
  assert.equal(seen[0].runtime.homeDir, '');

  const listed = await service.listAccounts();
  assert.equal(listed.length, 1);
  assert.equal(JSON.stringify(listed).includes('secret-api-key'), false);

  const summary = await service.getLimitsSummary();
  assert.equal(summary.providers.length, 1);
  assert.equal(summary.providers[0].authority, 'hub');
  assert.equal(summary.providers[0].accountId, account.id);
});

test('Hub account service rejects duplicate provider identities and refreshes with stored credentials', async () => {
  const repository = new MemoryRepository();
  let probeCount = 0;
  const service = createHubAccountService({
    store: repository,
    credentialKey: 'hub-key',
    probe: async (provider) => {
      probeCount += 1;
      return probeRow(provider, 'same-account');
    }
  });

  const account = await service.addAccount({ provider: 'openrouter', credential: { apiKey: 'first-key' } });
  await assert.rejects(
    service.addAccount({ provider: 'openrouter', credential: { apiKey: 'second-key' } }),
    { code: 'account_duplicate' }
  );

  const refreshed = await service.refreshAccount(account.id);
  assert.equal(refreshed.status, 'ok');
  assert.equal(probeCount, 3);
  assert.deepEqual(
    decryptCredential(repository.hubCredentials.get(account.id), 'hub-key'),
    { apiKey: 'first-key' }
  );
});

test('disabling a Hub account clears its published quota snapshot until re-enabled', async () => {
  const repository = new MemoryRepository();
  let probeCount = 0;
  const service = createHubAccountService({
    store: repository,
    credentialKey: 'hub-key',
    probe: async (provider) => {
      probeCount += 1;
      return {
        ...probeRow(provider, 'toggle-account'),
        windows: [{ kind: 'weekly', usedPercent: 10, resetsAt: '2026-09-19T00:00:00Z' }]
      };
    },
    now: () => Date.parse('2026-09-12T00:00:00Z')
  });

  const account = await service.addAccount({ provider: 'codex', credential: { accessToken: 'oauth-token' } });
  assert.equal((await service.getLimitsSummary()).providers[0].windows.length, 1);

  const disabled = await service.updateAccount(account.id, { enabled: false });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.status, 'disabled');
  assert.equal(disabled.limits.status, 'disabled');
  assert.deepEqual(disabled.limits.windows, []);
  assert.equal((await service.getLimitsSummary()).providers[0].status, 'disabled');
  assert.deepEqual((await service.getLimitsSummary()).providers[0].windows, []);

  const enabled = await service.updateAccount(account.id, { enabled: true });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.status, 'ok');
  assert.equal(enabled.limits.status, 'ok');
  assert.equal(probeCount, 2);
});

test('Hub account service rotates an expired OAuth credential before probing', async () => {
  const repository = new MemoryRepository();
  const nowMs = Date.parse('2026-09-12T00:00:00Z');
  const seenTokens = [];
  const service = createHubAccountService({
    store: repository,
    credentialKey: 'hub-key',
    now: () => nowMs,
    oauthFetch: async (url, init) => {
      assert.equal(url, 'https://auth.openai.com/oauth/token');
      assert.match(String(init.body), /grant_type=refresh_token/);
      return new Response(JSON.stringify({
        access_token: 'rotated-access',
        refresh_token: 'rotated-refresh',
        expires_in: 3600
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    probe: async (provider, options) => {
      seenTokens.push(options.codexAccessToken);
      return {
        ...probeRow(provider, 'rotated-account'),
        windows: [{ kind: 'weekly', usedPercent: 10 }]
      };
    }
  });

  const account = await service.addAccount({
    provider: 'codex',
    credential: {
      accessToken: 'expired-access',
      refreshToken: 'refresh-token',
      expiresAt: nowMs - 1
    }
  });

  assert.deepEqual(seenTokens, ['rotated-access']);
  const stored = decryptCredential(repository.hubCredentials.get(account.id), 'hub-key');
  assert.equal(stored.accessToken, 'rotated-access');
  assert.equal(stored.refreshToken, 'rotated-refresh');
  assert.equal(stored.authJson.tokens.access_token, 'rotated-access');
});

test('Hub provider options do not carry ambient environment or local account discovery', () => {
  const options = providerOptions(
    { id: 'account-1', provider: 'openrouter', name: 'work' },
    { apiKey: 'manual-key' }
  );
  assert.equal(options.limitProviderAuthority, 'hub');
  assert.equal(options.limitProviderAutoDetectDisabled, 'openrouter');
  assert.equal(options.suppressAutoDetectedAccounts, true);
  assert.deepEqual(options.openrouterProfiles, { work: { apiKey: 'manual-key', enabled: true } });
});

test('Hub account edits preserve and merge nested third-party profiles', async () => {
  const repository = new MemoryRepository();
  const seenKeys = [];
  const service = createHubAccountService({
    store: repository,
    credentialKey: 'hub-key',
    probe: async (provider, options) => {
      seenKeys.push(options.thirdPartyProfiles?.work?.apiKey || '');
      return probeRow(provider, 'third-party-account');
    }
  });

  const account = await service.addAccount({
    provider: 'thirdparty',
    name: 'work',
    credential: {
      profile: {
        adapter: 'newapi',
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'first-key'
      }
    }
  });

  const listed = await service.listAccounts({ includeCredentialMetadata: true });
  assert.deepEqual(listed[0].credentialMetadata, {
    adapter: 'newapi',
    baseUrl: 'https://api.example.test/v1'
  });

  await service.updateAccount(account.id, {
    credential: {
      adapter: 'newapi',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'second-key'
    },
    credentialMode: 'merge'
  });
  assert.deepEqual(seenKeys, ['first-key', 'second-key']);
  assert.equal(
    decryptCredential(repository.hubCredentials.get(account.id), 'hub-key').profile.apiKey,
    'second-key'
  );
});

test('Hub rejects third-party account targets that could reach local services', async () => {
  const repository = new MemoryRepository();
  let probed = false;
  const service = createHubAccountService({
    store: repository,
    credentialKey: 'hub-key',
    probe: async () => {
      probed = true;
      return probeRow('thirdparty');
    }
  });

  await assert.rejects(
    service.addAccount({
      provider: 'thirdparty',
      credential: {
        adapter: 'custom',
        baseUrl: 'http://127.0.0.1:8080',
        apiKey: 'local-service-key'
      }
    }),
    { code: 'credential_invalid' }
  );
  assert.equal(probed, false);
});
