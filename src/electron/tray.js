'use strict';

const path = require('node:path');

const DEFAULT_TOOLTIP = 'Token Monitor';

function trayIcon({ iconPath, templateIconPath, platform, nativeImage }) {
  const sourcePath = platform === 'darwin' && templateIconPath
    ? templateIconPath
    : iconPath;
  const image = nativeImage.createFromPath(sourcePath);
  const resized = image.resize({
    ...(platform === 'darwin' ? { height: 20 } : { width: 20, height: 20 }),
    quality: 'best'
  });
  if (platform === 'darwin' && typeof resized.setTemplateImage === 'function') {
    resized.setTemplateImage(true);
  }
  return resized;
}

function translatedLabel(translate, key) {
  try {
    const value = typeof translate === 'function' ? translate(key) : '';
    return typeof value === 'string' && value.trim() ? value : key;
  } catch (_) {
    return key;
  }
}

function buildTrayMenuTemplate({ translate, onShowWindow, onOpenSettings, onQuit }) {
  return [
    {
      label: translatedLabel(translate, 'trayMenu.showWindow'),
      click: onShowWindow
    },
    {
      label: translatedLabel(translate, 'trayMenu.settings'),
      click: onOpenSettings
    },
    { type: 'separator' },
    {
      label: translatedLabel(translate, 'trayMenu.quit'),
      click: onQuit
    }
  ];
}

function createApplicationTray(options = {}) {
  const electronApi = options.electron || require('electron');
  const { Tray, Menu, nativeImage } = electronApi;
  const platform = options.platform || process.platform;
  const tray = new Tray(trayIcon({
    iconPath: options.iconPath,
    templateIconPath: options.templateIconPath,
    platform,
    nativeImage
  }));

  const showWindow = () => {
    const window = typeof options.getWindow === 'function' ? options.getWindow() : null;
    if (!window || window.isDestroyed?.()) return;
    if (window.isMinimized?.()) window.restore();
    window.show();
    window.focus?.();
  };
  const openSettings = () => {
    if (typeof options.onOpenSettings === 'function') options.onOpenSettings();
  };
  const quit = () => {
    if (typeof options.onQuit === 'function') options.onQuit();
  };
  const refreshMenu = () => {
    if (tray.isDestroyed?.()) return;
    tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate({
      translate: options.translate,
      onShowWindow: showWindow,
      onOpenSettings: openSettings,
      onQuit: quit
    })));
  };

  tray.setToolTip(options.tooltip || DEFAULT_TOOLTIP);
  refreshMenu();
  tray.on('click', showWindow);

  return { tray, refreshMenu, showWindow };
}

module.exports = {
  buildTrayMenuTemplate,
  createApplicationTray,
  trayIcon,
  TRAY_ICON_PATH: path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-token-monitor.png')
};
