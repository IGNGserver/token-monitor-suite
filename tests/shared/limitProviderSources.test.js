'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');
const {
  HUB_MANUAL_PROVIDER_IDS,
  LIMIT_PROVIDER_SOURCE_CAPABILITIES,
  providerSourceCapability,
  providerSupportsAutoDetectToggle
} = require('../../src/shared/limitProviderSources');

test('provider source metadata covers every supported limits provider exactly once', () => {
  assert.deepEqual(Object.keys(LIMIT_PROVIDER_SOURCE_CAPABILITIES).sort(), [...LIMIT_PROVIDER_IDS].sort());
  for (const provider of LIMIT_PROVIDER_IDS) {
    const capability = providerSourceCapability(provider);
    assert.ok(capability, `${provider} needs source metadata`);
    assert.equal(capability.supportsToggle, capability.manual && capability.automatic);
  }
});

test('all supported quota sources are Hub-authoritative and never automatic', () => {
  for (const provider of LIMIT_PROVIDER_IDS) {
    const capability = providerSourceCapability(provider);
    assert.equal(capability.automatic, false, provider);
    assert.equal(providerSupportsAutoDetectToggle(provider), false);
    assert.equal(capability.authority, capability.manual ? 'hub' : 'unsupported');
  }
  assert.deepEqual([...HUB_MANUAL_PROVIDER_IDS].sort(), Object.entries(LIMIT_PROVIDER_SOURCE_CAPABILITIES)
    .filter(([, capability]) => capability.manual)
    .map(([provider]) => provider)
    .sort());
});

test('Hub probing keeps explicit credentials and removes automatic env access', async () => {
  let observed;
  const { probeLimitProvider } = require('../../src/shared/limitCollector');
  const rows = await probeLimitProvider('kimi', {
    limitProviderAuthority: 'hub',
    kimiApiKey: 'saved-manual-key'
  }, {}, {
    env: { KIMI_API_KEY: 'ambient-automatic-key' },
    providerFetchers: {
      kimi: async (options, deps) => {
        observed = { options, envKeys: Object.keys(deps.env || {}) };
        return { provider: 'kimi', status: 'ok', windows: [] };
      }
    }
  });

  assert.equal(observed.options.suppressAutoDetectedAccounts, true);
  assert.deepEqual(observed.envKeys, []);
  assert.equal(rows[0].credentialOrigin, 'manual');
});

test('Hub probing skips a provider that has no explicit credential', async () => {
  const { probeLimitProvider } = require('../../src/shared/limitCollector');
  let called = false;
  const rows = await probeLimitProvider('kimi', {
    limitProviderAuthority: 'hub'
  }, {}, {
    env: { KIMI_API_KEY: 'ambient-automatic-key' },
    providerFetchers: {
      kimi: async () => {
        called = true;
        return { provider: 'kimi', status: 'ok', windows: [] };
      }
    }
  });

  assert.equal(called, false);
  assert.deepEqual(rows, []);
});

test('Hub probing filters an automatic row returned by a provider', async () => {
  const { probeLimitProvider } = require('../../src/shared/limitCollector');
  const rows = await probeLimitProvider('kimi', {
    limitProviderAuthority: 'hub',
    kimiApiKey: 'saved-manual-key'
  }, {}, {
    providerFetchers: {
      kimi: async () => ({
        provider: 'kimi',
        status: 'ok',
        credentialOrigin: 'automatic',
        windows: []
      })
    }
  });

  assert.deepEqual(rows, []);
});
