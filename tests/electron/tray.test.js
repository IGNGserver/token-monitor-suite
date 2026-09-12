'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const zlib = require('node:zlib');

const {
  buildTrayIcon,
  buildTrayMenuTemplate,
  createTray,
  formatTrayText,
  pickUsageTrayIconId,
  refreshTrayMenu,
  shouldUseTemplateTrayIcon
} = require('../../src/electron/tray');
const { translate } = require('../../src/electron/renderer/i18n');
const {
  compactLimitSelection,
  isBarsTrayIconMode,
  isGeneratedTrayIconMode,
  pickConfiguredLimitProviders,
  pickConfiguredSessionLimits,
  pickLimitProviderByKindPriority,
  pickWorstLimitProvider
} = require('../../src/shared/trayText');

const stats = {
  periods: {
    today: {
      clients: { claude: 10, codex: 25 },
      clientCosts: { claude: 0.5, codex: 0.2 }
    },
    allTime: {
      clients: { claude: 100, codex: 40 },
      clientCosts: { claude: 1, codex: 2 }
    }
  }
};

function decodeRgbaScanlines(scanlines, width, height) {
  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const rows = [];
  let offset = 0;
  let previous = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = scanlines[offset++];
    const filtered = scanlines.subarray(offset, offset + rowBytes);
    offset += rowBytes;
    const row = Buffer.alloc(rowBytes);
    for (let i = 0; i < rowBytes; i += 1) {
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const up = previous[i];
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      const value = filtered[i];
      if (filter === 0) row[i] = value;
      else if (filter === 1) row[i] = (value + left) & 0xff;
      else if (filter === 2) row[i] = (value + up) & 0xff;
      else if (filter === 3) row[i] = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        row[i] = (value + predictor) & 0xff;
      } else throw new Error(`unsupported PNG filter ${filter}`);
    }
    rows.push(row);
    previous = row;
  }
  return rows;
}

test('fallback tray icon source stays transparent and high-resolution', () => {
  const icon = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-token-monitor.png'));
  assert.equal(icon.toString('ascii', 1, 4), 'PNG');
  assert.deepEqual([icon.readUInt32BE(16), icon.readUInt32BE(20)], [44, 44]);
  assert.equal(icon[25], 6, 'tray PNG should use RGBA color');
  assert.equal(icon[28], 0, 'tray PNG should not be interlaced');

  const idat = [];
  for (let offset = 8; offset < icon.length;) {
    const length = icon.readUInt32BE(offset);
    const type = icon.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(icon.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const scanlines = zlib.inflateSync(Buffer.concat(idat));
  const rows = decodeRgbaScanlines(scanlines, 44, 44);
  assert.equal(rows[0][3], 0, 'tray PNG corner should remain fully transparent');

  let visiblePixels = 0;
  for (const row of rows) {
    for (let x = 0; x < 44; x += 1) {
      const offset = x * 4;
      const alpha = row[offset + 3];
      if (alpha === 0) continue;
      visiblePixels += 1;
      assert.equal(row[offset], row[offset + 1], 'template icon must not contain a red tint');
      assert.equal(row[offset + 1], row[offset + 2], 'template icon must not contain a colored tint');
    }
  }
  assert.ok(visiblePixels > 0, 'tray PNG should contain the T mark');
});

test('macOS tray icon downsamples the high-resolution template like provider icons', () => {
  const calls = [];
  const resized = {
    setTemplateImage(value) { calls.push(['template', value]); }
  };
  const image = {
    resize(size) { calls.push(['resize', size]); return resized; }
  };

  assert.equal(buildTrayIcon({
    platform: 'darwin',
    nativeImage: {
      createFromPath(iconPath) {
        calls.push(['path', iconPath]);
        return image;
      }
    }
  }), resized);

  assert.match(calls[0][1], /assets[\\/]icons[\\/]tray-token-monitor\.png$/);
  assert.deepEqual(calls.slice(1), [
    ['resize', { height: 20, quality: 'best' }],
    ['template', true]
  ]);
});

test('non-macOS tray icon keeps the resized full-color app asset', () => {
  const calls = [];
  const resized = {};
  const image = {
    setTemplateImage(value) { calls.push(['template', value]); },
    resize(size) { calls.push(['resize', size]); return resized; }
  };

  assert.equal(buildTrayIcon({
    platform: 'win32',
    nativeImage: {
      createFromPath(iconPath) {
        calls.push(['path', iconPath]);
        return image;
      }
    }
  }), resized);

  assert.match(calls[0][1], /assets[\\/]icon\.png$/);
  assert.deepEqual(calls.slice(1), [['resize', { width: 20, height: 20 }]]);
});

test('Linux trays bind the context menu and refresh its state without right-click events', () => {
  const nativeImage = { createFromPath: () => ({ resize: () => ({}) }) };
  const fakeElectron = {
    Menu: { buildFromTemplate: (template) => ({ template }) },
    Tray: class FakeTray extends EventEmitter {
      constructor(icon) {
        super();
        this.icon = icon;
        this.contextMenus = [];
      }
      isDestroyed() { return false; }
      setContextMenu(menu) { this.contextMenus.push(menu); }
      setToolTip() {}
    },
    nativeImage
  };
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') return fakeElectron;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    let state = { appVersion: '1.0.0', trayContent: 'tokens', trayMode: true, windowBehavior: 'floating' };
    const tray = createTray({ platform: 'linux', getMenuState: () => state, onToggle: () => {} });
    assert.equal(tray.contextMenus.length, 1);
    assert.equal(tray.contextMenus[0].template[0].enabled, true);
    assert.equal(tray.listenerCount('right-click'), 0);

    state = { ...state, refreshing: true };
    refreshTrayMenu(tray);
    assert.equal(tray.contextMenus.length, 2);
    assert.equal(tray.contextMenus[1].template[0].enabled, false);
  } finally {
    Module._load = originalLoad;
  }
});

test('tray context menu complements the primary click with useful commands', () => {
  const calls = [];
  const template = buildTrayMenuTemplate({
    state: { appVersion: '0.27.0', trayContent: 'both', trayMode: true, windowBehavior: 'floating' },
    onRefresh: () => calls.push(['refresh']),
    onOpenView: (value) => calls.push(['view', value]),
    onSetTrayContent: (value) => calls.push(['content', value]),
    onSetWindowPresentation: (value) => calls.push(['presentation', value]),
    onOpenSettings: () => calls.push(['settings']),
    onQuit: () => calls.push(['quit'])
  });

  assert.deepEqual(template.map((item) => item.label || item.type), [
    'Refresh Now', 'Open View', 'separator', 'Tray Display', 'Window Presentation', 'separator', 'Version 0.27.0', 'Settings…', 'Quit Token Monitor'
  ]);
  assert.equal(template.some((item) => item.label === 'Show / Hide'), false);
  assert.equal(template[3].submenu.find((item) => item.label === 'Today Tokens + Cost').checked, true);
  assert.equal(template[4].submenu.find((item) => item.label === 'Tray Popover').checked, true);

  template[0].click();
  template[1].submenu.find((item) => item.label === 'Projects').click();
  template[3].submenu.find((item) => item.label === 'App Icon Only').click();
  template[4].submenu.find((item) => item.label === 'Desktop Pinned').click();
  assert.equal(template[6].enabled, false);
  template[7].click();
  template[8].click();
  assert.deepEqual(calls, [
    ['refresh'], ['view', 'project'], ['content', 'icon'], ['presentation', 'desktop'], ['settings'], ['quit']
  ]);
});

test('tray context menu exposes refresh progress and current window mode', () => {
  const template = buildTrayMenuTemplate({
    state: { refreshing: true, trayContent: 'tokens', trayMode: false, windowBehavior: 'desktop' }
  });

  assert.equal(template[0].label, 'Refreshing…');
  assert.equal(template[0].enabled, false);
  assert.equal(template[4].submenu.find((item) => item.label === 'Desktop Pinned').checked, true);
  assert.equal(template[4].submenu.find((item) => item.label === 'Tray Popover').checked, false);
});

test('tray context menu uses the selected locale for every visible level', () => {
  const template = buildTrayMenuTemplate({
    state: { appVersion: '0.27.0', trayContent: 'tokens', trayMode: true, windowBehavior: 'floating' },
    translate: (key, params) => translate('zh-TW', key, params)
  });

  assert.deepEqual(template.map((item) => item.label || item.type), [
    '立即重新整理', '開啟頁面', 'separator', '托盤顯示', '視窗呈現方式', 'separator', '版本 0.27.0', '設定…', '結束 Token Monitor'
  ]);
  assert.equal(template[1].submenu[0].label, '主頁');
  assert.equal(template[3].submenu[0].label, '今日 Tokens');
  assert.deepEqual(template[3].submenu.slice(-2).map((item) => item.label), [
    '僅顯示 App 圖示',
    '自訂'
  ]);
  assert.equal(template[4].submenu[0].label, '托盤彈出視窗');
  assert.equal(template[4].submenu.at(-1).label, '固定於桌面');
});

test('tray context menu disables unavailable views', () => {
  const template = buildTrayMenuTemplate({
    state: {
      trayContent: 'tokens',
      trayMode: true,
      viewEnabled: { project: false, limits: false, trends: false }
    }
  });

  assert.equal(template[1].submenu.find((item) => item.label === 'Projects').enabled, false);
  assert.equal(template[1].submenu.find((item) => item.label === 'Sessions').enabled, true);
});

test('tray main-process actions surface refresh errors and expand a collapsed bubble before tray mode', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/electron/main.js'), 'utf8');
  assert.match(source, /async function refreshFromTray[\s\S]*?catch \(error\)[\s\S]*?showTrayRefreshError\(error\?\.message \|\| error\)/);
  assert.match(source, /if \(value === 'tray'\)[\s\S]*?saveSettings\(\);\s*syncFloatingBubbleAvailability\(\);\s*enterTrayMode\(\);/);
});

test('usage tray icon picks the top token client for day and total token modes', () => {
  assert.equal(pickUsageTrayIconId(stats, 'tokens', ['claude', 'codex']), 'codex');
  assert.equal(pickUsageTrayIconId(stats, 'both', ['claude', 'codex']), 'codex');
  assert.equal(pickUsageTrayIconId(stats, 'tokensAll', ['claude', 'codex']), 'claude');
  assert.equal(pickUsageTrayIconId(stats, 'bothAll', ['claude', 'codex']), 'claude');
});

test('usage tray icon picks the top cost client for day and total cost modes', () => {
  assert.equal(pickUsageTrayIconId(stats, 'cost', ['claude', 'codex']), 'claude');
  assert.equal(pickUsageTrayIconId(stats, 'costAll', ['claude', 'codex']), 'codex');
});

test('usage tray icon falls back to token usage when cost breakdown is unavailable', () => {
  assert.equal(
    pickUsageTrayIconId({ periods: { today: { clients: { claude: 3, codex: 9 } } } }, 'cost', ['claude', 'codex']),
    'codex'
  );
});

test('usage tray icon leaves pure icon and bar modes to their existing icon paths', () => {
  assert.equal(pickUsageTrayIconId(stats, 'icon', ['claude', 'codex']), null);
  assert.equal(pickUsageTrayIconId(stats, 'bars', ['claude', 'codex']), null);
  assert.equal(pickUsageTrayIconId(stats, 'barsSession', ['claude', 'codex']), null);
});

test('usage tray icon returns null when the top client has no available icon', () => {
  assert.equal(
    pickUsageTrayIconId({ periods: { today: { clients: { unknown: 20, codex: 10 } } } }, 'tokens', ['codex']),
    null
  );
});

test('macOS templates provider icons unless the colored badge is enabled', () => {
  for (const id of ['bars', 'barsSession', 'barsWeekly', 'barsAllSessions', 'limitsAllSessions', 'custom']) {
    assert.equal(isGeneratedTrayIconMode(id), true, `${id} should be classified as a generated image`);
    assert.equal(shouldUseTemplateTrayIcon(id, 'darwin', false), true, `${id} should follow the menu bar tint`);
    assert.equal(shouldUseTemplateTrayIcon(id, 'darwin', true), true, `${id} should stay a generated template`);
  }
  assert.equal(isBarsTrayIconMode('limitsAllSessions'), false);
  assert.equal(isBarsTrayIconMode('barsWeekly'), true);
  for (const id of ['codex', 'antigravity', 'claude']) {
    assert.equal(isGeneratedTrayIconMode(id), false, `${id} should be classified as a provider image`);
    assert.equal(shouldUseTemplateTrayIcon(id, 'darwin', false), true, `${id} should preserve the default template behavior`);
    assert.equal(shouldUseTemplateTrayIcon(id, 'darwin', true), false, `${id} should preserve its colored badge`);
  }
  assert.equal(shouldUseTemplateTrayIcon('bars', 'win32'), false);
  assert.equal(shouldUseTemplateTrayIcon('bars', 'linux'), false);
});

test('tray can show the first two configured session quotas as percentages', () => {
  const limitStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', windows: [{ kind: 'session', remainingPercent: 57 }] },
        { provider: 'claude', status: 'ok', windows: [{ kind: 'session', remainingPercent: 24 }] },
        { provider: 'cursor', status: 'ok', windows: [{ kind: 'session', remainingPercent: 91 }] }
      ]
    }
  };

  assert.equal(
    formatTrayText(limitStats, 'limitsAllSessions', 'USD', {
      limitProviderOrder: 'claude,codex,cursor',
      limitProviders: 'claude,codex,cursor',
      showLimitUsed: false
    }),
    '24% · 57%'
  );
});

test('configured session quota picks keep provider ids for icon rendering', () => {
  const limitStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', windows: [{ kind: 'session', remainingPercent: 57 }] },
        { provider: 'claude', status: 'ok', windows: [{ kind: 'session', remainingPercent: 24 }] },
        { provider: 'cursor', status: 'ok', windows: [{ kind: 'session', remainingPercent: 91 }] }
      ]
    }
  };

  assert.deepEqual(
    pickConfiguredSessionLimits(limitStats, {
      limitProviderOrder: 'claude,codex,cursor',
      limitProviders: 'claude,codex,cursor',
      showLimitUsed: false
    }).map((pick) => [pick.provider, pick.percent]),
    [['claude', 24], ['codex', 57]]
  );
});

test('tray session quota text falls back to one provider session and weekly windows', () => {
  const limitStats = {
    limits: {
      providers: [
        {
          provider: 'codex',
          status: 'ok',
          windows: [
            { kind: 'session', remainingPercent: 6, usedPercent: 94 },
            { kind: 'weekly', remainingPercent: 1, usedPercent: 99 }
          ]
        },
        { provider: 'claude', status: 'notConfigured', windows: [] }
      ]
    }
  };

  assert.equal(
    formatTrayText(limitStats, 'limitsAllSessions', 'USD', {
      limitProviderOrder: 'codex,claude',
      limitProviders: 'codex,claude',
      showLimitUsed: false
    }),
    '6% · 1%'
  );
  assert.equal(
    formatTrayText(limitStats, 'limitsAllSessions', 'USD', {
      limitProviderOrder: 'codex,claude',
      limitProviders: 'codex,claude',
      showLimitUsed: true
    }),
    '94% · 99%'
  );
});

test('tray session quota text omits an unavailable weekly window', () => {
  const limitStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', windows: [{ kind: 'session', remainingPercent: 6 }] }
      ]
    }
  };

  assert.equal(
    formatTrayText(limitStats, 'limitsAllSessions', 'USD', {
      limitProviderOrder: 'codex',
      limitProviders: 'codex',
      showLimitUsed: false
    }),
    '6%'
  );
});

test('tray primary quota modes promote a weekly-only provider', () => {
  const limitStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', windows: [{ kind: 'weekly', remainingPercent: 64, usedPercent: 36 }] }
      ]
    }
  };

  const [pick] = pickConfiguredLimitProviders(limitStats, {
    limitProviderOrder: 'codex',
    limitProviders: 'codex'
  });
  assert.equal(pick.primaryWindow.kind, 'weekly');
  assert.equal(pick.secondaryWindow, null);
  assert.equal(formatTrayText(limitStats, 'limitsAllSessions', 'USD', {
    limitProviderOrder: 'codex',
    limitProviders: 'codex',
    showLimitUsed: false
  }), '64%');
  assert.equal(formatTrayText(limitStats, 'limitsAllSessions', 'USD', {
    limitProviderOrder: 'codex',
    limitProviders: 'codex',
    showLimitUsed: true
  }), '36%');
});

test('session bar mode falls back to weekly only when no session exists', () => {
  const weeklyOnlyStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', windows: [{ kind: 'weekly', remainingPercent: 82 }] },
        { provider: 'codex', status: 'ok', windows: [{ kind: 'weekly', remainingPercent: 4 }] }
      ]
    }
  };
  const mixedStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', windows: [{ kind: 'weekly', remainingPercent: 4 }] },
        { provider: 'claude', status: 'ok', windows: [{ kind: 'session', remainingPercent: 90 }] }
      ]
    }
  };

  const weeklyPick = pickLimitProviderByKindPriority(weeklyOnlyStats, ['session', 'weekly']);
  assert.equal(weeklyPick.provider, 'codex');
  assert.equal(weeklyPick.primaryWindow.kind, 'weekly');
  assert.equal(weeklyPick.primaryWindow.remainingPercent, 4);
  assert.equal(weeklyPick.secondaryWindow, null);

  const sessionPick = pickLimitProviderByKindPriority(mixedStats, ['session', 'weekly']);
  assert.equal(sessionPick.provider, 'claude');
  assert.equal(sessionPick.primaryWindow.kind, 'session');
});

test('configured provider account selection prefers session over fallback windows', () => {
  const limitStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', accountLabel: 'weekly', windows: [{ kind: 'weekly', remainingPercent: 5 }] },
        { provider: 'codex', status: 'ok', accountLabel: 'session', windows: [{ kind: 'session', remainingPercent: 80 }] }
      ]
    }
  };

  const [pick] = pickConfiguredLimitProviders(limitStats, {
    limitProviderOrder: 'codex',
    limitProviders: 'codex'
  });
  assert.equal(pick.providerRecord.accountLabel, 'session');
  assert.equal(pick.primaryWindow.kind, 'session');
});

test('configured provider selection preserves an explicit empty filter', () => {
  const limitStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', windows: [{ kind: 'weekly', remainingPercent: 25 }] }
      ]
    }
  };

  assert.deepEqual(pickConfiguredLimitProviders(limitStats, {
    limitProviderOrder: [],
    limitProviders: []
  }), []);
  assert.deepEqual(pickConfiguredLimitProviders(limitStats, {
    limitProviderOrder: '',
    limitProviders: ''
  }), []);
});

test('compact provider windows preserve Claude session plus general weekly', () => {
  const selection = compactLimitSelection({
    provider: 'claude',
    status: 'ok',
    windows: [
      { kind: 'session', remainingPercent: 70 },
      { kind: 'weekly', remainingPercent: 80 },
      { kind: 'weekly', label: 'Fable', remainingPercent: 5 }
    ]
  });

  assert.equal(selection.primaryWindow.kind, 'session');
  assert.equal(selection.secondaryWindow.remainingPercent, 80);
  assert.equal(selection.secondaryWindow.label, undefined);
});

test('compact provider windows use billing as a final fallback and ignore non-meter rows', () => {
  const selection = compactLimitSelection({
    provider: 'cursor',
    status: 'ok',
    windows: [
      { kind: 'billing', label: 'Total', remainingPercent: 72 },
      { kind: 'billing', label: 'API', remainingPercent: 4 },
      { kind: 'billing', label: 'Credits', remainingPercent: 1, showMeter: false }
    ]
  });

  assert.equal(selection.primaryWindow.label, 'Total');
  assert.equal(selection.secondaryWindow, null);
});

test('compact provider windows choose the lowest pool when no aggregate exists', () => {
  const selection = compactLimitSelection({
    provider: 'antigravity',
    status: 'ok',
    windows: [
      { kind: 'weekly', label: 'Gemini Pro', remainingPercent: 72 },
      { kind: 'weekly', label: 'Gemini Flash', remainingPercent: 0 },
      { kind: 'weekly', label: 'Claude', remainingPercent: 35 }
    ]
  });

  assert.equal(selection.primaryWindow.label, 'Gemini Flash');
  assert.equal(selection.primaryWindow.remainingPercent, 0);
});

test('compact window policy covers every supported limits provider shape', () => {
  const sessionWeekly = ['claude', 'codex', 'minimax', 'zai', 'zaiteam', 'volcengine', 'kimi', 'ollama'];
  const billing = ['cursor', 'mimo', 'grok', 'copilot', 'kiro', 'qoder'];

  for (const provider of sessionWeekly) {
    const selection = compactLimitSelection({
      provider,
      status: 'ok',
      windows: [{ kind: 'session', remainingPercent: 70 }, { kind: 'weekly', remainingPercent: 60 }]
    });
    assert.equal(selection.primaryWindow.kind, 'session', provider);
    assert.equal(selection.secondaryWindow.kind, 'weekly', provider);
  }

  for (const provider of billing) {
    const selection = compactLimitSelection({
      provider,
      status: 'ok',
      windows: [{ kind: 'billing', remainingPercent: 55 }]
    });
    assert.equal(selection.primaryWindow.kind, 'billing', provider);
    assert.equal(selection.secondaryWindow, null, provider);
  }

  const antigravity = compactLimitSelection({
    provider: 'antigravity',
    status: 'ok',
    windows: [{ kind: 'weekly', label: 'Gemini', remainingPercent: 45 }]
  });
  assert.equal(antigravity.primaryWindow.kind, 'weekly');
  assert.equal(antigravity.secondaryWindow, null);

  const opencode = compactLimitSelection({
    provider: 'opencode',
    status: 'ok',
    windows: [{ kind: 'session', remainingPercent: 40 }, { kind: 'weekly', remainingPercent: 30 }, { kind: 'billing', remainingPercent: 20 }]
  });
  assert.equal(opencode.primaryWindow.kind, 'session');
  assert.equal(opencode.secondaryWindow.kind, 'weekly');

  assert.equal(compactLimitSelection({ provider: 'deepseek', status: 'ok', windows: [] }), null);
});

test('worst-provider resolver returns the window it actually selected', () => {
  const weekly = { kind: 'weekly', remainingPercent: 12 };
  const limitStats = {
    limits: {
      providers: [
        { provider: 'claude', status: 'ok', windows: [{ kind: 'session', remainingPercent: 60 }, weekly] },
        { provider: 'codex', status: 'ok', windows: [{ kind: 'session', remainingPercent: 30 }] }
      ]
    }
  };

  const pick = pickWorstLimitProvider(limitStats, { kind: 'weekly' });
  assert.equal(pick.provider, 'claude');
  assert.equal(pick.selectedWindow, weekly);
  assert.equal(pick.secondaryWindow, weekly);
});

test('kind-specific resolver can select billing from a mixed-window provider', () => {
  const billing = { kind: 'billing', label: 'Monthly', remainingPercent: 9 };
  const pick = pickWorstLimitProvider({
    limits: {
      providers: [{
        provider: 'opencode',
        status: 'ok',
        windows: [
          { kind: 'session', remainingPercent: 80 },
          { kind: 'weekly', remainingPercent: 70 },
          billing
        ]
      }]
    }
  }, { kind: 'billing' });

  assert.equal(pick.selectedWindow, billing);
  assert.equal(pick.remaining, 9);
});

test('tray session quota text keeps lowest-remaining account selection when showing used percent', () => {
  const limitStats = {
    limits: {
      providers: [
        { provider: 'codex', status: 'ok', accountLabel: 'main', windows: [{ kind: 'session', remainingPercent: 80 }] },
        { provider: 'codex', status: 'ok', accountLabel: 'work', windows: [{ kind: 'session', remainingPercent: 30 }] },
        { provider: 'claude', status: 'ok', windows: [{ kind: 'session', remainingPercent: 40 }] }
      ]
    }
  };

  assert.equal(
    formatTrayText(limitStats, 'limitsAllSessions', 'USD', {
      limitProviderOrder: 'codex,claude',
      limitProviders: 'codex,claude',
      showLimitUsed: true
    }),
    '70% · 60%'
  );
});

test('tray cost text uses the selected display currency', () => {
  assert.equal(formatTrayText({ periods: { today: { costUsd: 1, totalTokens: 12_000 } } }, 'cost'), '$1.0000');
  assert.equal(formatTrayText({ periods: { today: { costUsd: 1, totalTokens: 12_000 } } }, 'cost', 'TWD'), 'NT$31.50');
  assert.equal(formatTrayText({ periods: { today: { costUsd: 1, totalTokens: 12_000 } } }, 'both', 'HKD'), '12.0K · HK$7.80');
});
