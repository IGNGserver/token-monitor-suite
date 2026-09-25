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

// The tray is the only surface that stays reachable while the window is hidden, so
// it carries the two things a user needs without a window: whether collection is
// running, and a way back into the app.
function buildTrayMenuTemplate({
  translate,
  onShowWindow,
  onOpenSettings,
  onOpenView,
  onQuit,
  onToggleCollectionPaused,
  isCollectionPaused = () => false
}) {
  const paused = isCollectionPaused() === true;
  return [
    {
      label: translatedLabel(translate, 'trayMenu.showWindow'),
      click: onShowWindow
    },
    {
      label: translatedLabel(translate, paused ? 'trayMenu.resumeCollection' : 'trayMenu.pauseCollection'),
      type: 'checkbox',
      checked: paused,
      click: () => {
        if (typeof onToggleCollectionPaused === 'function') onToggleCollectionPaused();
      }
    },
    { type: 'separator' },
    ...(onOpenView
      ? [{
          label: translatedLabel(translate, 'trayMenu.openView'),
          submenu: [
            { label: translatedLabel(translate, 'nav.overview'), click: () => onOpenView('overview') },
            { label: translatedLabel(translate, 'nav.limits'), click: () => onOpenView('limits') },
            { label: translatedLabel(translate, 'nav.settings'), click: () => onOpenView('settings') }
          ]
        }]
      : []),
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
  const openView = (viewId) => {
    if (typeof options.onOpenView === 'function') options.onOpenView(viewId);
  };
  const toggleCollectionPaused = () => {
    if (typeof options.onToggleCollectionPaused === 'function') options.onToggleCollectionPaused();
  };
  // The tooltip is the only always-visible tray surface, so the live numbers ride
  // on it. It takes a function so each refresh reads current state.
  const trayTooltip = () => {
    const value = typeof options.tooltip === 'function' ? options.tooltip() : options.tooltip;
    return String(value || '').trim() || DEFAULT_TOOLTIP;
  };
  const refreshMenu = () => {
    if (tray.isDestroyed?.()) return;
    tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate({
      translate: options.translate,
      onShowWindow: showWindow,
      onOpenSettings: openSettings,
      onOpenView: typeof options.onOpenView === 'function' ? openView : null,
      onQuit: quit,
      onToggleCollectionPaused: toggleCollectionPaused,
      isCollectionPaused: options.isCollectionPaused
    })));
    tray.setToolTip(trayTooltip());
  };

  tray.setToolTip(trayTooltip());
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
