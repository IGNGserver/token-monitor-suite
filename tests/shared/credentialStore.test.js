'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  CredentialStore,
  credentialSettingsForRenderer,
  hasCredentialSettings,
  persistSettingsAndCredentials,
  readRegularFileNoFollow,
  stripCredentialSettings,
  writePrivateJsonAtomic
} = require('../../src/shared/credentialStore');

function tempDataDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-credentials-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('stores only Hub and device credentials in a versioned document', (t) => {
  const dataDir = tempDataDir(t);
  const store = new CredentialStore(dataDir);
  store.replaceSettingsCredentials({
    hubHostSecret: 'host-secret',
    hubHostAdminSecret: 'admin-secret',
    secret: 'client-secret',
    hubAdminSecret: 'remote-admin-secret',
    hubAccountCredentialKey: 'account-key',
    deepseekApiKey: 'legacy-provider-key'
  });

  const document = JSON.parse(fs.readFileSync(path.join(dataDir, 'credentials.json'), 'utf8'));
  assert.equal(document.version, 1);
  assert.equal(document.credentials.hub.hostSecret, 'host-secret');
  assert.equal(document.credentials.hub.adminSecret, 'admin-secret');
  assert.equal(document.credentials.hub.clientSecret, 'client-secret');
  assert.equal(document.credentials.hub.remoteAdminSecret, 'remote-admin-secret');
  assert.equal(document.credentials.hub.accountCredentialKey, 'account-key');
  assert.equal(document.credentials.providers, undefined);
  assert.equal(document.migrations.settings, 1);

  assert.deepEqual(store.settingsCredentials(), {
    hubHostSecret: 'host-secret',
    hubHostAdminSecret: 'admin-secret',
    secret: 'client-secret',
    hubAdminSecret: 'remote-admin-secret',
    hubAccountCredentialKey: 'account-key'
  });
});

test('removes credential fields from settings without mutating runtime state', () => {
  const settings = {
    language: 'auto',
    hubHostSecret: 'secret',
    hubAdminSecret: 'admin-secret',
    localProviderCredential: 'legacy-secret'
  };
  const clean = stripCredentialSettings(settings);
  assert.deepEqual(clean, { language: 'auto', localProviderCredential: 'legacy-secret' });
  assert.equal(settings.hubHostSecret, 'secret');
  assert.equal(settings.hubAdminSecret, 'admin-secret');
  assert.equal(hasCredentialSettings(settings), true);
  assert.equal(hasCredentialSettings(clean), false);
});

test('renderer redaction defaults new credential fields to hidden with explicit exceptions', () => {
  const settings = {
    hubHostSecret: 'host-secret',
    secret: 'client-secret',
    hubAdminSecret: 'admin-secret',
    hubAccountCredentialKey: 'account-key',
    deepseekApiKey: 'provider-secret'
  };
  const redacted = credentialSettingsForRenderer(settings, { expose: ['hubHostSecret', 'secret'] });
  assert.equal(redacted.hubHostSecret, 'host-secret');
  assert.equal(redacted.secret, 'client-secret');
  assert.equal(redacted.hubAdminSecret, '');
  assert.equal(redacted.hubAccountCredentialKey, '');
  assert.equal(redacted.deepseekApiKey, undefined);
});

test('migrates legacy settings once and keeps an existing credential authoritative', (t) => {
  const store = new CredentialStore(tempDataDir(t));
  store.writeDocument({
    version: 1,
    credentials: { hub: { hostSecret: 'current-key' } },
    migrations: {}
  });

  const first = store.migrateLegacySettings({ hubHostSecret: 'legacy-key', hubAdminSecret: 'legacy-admin' });
  assert.equal(first.migrated, true);
  assert.equal(store.settingsCredentials().hubHostSecret, 'current-key');
  assert.equal(store.settingsCredentials().hubAdminSecret, 'legacy-admin');

  const second = store.migrateLegacySettings({ hubAdminSecret: 'stale-admin' });
  assert.equal(second.migrated, false);
  assert.equal(store.settingsCredentials().hubAdminSecret, 'legacy-admin');
});

test('clearing a Hub credential removes it without resurrecting legacy data', (t) => {
  const store = new CredentialStore(tempDataDir(t));
  store.migrateLegacySettings({ hubAdminSecret: 'legacy-admin' });
  store.replaceSettingsCredentials({ hubAdminSecret: '' });
  assert.equal(store.settingsCredentials().hubAdminSecret, undefined);
  assert.equal(store.migrateLegacySettings({ hubAdminSecret: 'legacy-admin' }).migrated, false);
  assert.equal(store.settingsCredentials().hubAdminSecret, undefined);
});

test('clears all legacy local provider credentials and invalidates the migration once', (t) => {
  const store = new CredentialStore(tempDataDir(t));
  store.writeDocument({
    version: 1,
    credentials: {
      hub: { hostSecret: 'keep-me' },
      providers: {
        deepseek: { apiKey: 'old-key' },
        qoder: { cookie: 'old-cookie', autoCache: [{ cookie: 'old-cache' }] },
        mimo: { accounts: [{ id: 'old-account', cookie: 'old-cookie' }] }
      }
    },
    migrations: {}
  });

  const first = store.clearLegacyLocalLimitCredentials();
  assert.equal(first.cleared, true);
  assert.equal(store.settingsCredentials().hubHostSecret, 'keep-me');
  assert.equal(store.readDocument().credentials.providers, undefined);
  assert.equal(store.readDocument().migrations.localLimitCredentials, 1);
  assert.equal(store.clearLegacyLocalLimitCredentials().cleared, false);
});

test('writes private JSON atomically with owner-only permissions', (t) => {
  const dataDir = tempDataDir(t);
  const filePath = path.join(dataDir, 'private.json');
  const fsApi = Object.create(fs);
  const syncedKinds = [];
  fsApi.fsyncSync = (descriptor) => {
    syncedKinds.push(fs.fstatSync(descriptor).isDirectory() ? 'directory' : 'file');
    return fs.fsyncSync(descriptor);
  };
  writePrivateJsonAtomic(filePath, { ok: true }, { fs: fsApi });
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { ok: true });
  assert.equal(fs.readdirSync(dataDir).some((name) => name.endsWith('.tmp')), false);
  assert.ok(syncedKinds.includes('file'));
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
    assert.ok(syncedKinds.includes('directory'));
  }
});

test('reads private files through a validated descriptor', (t) => {
  const dataDir = tempDataDir(t);
  const filePath = path.join(dataDir, 'credentials.json');
  fs.writeFileSync(filePath, JSON.stringify({ version: 1, credentials: {}, migrations: {} }), 'utf8');
  const fsApi = Object.create(fs);
  let readTarget = null;
  fsApi.readFileSync = (target, ...args) => {
    readTarget = target;
    return fs.readFileSync(target, ...args);
  };
  assert.match(readRegularFileNoFollow(filePath, { fs: fsApi, description: 'Credential store' }), /"version":1/);
  assert.equal(typeof readTarget, 'number');
});

test('does not overwrite a corrupt credential store', (t) => {
  const dataDir = tempDataDir(t);
  const filePath = path.join(dataDir, 'credentials.json');
  fs.writeFileSync(filePath, '{broken', 'utf8');
  const store = new CredentialStore(dataDir);
  assert.throws(() => store.replaceSettingsCredentials({ kimiApiKey: 'new-key' }), SyntaxError);
  assert.equal(fs.readFileSync(filePath, 'utf8'), '{broken');
});

test('refuses to follow a credential-store symlink', { skip: process.platform === 'win32' }, (t) => {
  const dataDir = tempDataDir(t);
  const target = path.join(dataDir, 'target.json');
  const filePath = path.join(dataDir, 'credentials.json');
  fs.writeFileSync(target, JSON.stringify({ version: 1, credentials: {}, migrations: {} }), 'utf8');
  fs.symlinkSync(target, filePath);
  const store = new CredentialStore(dataDir);
  assert.throws(() => store.readDocument(), /regular file/);
});

test('rolls back a credential clear when the settings write fails after commit', (t) => {
  const dataDir = tempDataDir(t);
  const settingsPath = path.join(dataDir, 'settings.json');
  const store = new CredentialStore(dataDir);
  const previousSettings = { language: 'en', hubAdminSecret: 'old-key' };
  store.replaceSettingsCredentials(previousSettings);
  writePrivateJsonAtomic(settingsPath, stripCredentialSettings(previousSettings));

  let firstSettingsWrite = true;
  const writeSettings = (target, value) => {
    writePrivateJsonAtomic(target, value);
    if (firstSettingsWrite) {
      firstSettingsWrite = false;
      const error = new Error('settings write failed after rename');
      error.atomicWriteCommitted = true;
      throw error;
    }
  };

  assert.throws(() => persistSettingsAndCredentials({
    store,
    settingsPath,
    settings: { language: 'zh-TW', hubAdminSecret: '' },
    previousSettings,
    writeSettings
  }), /settings write failed after rename/);
  assert.equal(store.settingsCredentials().hubAdminSecret, 'old-key');
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), { language: 'en' });
});

test('stores device-bound Hub credentials without exposing them as settings', (t) => {
  const store = new CredentialStore(tempDataDir(t));
  assert.equal(store.writeHubIngestCredential('device-a', 'token-a'), true);
  assert.equal(store.writeHubIngestCredential('device-b', 'token-b'), true);
  assert.deepEqual(store.readHubIngestCredentials(), { 'device-a': 'token-a', 'device-b': 'token-b' });
  assert.equal(store.settingsCredentials().hubHostIngestCredentials, undefined);
  assert.equal(store.removeHubIngestCredential('device-a'), true);
  assert.deepEqual(store.readHubIngestCredentials(), { 'device-b': 'token-b' });
  assert.equal(store.writeHubIngestCredential('__proto__', 'unsafe'), false);
});

test('renames a device-bound Hub credential in one document update', (t) => {
  const store = new CredentialStore(tempDataDir(t));
  assert.equal(store.writeHubIngestCredential('before', 'bound-token'), true);

  assert.equal(store.renameHubIngestCredential('before', 'after'), true);
  assert.deepEqual(store.readHubIngestCredentials(), { after: 'bound-token' });

  store.writeHubIngestCredential('existing', 'existing-token');
  assert.equal(store.renameHubIngestCredential('after', 'existing'), true);
  assert.deepEqual(store.readHubIngestCredentials(), { existing: 'existing-token' });
});
