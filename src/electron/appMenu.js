'use strict';

// Application menu.
//
// A normal desktop application is expected to have a menu bar: on macOS the
// first menu carries About/Services/Hide/Quit, and every platform expects
// standard Edit and View roles so clipboard shortcuts and zoom work. The
// widget-era build had no menu at all because it also hid from the Dock and the taskbar.

const { Menu, app, shell } = require('electron');

const REPOSITORY_URL = 'https://github.com/IGNGserver/token-monitor-suite';

/**
 * @param {object} deps
 * @param {() => BrowserWindow|null} deps.getWindow
 * @param {(viewId: string) => void} deps.openView       Navigate the renderer.
 * @param {() => Promise<object>} deps.checkForUpdates
 * @param {() => void} deps.openUserData
 * @param {(key: string, params?: object) => string} deps.translate
 * @param {string} deps.appVersion
 */
function createAppMenu(deps) {
  const isMac = process.platform === 'darwin';
  const t = (key, params) => {
    try {
      const value = deps.translate(key, params);
      return typeof value === 'string' && value ? value : key;
    } catch {
      return key;
    }
  };
  const template = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: t('menu.checkUpdates'),
          click: () => { void deps.checkForUpdates(); }
        },
        {
          label: t('menu.openDataFolder'),
          click: () => deps.openUserData()
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  template.push({
    label: t('menu.file'),
    submenu: [
      {
        label: t('nav.settings'),
        accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
        click: () => deps.openView('settings')
      },
      { type: 'separator' },
      ...(isMac
        ? [{ role: 'close' }]
        : [
          { role: 'close' },
          { type: 'separator' },
          { role: 'quit' }
        ])
    ]
  });

  template.push({
    label: t('menu.edit'),
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
        : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }])
    ]
  });

  template.push({
    label: t('menu.view'),
    submenu: [
      { label: t('nav.overview'), click: () => deps.openView('overview') },
      { label: t('nav.usage'), click: () => deps.openView('usage') },
      { label: t('nav.devices'), click: () => deps.openView('devices') },
      { label: t('nav.limits'), click: () => deps.openView('limits') },
      { label: t('nav.trends'), click: () => deps.openView('trends') },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forceReload' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      ...(isMac ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : [])
    ]
  });

  template.push({
    label: t('menu.window'),
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [{ type: 'separator' }, { role: 'front' }]
        : [{ role: 'close' }])
    ]
  });

  template.push({
    role: 'help',
    submenu: [
      {
        label: t('menu.repository'),
        click: () => { void shell.openExternal(REPOSITORY_URL); }
      },
      {
        label: t('menu.reportIssue'),
        click: () => { void shell.openExternal(`${REPOSITORY_URL}/issues`); }
      },
      ...(isMac
        ? []
        : [
          { type: 'separator' },
          {
            label: t('menu.checkUpdates'),
            click: () => { void deps.checkForUpdates(); }
          },
          {
            label: t('menu.openDataFolder'),
            click: () => deps.openUserData()
          },
          { type: 'separator' },
          { role: 'about' }
        ])
    ]
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { createAppMenu, REPOSITORY_URL };
