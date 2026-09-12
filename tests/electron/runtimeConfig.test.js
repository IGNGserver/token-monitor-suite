'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  classifySettingsChange,
  envelopeFromSettings,
  usageConfigFromSettings
} = require('../../src/electron/runtimeConfig');

test('runtime config keeps usage and envelope separate from Hub credentials', () => {
  const settings = {
    deviceId: 'device-1',
    clients: 'claude,cursor',
    collectionIntervalMs: 300000,
    hubAccountCredentialKey: 'hub-only-secret',
    kimiApiKey: 'legacy-local-secret'
  };
  const usage = usageConfigFromSettings(settings, {
    agentVersion: '1.2.3',
    intervalMs: 120000,
    historyIntervalMs: 900000,
    watchEnabled: true
  });
  const envelope = envelopeFromSettings(settings, { agentVersion: '1.2.3' });

  assert.equal(usage.intervalMs, 120000);
  assert.equal(Object.hasOwn(usage, 'hubAccountCredentialKey'), false);
  assert.equal(Object.hasOwn(usage, 'kimiApiKey'), false);
  assert.deepEqual(envelope, {
    deviceId: 'device-1',
    agentVersion: '1.2.3',
    agentRuntime: 'electron-widget'
  });
});

test('local provider credential changes do not reconfigure a device limits lane', () => {
  const classification = classifySettingsChange(
    { kimiApiKey: 'old', openrouterProfiles: { work: { apiKey: 'old' } } },
    { kimiApiKey: 'new', openrouterProfiles: { work: { apiKey: 'new' } } }
  );

  assert.equal(classification.limitsReconfigure, false);
  assert.deepEqual(classification.limitScopes, []);
});

test('display-only settings do not restart usage or probe providers', () => {
  const classification = classifySettingsChange(
    { currency: 'USD', theme: 'dark' },
    { currency: 'HKD', theme: 'light' }
  );
  assert.equal(classification.modeStructural, false);
  assert.equal(classification.usageStructural, false);
  assert.equal(classification.limitsReconfigure, false);
  assert.equal(classification.sinkStructural, false);
  assert.deepEqual(classification.limitScopes, []);
});

test('allowInsecureHubHttp change triggers mode structural restart', () => {
  const classification = classifySettingsChange(
    { allowInsecureHubHttp: false },
    { allowInsecureHubHttp: true }
  );
  assert.equal(classification.modeStructural, true);
});

