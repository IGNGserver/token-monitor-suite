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

test('application tray restores the window and exposes settings and quit actions', () => {
  const calls = [];
  const window = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus')
  };
  const handle = createApplicationTray({
    electron: fakeElectron(),
    platform: 'win32',
    iconPath: '/tmp/token-monitor.png',
    getWindow: () => window,
    onOpenSettings: () => calls.push('settings'),
    onQuit: () => calls.push('quit'),
    translate: (key) => ({
      'trayMenu.showWindow': 'Show window',
      'trayMenu.settings': 'Settings',
      'trayMenu.quit': 'Quit'
    }[key] || key)
  });

  assert.equal(handle.tray.tooltip, 'Token Monitor');
  assert.equal(handle.tray.image.sourcePath, '/tmp/token-monitor.png');
  assert.deepEqual(handle.tray.menu.map((item) => item.label || item.type), ['Show window', 'Settings', 'separator', 'Quit']);

  handle.tray.emit('click');
  handle.tray.menu[1].click();
  handle.tray.menu[3].click();
  assert.deepEqual(calls, ['restore', 'show', 'focus', 'settings', 'quit']);
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
