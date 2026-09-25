'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { createApplicationTray } = require('../../src/electron/tray');

class FakeTray extends EventEmitter {
  constructor(image) {
    super();
    this.image = image;
    this.menu = null;
    this.tooltip = '';
  }

  setContextMenu(menu) { this.menu = menu; }
  setToolTip(value) { this.tooltip = value; }
}

function fakeElectron() {
  return {
    Tray: FakeTray,
    Menu: { buildFromTemplate: (template) => template },
    nativeImage: {
      createFromPath: (sourcePath) => ({
        sourcePath,
        resize(options) { return { ...this, resizeOptions: options, setTemplateImage() {} }; }
      })
    }
  };
}

test('the tray carries the window, the pause switch, view jumps and quit', () => {
  const calls = [];
  const window = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus')
  };
  const labels = {
    'trayMenu.showWindow': 'Show window',
    'trayMenu.pauseCollection': 'Pause collection',
    'trayMenu.resumeCollection': 'Resume collection',
    'trayMenu.openView': 'Open view',
    'trayMenu.settings': 'Settings',
    'trayMenu.quit': 'Quit',
    'trayMenu.tooltipToday': 'Today {tokens} tokens',
    'nav.overview': 'Overview',
    'nav.limits': 'Limits',
    'nav.settings': 'Settings'
  };
  let paused = false;
  const handle = createApplicationTray({
    electron: fakeElectron(),
    platform: 'win32',
    iconPath: '/tmp/token-monitor.png',
    getWindow: () => window,
    onOpenSettings: () => calls.push('settings'),
    onQuit: () => calls.push('quit'),
    onOpenView: (view) => calls.push(`view:${view}`),
    isCollectionPaused: () => paused,
    onToggleCollectionPaused: () => { paused = true; handle.refreshMenu(); },
    tooltip: () => (paused ? 'Token Monitor · paused' : 'Token Monitor · today'),
    translate: (key) => labels[key] || key
  });

  assert.equal(handle.tray.tooltip, 'Token Monitor · today');
  assert.equal(handle.tray.image.sourcePath, '/tmp/token-monitor.png');
  assert.deepEqual(handle.tray.menu.map((item) => item.label || item.type), [
    'Show window', 'Pause collection', 'separator', 'Open view', 'Settings', 'separator', 'Quit'
  ]);
  assert.deepEqual(
    handle.tray.menu[3].submenu.map((item) => item.label),
    ['Overview', 'Limits', 'Settings'],
    'the tray reaches the views a hidden window cannot'
  );

  handle.tray.emit('click');
  handle.tray.menu[3].submenu[1].click();
  handle.tray.menu[4].click();
  handle.tray.menu[6].click();
  assert.deepEqual(calls, ['restore', 'show', 'focus', 'view:limits', 'settings', 'quit']);

  // Pausing must be visible in both the checkbox state and the tooltip, without
  // rebuilding the tray.
  handle.tray.menu[1].click();
  assert.equal(handle.tray.menu[1].checked, true);
  assert.equal(handle.tray.menu[1].label, 'Resume collection');
  assert.equal(handle.tray.tooltip, 'Token Monitor · paused');
});

test('macOS uses the template tray icon', () => {
  const handle = createApplicationTray({
    electron: fakeElectron(),
    platform: 'darwin',
    iconPath: '/tmp/app.png',
    templateIconPath: '/tmp/template.png',
    getWindow: () => null
  });
  assert.equal(handle.tray.image.sourcePath, '/tmp/template.png');
  assert.equal(handle.tray.image.resizeOptions.height, 20);
});
