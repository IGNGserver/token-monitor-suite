/* Browser acceptance requires Playwright and an installed Chromium. No real
 * credentials or provider/network mutations: both Hubs use in-memory fixtures.
 * PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome node scripts/browser/fluent-acceptance.js
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createHub } = require('../../src/hub/server');
const { MemoryRepository } = require('../../tests/hub/memory-repository');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'tmp/fluent-acceptance');
fs.mkdirSync(output, { recursive: true });
const period = { totalTokens: 2841923, costUsd: 8.472, clients: { codex: 1941282, claude: 700341, gemini: 200300 }, clientCosts: { codex: 4.872, claude: 3.2, gemini: .4 }, models: { 'gpt-5.4': 1941282, 'claude-sonnet-4.6': 700341, 'gemini-3.1-pro': 200300 }, modelCosts: { 'gpt-5.4': 4.872, 'claude-sonnet-4.6': 3.2, 'gemini-3.1-pro': .4 }, clientModels: { codex: { 'gpt-5.4': 1941282 } }, inputTokens: 2141923, outputTokens: 700000 };
function fixtureHub(accounts = false) {
  const repository = new MemoryRepository();
  repository.devices.set('workstation', { deviceId: 'workstation', hostname: 'Development workstation', platform: 'linux', updatedAt: new Date().toISOString(), receivedAt: Date.now(), today: period, month: period, allTime: period });
  return createHub({ port: 0, host: '127.0.0.1', repository, secret: accounts ? 'fixture-only' : '', accountCredentialKey: accounts ? 'fixture-encryption' : '', accountProbe: async provider => ({ provider, status: 'ok', accountKey: provider + '-fixture', windows: [{ label: 'Daily', used: 12, limit: 100, remaining: 88, unit: 'tokens' }] }), logger: { error() {}, warn() {}, info() {} } });
}
async function run() {
  const hub = fixtureHub(); const accounts = fixtureHub(true);
  await hub.start(); await accounts.start();
  const base = `http://127.0.0.1:${hub.server.address().port}`;
  const accountBase = `http://127.0.0.1:${accounts.server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {

{
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);await page.waitForSelector('[data-jump-tool]');
await page.locator('[data-view="usage"]').click();await page.locator('[data-usage-tab="models"]').click();assert.equal(await page.locator('[data-usage-tab="models"]').getAttribute('aria-selected'),'true');
await page.locator('[data-usage-tab="models"]').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert.equal(await page.locator('[data-usage-tab="projects"]').getAttribute('aria-selected'),'true');
console.log('PASS usage mouse and keyboard tabs');
await page.locator('[data-view="settings"]').click();await page.locator('select[name="theme"]').selectOption('dark');await page.locator('[data-web-settings-form] fluent-button[type="submit"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');console.log('PASS official form button submits theme');
await page.waitForTimeout(300);await page.screenshot({path:path.join(output, 'token-fluent-settings.png'),fullPage:true});
await page.locator('.settings-section-link').nth(1).click();assert.equal(await page.locator('.settings-sections > :visible').count(),1);console.log('PASS settings section switching');
for(const view of ['overview','usage','devices','limits','trends','management','settings']){await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(120);assert.equal(await page.locator('.error-card').count(),0,view);console.log('PASS route',view)}
await page.locator(".settings-section-link").first().click(); await page.locator('select[name="language"]').selectOption('zh-CN');await page.locator('[data-web-settings-form] fluent-button[type="submit"]').click();await page.waitForTimeout(100);await page.locator('[data-view="overview"]').click();await page.waitForTimeout(300);await page.screenshot({path:path.join(output, 'token-fluent-dark.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);assert.equal(await page.locator('#navigationPane').getAttribute('inert'),'');await page.locator('#menuToggle').click();assert.equal(await page.locator('.main').getAttribute('inert'),'');await page.locator('[data-view="usage"]').click();assert.equal(await page.locator('.main').getAttribute('inert'),null);await page.waitForTimeout(300);await page.screenshot({path:path.join(output, 'token-fluent-mobile.png'),fullPage:true});
console.log('WIDTH',await page.evaluate(()=>({doc:document.documentElement.scrollWidth,window:window.innerWidth})));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);console.log('PASS mobile navigation and width');
await page.locator('#menuToggle').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'),'false');
await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await page.locator('#menuToggle').click();await page.waitForTimeout(300);await page.screenshot({path:path.join(output, 'token-fluent-forced.png')});console.log('PASS forced colors/reduced motion render');
assert.deepEqual(errors,[]); await page.close();

}

{
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto(accountBase);await page.locator('#secretInput').locator('input').fill('fixture-only');await page.locator('#authForm fluent-button[type="submit"]').click();await page.waitForSelector('[data-view="accounts"]');await page.locator('[data-view="accounts"]').click();await page.waitForSelector('[data-account-form]');await page.locator('fluent-text-input[name="name"] input').fill('Browser fixture');await page.locator('fluent-text-input[name="apiKey"] input').fill('fixture-key');await page.screenshot({path:path.join(output, 'token-fluent-accounts.png'),fullPage:true});
await page.locator('fluent-button[data-account-mode="json"]').click();assert.equal(await page.locator('fluent-text-input[name="name"]').evaluate(e=>e.value),'Browser fixture');await page.locator('fluent-button[data-account-mode="simple"]').click();assert.equal(await page.locator('fluent-text-input[name="apiKey"]').evaluate(e=>e.value),'fixture-key');
const posted=page.waitForResponse(r=>r.url().endsWith('/api/accounts')&&r.request().method()==='POST');await page.locator('[data-account-form] fluent-button[type="submit"]').click();const response=await posted;assert.equal(response.status(),201);await page.waitForTimeout(300);assert.ok(await page.locator('[data-account-edit]').count());console.log('PASS auth, official text input labels/values, account draft across modes, validated form submit');
await page.locator('[data-view="management"]').click();await page.locator('[data-management-tab="pricing"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('.error-card').count(),0);console.log('PASS pricing permission and tab');assert.deepEqual(errors,[]);
}

{
const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('console',m=>console.log('console',m.type(),m.text()));page.on('requestfailed',r=>console.log('requestfailed',r.url(),r.failure()));page.on('pageerror',e=>{errors.push(e.stack);console.log(e.stack)});
const stats=await (await fetch(`${base}/api/stats`)).json();
await page.addInitScript(({stats})=>{
 let settings={language:'zh-CN',theme:'light',hubMode:'local',clients:'codex,claude',collectionIntervalMs:300000,reduceMotion:'system'};window.__patches=[];
 const noop=()=>()=>{};
 window.tokenMonitor={getAppInfo:async()=>({platform:'linux',version:'0.47.0-rev.4'}),getSettings:async()=>settings,updateSettings:async(patch)=>{window.__patches.push(patch);settings={...settings,...patch};return settings},prefsFromSettings:s=>s,prefsToSettingsPatch:p=>p,hasSecret:async()=>false,readFlag:()=>null,writeFlag(){},getCatalog:async()=>({}),onStatsPush:noop,onStreamStatus:noop,onRetry:noop,onSettingsPush:noop,getSnapshotMeta:async()=>null,getSyncHealth:async()=>null,
 request:async(path)=>({ok:true,data:path==='/api/stats'?stats:path==='/api/health'?{ok:true,secretRequired:false,capabilities:{hubAccounts:false}}:path==='/api/history'?{daily:[],summary:{}}:path==='/api/auth/session'?{scopes:['admin'],capabilities:{hubAccounts:false}}:{}})};
},{stats});
await page.goto(pathToFileURL(path.join(root, 'src/electron/renderer/index.html')).href);await page.waitForSelector('[data-view="settings"]');await page.locator('[data-view="settings"]').click();await page.waitForSelector('[data-desktop-group="collection"]',{state:'attached'});
const count=await page.locator('.settings-section-link').count();assert.ok(count>=11,`settings sections ${count}`);
for(let i=0;i<count;i++){await page.locator('.settings-section-link').nth(i).click();assert.equal(await page.locator('.settings-sections > :visible').count(),1)}
await page.locator('a[href="#settings-section-collection"]').click();await page.locator('[name="collectionIntervalMs"]').selectOption('600000');await page.locator('[name="collectionIntervalMs"]').dispatchEvent('change');await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.__patches)).at(-1).collectionIntervalMs,600000);console.log('PASS desktop section navigation and scoped settings patch');
await page.locator('a[href="#settings-section-appearance"]').click();await page.locator('[name="reduceMotion"]').selectOption('on');await page.waitForTimeout(100);assert.equal(await page.locator('html').getAttribute('data-motion'),'reduce');
await page.locator('a[href="#settings-section-sync"]').click();await page.screenshot({path:path.join(output, 'token-fluent-desktop-settings.png'),fullPage:true});
assert.equal(await page.evaluate(()=>document.querySelector('.main').scrollHeight>=document.querySelector('.main').clientHeight),true);
assert.deepEqual(errors,[]);console.log('PASS desktop file assets, IPC adapter, all settings reachable, reduced motion');
}


{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/stats', async route => {
    await gate;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture unavailable' }) });
  });
  await page.goto(base);
  await page.waitForSelector('fluent-spinner');
  assert.equal(await page.locator('#content').getAttribute('aria-busy'), 'true');
  release();
  await page.waitForSelector('[data-retry-dashboard]');
  await page.unroute('**/api/stats');
  await page.locator('[data-retry-dashboard]').click();
  await page.waitForSelector('[data-jump-tool]');
  console.log('PASS loading, error and retry recovery');
  for (const locale of ['en', 'zh-CN', 'zh-TW', 'ja', 'ko']) {
    await page.locator('[data-view="settings"]').click();
    await page.locator('.settings-section-link').first().click();
    await page.locator('select[name="language"]').selectOption(locale);
    await page.locator('[data-web-settings-form] fluent-button[type="submit"]').click();
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    assert.equal(await page.locator('.nav-group-label').allTextContents().then(items => items.some(item => item.startsWith('nav.'))), false);
  }
  await page.locator('select[name="theme"]').selectOption('light');
  await page.locator('[data-web-settings-form] fluent-button[type="submit"]').click();
  await page.locator('[data-view="overview"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, 'token-fluent-light.png'), fullPage: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}`);
  }
  console.log('PASS five locales and 320/390/768/1024/1440px layouts');
  await page.close();
}
  } finally { await browser.close(); await hub.stop(); await accounts.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
