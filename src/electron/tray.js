'use strict';

const path = require('node:path');
const {
  formatTrayText,
  isBarsTrayIconMode,
  isGeneratedTrayIconMode,
  pickUsageProviderId,
  pickWorstLimit
} = require('../shared/trayText');
const { translate: translateMessage } = require('./renderer/i18n');

const ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const TRAY_ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-token-monitor.png');
const trayMenuRefreshers = new WeakMap();

function buildTrayIcon(options = {}) {
  const platform = options.platform || process.platform;
  const nativeImage = options.nativeImage || require('electron').nativeImage;
  if (platform === 'darwin') {
    const image = nativeImage.createFromPath(TRAY_ICON_PATH).resize({ height: 20, quality: 'best' });
    image.setTemplateImage(true);
    return image;
  }
  return nativeImage.createFromPath(ICON_PATH).resize({ width: 20, height: 20 });
}

function trayUsagePeriod(contentMode) {
  if (contentMode === 'tokensAll' || contentMode === 'costAll' || contentMode === 'bothAll') return 'allTime';
  if (contentMode === 'tokens' || contentMode === 'cost' || contentMode === 'both') return 'today';
  return null;
}

function pickUsageTrayIconId(stats, contentMode = 'tokens', availableIconIds = []) {
  const periodKey = trayUsagePeriod(contentMode);
  if (!periodKey) return null;
  const metric = contentMode === 'cost' || contentMode === 'costAll' ? 'cost' : 'tokens';
  return pickUsageProviderId(stats, metric, periodKey, availableIconIds);
}

function shouldUseTemplateTrayIcon(id, platform = process.platform, showProviderBadge = false) {
  return platform === 'darwin' && (isGeneratedTrayIconMode(id) || !showProviderBadge);
}

const TRAY_CONTENT_MENU_ITEMS = [
  ['tokens', 'trayMenu.content.todayTokens'],
  ['cost', 'trayMenu.content.todayCost'],
  ['both', 'trayMenu.content.todayBoth'],
  ['tokensAll', 'trayMenu.content.totalTokens'],
  ['costAll', 'trayMenu.content.totalCost'],
  ['bothAll', 'trayMenu.content.totalBoth'],
  ['limitsAllSessions', 'trayMenu.content.aiToolLimits'],
  ['barsSession', 'trayMenu.content.sessionLimitBar'],
  ['barsWeekly', 'trayMenu.content.weeklyLimitBar'],
  ['barsAllSessions', 'trayMenu.content.allToolsLimitBars'],
  ['bars', 'trayMenu.content.lowestRemainingLimitBar'],
  ['icon', 'trayMenu.content.appIconOnly'],
  ['custom', 'trayMenu.content.custom']
];

const WINDOW_PRESENTATION_MENU_ITEMS = [
  ['tray', 'trayMenu.presentation.tray'],
  ['floating', 'trayMenu.presentation.floating'],
  ['normal', 'trayMenu.presentation.normal'],
  ['desktop', 'trayMenu.presentation.desktop']
];

const OPEN_VIEW_MENU_ITEMS = [
  ['home', 'views.home'],
  ['project', 'views.project'],
  ['session', 'views.session'],
  ['limits', 'views.limits'],
  ['trends', 'views.trends'],
  ['status', 'views.status']
];

function buildTrayMenuTemplate(options = {}) {
  const state = options.state || {};
  const presentation = state.trayMode ? 'tray' : state.windowBehavior;
  const callback = (name) => (typeof options[name] === 'function' ? options[name] : () => {});
  const t = (key, params) => {
    const translated = typeof options.translate === 'function' ? options.translate(key, params) : '';
    return translated && translated !== key ? translated : translateMessage('en', key, params);
  };
  return [
    {
      label: t(state.refreshing ? 'trayMenu.refreshing' : 'trayMenu.refreshNow'),
      enabled: !state.refreshing,
      click: callback('onRefresh')
    },
    {
      label: t('trayMenu.openView'),
      submenu: OPEN_VIEW_MENU_ITEMS.map(([value, labelKey]) => ({
        label: t(labelKey),
        enabled: state.viewEnabled?.[value] !== false,
        click: () => callback('onOpenView')(value)
      }))
    },
    { type: 'separator' },
    {
      label: t('trayMenu.trayDisplay'),
      submenu: TRAY_CONTENT_MENU_ITEMS.map(([value, labelKey]) => ({
        label: t(labelKey),
        type: 'radio',
        checked: state.trayContent === value,
        click: () => callback('onSetTrayContent')(value)
      }))
    },
    {
      label: t('trayMenu.windowPresentation'),
      submenu: WINDOW_PRESENTATION_MENU_ITEMS.map(([value, labelKey]) => ({
        label: t(labelKey),
        type: 'radio',
        checked: presentation === value,
        click: () => callback('onSetWindowPresentation')(value)
      }))
    },
    { type: 'separator' },
    { label: t('trayMenu.version', { version: state.appVersion || '' }), enabled: false },
    { label: t('trayMenu.settings'), click: callback('onOpenSettings') },
    { label: t('trayMenu.quit'), click: callback('onQuit') }
  ];
}

function createTray({
  getMenuState,
  onOpenSettings,
  onOpenView,
  onQuit,
  onRefresh,
  onSetTrayContent,
  onSetWindowPresentation,
  onToggle,
  translateMenu,
  platform = process.platform
}) {
  const { Tray, Menu } = require('electron');
  const tray = new Tray(buildTrayIcon({ platform }));
  tray.setToolTip('Token Monitor');

  const buildMenu = () => Menu.buildFromTemplate(buildTrayMenuTemplate({
    state: typeof getMenuState === 'function' ? getMenuState() : {},
    onOpenSettings,
    onOpenView,
    onQuit,
    onRefresh,
    onSetTrayContent,
    onSetWindowPresentation,
    translate: translateMenu
  }));

  const refreshMenu = () => {
    if (tray.isDestroyed?.()) return;
    tray.setContextMenu(buildMenu());
  };

  tray.on('click', () => onToggle(tray));
  if (platform === 'linux') {
    // Linux tray implementations do not consistently emit Electron's
    // right-click event. Binding the menu natively is the portable SNI path.
    refreshMenu();
    trayMenuRefreshers.set(tray, refreshMenu);
  } else {
    tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  }

  return tray;
}

function refreshTrayMenu(tray) {
  const refresh = trayMenuRefreshers.get(tray);
  if (typeof refresh === 'function') refresh();
}

function popoverBounds(tray, popoverWidth, popoverHeight) {
  const { screen } = require('electron');
  const trayBounds = tray?.getBounds?.() || { x: 0, y: 0, width: 0, height: 0 };
  const cursor = screen.getCursorScreenPoint();
  const anchor = trayBounds.width > 0
    ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y, height: trayBounds.height }
    : { x: cursor.x, y: cursor.y, height: 0 };
  const display = screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y });
  const wa = display.workArea;

  let x = Math.round(anchor.x - popoverWidth / 2);
  x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - popoverWidth - 4));

  let y;
  if (process.platform === 'darwin') {
    y = Math.round(anchor.y + (anchor.height || 0) + 4);
  } else {
    // Windows / Linux: tray icon usually sits near the bottom; open above.
    y = Math.round(anchor.y - popoverHeight - 8);
    if (y < wa.y + 4) y = Math.round(anchor.y + (anchor.height || 0) + 8);
  }
  y = Math.max(wa.y + 4, Math.min(y, wa.y + wa.height - popoverHeight - 4));

  return { x, y, width: popoverWidth, height: popoverHeight };
}

module.exports = {
  buildTrayIcon,
  buildTrayMenuTemplate,
  createTray,
  formatTrayText,
  isBarsTrayIconMode,
  pickUsageTrayIconId,
  pickWorstLimit,
  popoverBounds,
  refreshTrayMenu,
  shouldUseTemplateTrayIcon
};
