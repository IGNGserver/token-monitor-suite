'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('renderer exposes only Hub-managed manual account controls', () => {
  const html = read('src/electron/renderer/index.html');
  const app = read('src/electron/renderer/app.js');
  const preload = read('src/electron/preload.js');
  const main = read('src/electron/main.js');

  assert.match(html, /id="hubAccountsSettingsToggle"/);
  assert.match(html, /id="hubAccountProvider"/);
  assert.match(html, /id="hubAccountCredential"/);
  assert.match(html, /id="hubAccountAddButton"/);
  assert.match(app, /window\.tokenMonitor\.hubAccounts\.list/);
  assert.match(app, /window\.tokenMonitor\.hubAccounts\.add/);
  assert.match(app, /window\.tokenMonitor\.hubAccounts\.remove/);
  assert.match(app, /window\.tokenMonitor\.hubAccounts\.refresh/);
  assert.match(preload, /hubAccounts: \{/);
  assert.match(main, /ipcMain\.handle\('hubAccounts:list'/);
  assert.match(main, /ipcMain\.handle\('hubAccounts:add'/);
  assert.match(main, /ipcMain\.handle\('hubAccounts:remove'/);
  assert.match(main, /limitsAuthority: 'hub'/);
  assert.match(main, /centralQuotaSync: true/);
});

test('renderer and device upload paths contain no local account namespaces', () => {
  const app = read('src/electron/renderer/app.js');
  const preload = read('src/electron/preload.js');
  const main = read('src/electron/main.js');
  const payload = read('src/shared/syncPayload.js');

  for (const source of [app, preload, main]) {
    assert.doesNotMatch(source, /tokenMonitor\.(?:codex|mimo|cursor|openrouter|opencode)\b/);
  }
  assert.match(main, /stripLegacyLocalLimitSettings\(settings\)/);
  assert.match(payload, /delete payload\.limits/);
});

test('Hub account credentials are never included in public account responses', () => {
  const service = read('src/hub/accountService.js');
  const server = read('src/hub/server.js');

  assert.match(service, /function publicAccount\(/);
  const publicAccountBody = service.slice(
    service.indexOf('function publicAccount('),
    service.indexOf('function statusFromError(')
  );
  assert.doesNotMatch(publicAccountBody, /apiKey|cookie|token/);
  assert.doesNotMatch(publicAccountBody, /credentialMetadata/);
  const listRoute = server.slice(
    server.indexOf("url.pathname === '/api/accounts'"),
    server.indexOf("if (req.method === 'POST' && url.pathname === '/api/accounts')")
  );
  assert.match(listRoute, /listAccounts\(\{ includeCredentialMetadata: isAdmin \}\)/);
  assert.match(listRoute, /redactViewerAccount/);
});
