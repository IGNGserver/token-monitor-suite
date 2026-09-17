import {
  clearSecret,
  fetchHealth,
  fetchJson,
  loadPrefs,
  loadSecret,
  openStatsStream,
  savePrefs,
  saveSecret
} from './api.js';
import { applyI18n, resolveLocale, t } from './i18n.js';
import {
  formatCompact,
  formatCost,
  formatNumber,
  formatRelative,
  formatReset,
  toDatetimeLocalValue
} from './format.js';
import {
  toolRows,
  mapRows,
  modelRows,
  projectRows,
  sessionRows,
  deviceRows,
  limitCards,
  historyDaily,
  clientLabel,
  clientIconPath,
  devicePlatformLabel,
  countActiveDays,
  heatmapValue,
  deviceBreakdownRows,
  agentRuntimeLabel,
  clientStatusEntries,
  wslStatusSummary,
  statusRows,
  limitRemainingTone,
  clampHomeLimitAccountCount,
  modelColor,
  HUB_ACCOUNT_PROVIDERS,
  periodTokenMetrics,
  periodActivityCounts
} from './data.js';

const UI_ICON_PATHS = Object.freeze({
  home: '<path d="M3.5 10.5 12 3l8.5 7.5v8a1 1 0 0 1-1 1h-5v-5h-5v5h-5a1 1 0 0 1-1-1z"/><path d="M8 20.5h8"/>',
  tool: '<path d="m14.7 6.3 3-3a4 4 0 0 0 1.1 4.9l-6.4 6.4-2-2 6.4-6.4a4 4 0 0 0-4.9-1.1z"/><path d="m11.4 13.6-6.7 6.7a1.4 1.4 0 0 1-2-2l6.7-6.7"/>',
  usage: '<path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/>',
  device: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h3M16 15h.01"/>',
  model: '<path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z"/>',
  project: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10l2 2h6.5A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5z"/>',
  session: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 12h5M8 15h7"/>',
  limits: '<path d="M5 19V9M12 19V5M19 19v-8"/><path d="M3 19h18"/>',
  accounts: '<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  status: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  trends: '<path d="M4 17 9 12l3 3 7-8"/><path d="M15 7h4v4"/>',
  subscriptions: '<path d="M5 7h14M5 12h14M5 17h8"/><path d="M17 16v4M15 18h4"/>',
  pricing: '<path d="M6 4h12M6 20h12M8 4c0 4 8 4 8 8s-8 4-8 8"/><path d="M16 4c0 4-8 4-8 8s8 4 8 8"/>',
  management: '<path d="M4 7h16M4 12h16M4 17h10"/><path d="M17 15v6M14 18h6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  back: '<path d="m15 5-7 7 7 7"/><path d="M8 12h12"/>',
  range: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M8 13h3M13 13h3M8 16h3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4L3 10"/><path d="M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14"/><path d="M21 19v-5h-5"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 12a2 2 0 0 1 2-2h.2a2 2 0 0 0 1.4-3.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 11.4 2h.2a2 2 0 0 1 2 2v.2A2 2 0 0 0 17 5.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 21.2 12a2 2 0 0 1-2 2H19a2 2 0 0 0-1.4 3.4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  warning: '<path d="m12 3 9 16H3z"/><path d="M12 9v4M12 16h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>'
});

function uiIcon(name) {
  const path = UI_ICON_PATHS[name] || UI_ICON_PATHS.status;
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
}

function renderStaticUiIcons() {
  document.querySelectorAll('[data-ui-icon]').forEach((element) => {
    element.innerHTML = uiIcon(element.dataset.uiIcon);
  });
}

const VIEWS = [
  { id: 'overview', icon: 'home' },
  { id: 'usage', icon: 'usage' },
  { id: 'devices', icon: 'device' },
  { id: 'limits', icon: 'limits' },
  { id: 'trends', icon: 'trends' },
  { id: 'accounts', icon: 'accounts' },
  { id: 'management', icon: 'management' },
  { id: 'settings', icon: 'settings' }
];

// Keep the old identifiers in the source and in the URL resolver so existing
// bookmarks, pinned shortcuts, and persisted preferences land on the new page
// without keeping the old 12-item navigation visible.
const LEGACY_VIEWS = [
  { id: 'home', icon: 'home' },
  { id: 'tool', icon: 'tool' },
  { id: 'device', icon: 'device' },
  { id: 'model', icon: 'model' },
  { id: 'project', icon: 'project' },
  { id: 'session', icon: 'session' },
  { id: 'status', icon: 'status' },
  { id: 'subscriptions', icon: 'subscriptions' },
  { id: 'pricing', icon: 'pricing' }
];

const PERIODS = ['today', 'month', 'allTime'];

const VIEW_PATHS = Object.freeze({
  overview: '/',
  usage: '/usage',
  devices: '/devices',
  limits: '/limits',
  accounts: '/accounts',
  trends: '/trends',
  management: '/management',
  settings: '/settings'
});

const LEGACY_ROUTE_ALIASES = Object.freeze({
  '/home': { view: 'overview' },
  '/tool': { view: 'usage', usageTab: 'tools' },
  '/tools': { view: 'usage', usageTab: 'tools' },
  '/model': { view: 'usage', usageTab: 'models' },
  '/models': { view: 'usage', usageTab: 'models' },
  '/project': { view: 'usage', usageTab: 'projects' },
  '/projects': { view: 'usage', usageTab: 'projects' },
  '/session': { view: 'usage', usageTab: 'sessions' },
  '/sessions': { view: 'usage', usageTab: 'sessions' },
  '/device': { view: 'devices' },
  '/status': { view: 'limits', limitTab: 'health' },
  '/subscriptions': { view: 'management', managementTab: 'subscriptions' },
  '/pricing': { view: 'management', managementTab: 'pricing' }
});

function normalizeViewId(value) {
  const id = String(value || '').trim();
  if (VIEWS.some((view) => view.id === id)) return id;
  if (!LEGACY_VIEWS.some((view) => view.id === id)) return 'overview';
  return LEGACY_ROUTE_ALIASES[`/${id}`]?.view || 'overview';
}

function routeFromLocation() {
  let path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  let params = new URLSearchParams(window.location.search || '');
  const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
  if (hash) {
    const hashUrl = hash.startsWith('/') ? hash : `/${hash}`;
    const queryIndex = hashUrl.indexOf('?');
    path = (queryIndex >= 0 ? hashUrl.slice(0, queryIndex) : hashUrl).replace(/\/+$/, '') || '/';
    params = new URLSearchParams(queryIndex >= 0 ? hashUrl.slice(queryIndex + 1) : '');
  }
  const target = LEGACY_ROUTE_ALIASES[path]
    || (Object.entries(VIEW_PATHS).find(([, targetPath]) => targetPath === path)
      ? { view: Object.entries(VIEW_PATHS).find(([, targetPath]) => targetPath === path)[0] }
      : null);
  if (!target) return { view: 'overview' };
  return {
    view: target.view,
    usageTab: ['tools', 'models', 'projects', 'sessions'].includes(params.get('tab'))
      ? params.get('tab')
      : target.usageTab,
    managementTab: ['subscriptions', 'pricing'].includes(params.get('tab'))
      ? params.get('tab')
      : target.managementTab,
    limitTab: params.get('tab') === 'health' || target.limitTab ? 'health' : 'limits'
  };
}

function viewFromLocation() {
  return routeFromLocation().view;
}

function syncUrlForView(viewId, { replace = false, tab = '' } = {}) {
  const targetPath = VIEW_PATHS[viewId] || '/';
  const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  try {
    const params = new URLSearchParams();
    const nextTab = tab || (viewId === 'usage'
      ? state?.prefs?.usageTab
      : viewId === 'management'
        ? state?.prefs?.managementTab
        : viewId === 'limits'
          ? (state?.prefs?.limitTab === 'health' ? 'health' : '')
          : '');
    if (nextTab && ((viewId === 'usage' && ['tools', 'models', 'projects', 'sessions'].includes(nextTab))
      || (viewId === 'management' && ['subscriptions', 'pricing'].includes(nextTab))
      || (viewId === 'limits' && nextTab === 'health'))) {
      params.set('tab', nextTab);
    }
    const query = params.toString();
    const url = `${targetPath}${query ? `?${query}` : ''}`;
    if (currentPath === targetPath && window.location.search === (query ? `?${query}` : '') && !window.location.hash) return;
    if (replace) {
      window.history.replaceState({ view: viewId }, '', url);
    } else {
      window.history.pushState({ view: viewId }, '', url);
    }
  } catch {
    /* ignore history errors if sandboxed */
  }
}

const els = {
  app: document.getElementById('app'),
  primaryNav: document.getElementById('primaryNav'),
  streamStatus: document.getElementById('streamStatus'),
  streamStatusText: document.getElementById('streamStatusText'),
  settingsOpen: document.getElementById('settingsOpen'),
  settingsOpenTop: document.getElementById('settingsOpenTop'),
  menuToggle: document.getElementById('menuToggle'),
  pwaBanner: document.getElementById('pwaBanner'),
  pwaBannerText: document.getElementById('pwaBannerText'),
  pwaInstallBtn: document.getElementById('pwaInstallBtn'),
  pwaDismissBtn: document.getElementById('pwaDismissBtn'),
  pageTitle: document.getElementById('pageTitle'),
  pageMeta: document.getElementById('pageMeta'),
  periodTabs: document.getElementById('periodTabs'),
  customRangeBtn: document.getElementById('customRangeBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  totalTokens: document.getElementById('totalTokens'),
  totalCost: document.getElementById('totalCost'),
  deviceCount: document.getElementById('deviceCount'),
  liveLabel: document.getElementById('liveLabel'),
  deviceFilter: document.getElementById('deviceFilter'),
  content: document.getElementById('content'),
  authGate: document.getElementById('authGate'),
  authForm: document.getElementById('authForm'),
  secretInput: document.getElementById('secretInput'),
  rememberSecret: document.getElementById('rememberSecret'),
  authError: document.getElementById('authError'),
  settingsDrawer: document.getElementById('settingsDrawer'),
  languageSelect: document.getElementById('languageSelect'),
  themeSelect: document.getElementById('themeSelect'),
  currencySelect: document.getElementById('currencySelect'),
  homeLimitAccountCount: document.getElementById('homeLimitAccountCount'),
  settingsSecret: document.getElementById('settingsSecret'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  aboutLine: document.getElementById('aboutLine'),
  rangePopover: document.getElementById('rangePopover'),
  rangeFrom: document.getElementById('rangeFrom'),
  rangeTo: document.getElementById('rangeTo'),
  rangeError: document.getElementById('rangeError'),
  rangeApply: document.getElementById('rangeApply'),
  rangeClear: document.getElementById('rangeClear'),
  rangeClose: document.getElementById('rangeClose'),
  toast: document.getElementById('toast'),
  navScrim: document.getElementById('navScrim'),
  heroStrip: document.getElementById('heroStrip')
};

const storedPrefs = loadPrefs();
const initialRoute = routeFromLocation();

const state = {
  prefs: {
    language: 'auto',
    theme: 'system',
    currency: 'USD',
    period: 'today',
    trendsRange: '30',
    trendsStack: 'client',
    trendsMetric: 'tokens',
    heatmapMetric: 'cost',
    activeDaysWindow: 'all',
    homeLimitAccountCount: 3,
    deviceFilter: '',
    selectedDeviceId: '',
    selectedToolId: '',
    deviceDetailPeriod: 'today',
    ...storedPrefs,
    view: initialRoute.view || viewFromLocation() || normalizeViewId(storedPrefs.view),
    usageTab: initialRoute.usageTab || storedPrefs.usageTab || 'tools',
    managementTab: initialRoute.managementTab || storedPrefs.managementTab || 'subscriptions',
    limitTab: initialRoute.limitTab || storedPrefs.limitTab || 'limits'
  },
  secret: loadSecret(),
  locale: 'en',
  health: null,
  authorization: null,
  stats: null,
  history: null,
  historyRequest: null,
  historyLoading: false,
  subscriptions: null,
  subscriptionsLoading: false,
  subscriptionsError: null,
  subscriptionsSaving: false,
  subscriptionsConflict: false,
  subscriptionsPending: null,
  subscriptionEditId: '',
  pricing: null,
  pricingLoading: false,
  pricingError: null,
  pricingSaving: false,
  accounts: null,
  accountsLoading: false,
  accountsError: null,
  accountsSaving: false,
  accountFormError: '',
  accountEditId: '',
  accountFormMode: 'simple',
  accountSelectedProvider: 'deepseek',
  accountProviderMenuOpen: false,
  oauthSession: null,
  oauthLoading: false,
  limitProvider: '',
  loading: true,
  error: null,
  customRange: null,
  customPeriod: null,
  stream: 'offline',
  stopStream: null,
  toastTimer: null,
  navOpen: false,
  overlayFocus: {
    settings: null,
    range: null
  },
  deferredInstall: null,
  formDrafts: new Map(),
  managementRequestSeq: {
    subscriptions: 0,
    pricing: 0,
    accounts: 0
  },
  managementControllers: {
    subscriptions: null,
    pricing: null,
    accounts: null
  },
  managementPromises: {
    subscriptions: null,
    pricing: null,
    accounts: null
  },
  pwaDismissed: localStorage.getItem('token-monitor.hub.pwaDismissed') === '1'
};

function tr(key, params) {
  return t(state.locale, key, params);
}

function viewStats() {
  const stats = state.stats;
  const deviceId = String(state.prefs.deviceFilter || '').trim();
  if (!stats || !deviceId) return stats;
  const device = (stats.devices || []).find((entry) => String(entry?.deviceId || '') === deviceId);
  if (!device) return stats;
  return {
    ...stats,
    devices: [device],
    periods: device.periods || {},
    // Limits are Hub-owned account data, not per-device usage. Keep the
    // top-level collection when a device filter is active.
    limits: stats.limits || { providers: [] },
    projectsIncomplete: Boolean(device.allTimeProjectsOmitted || device.allTimeProjectsIncomplete)
  };
}

function activePeriod() {
  if (state.customPeriod) return state.customPeriod;
  return viewStats()?.periods?.[state.prefs.period] || {
    totalTokens: 0,
    costUsd: 0,
    clients: {},
    clientCosts: {},
    models: {},
    modelCosts: {},
    projects: {},
    sessions: {}
  };
}

function formatDuration(milliseconds) {
  const totalMinutes = Math.max(0, Math.round(Number(milliseconds || 0) / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return remainder ? `${days}d ${remainder}h` : `${days}d`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

function setStreamStatus(status) {
  state.stream = status;
  const map = {
    connecting: 'status.connecting',
    retrying: 'status.retrying',
    live: 'status.live',
    disconnected: 'status.offline',
    offline: 'status.offline',
    unauthorized: 'status.unauthorized',
    error: 'status.error'
  };
  const live = status === 'live';
  els.streamStatus.dataset.state = live ? 'live' : (status === 'unauthorized' || status === 'error' ? 'error' : 'offline');
  els.streamStatusText.textContent = tr(map[status] || 'status.offline');
  els.liveLabel.textContent = live ? tr('stats.live.on') : tr('stats.live.off');
  if (live || status === 'unauthorized') els.streamStatus.title = '';
  if (status === 'unauthorized') showAuth(true);
}

function applyTheme() {
  const pref = state.prefs.theme || 'system';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    || document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0c0e' : '#f4f5f7');
}

function applyLocale() {
  state.locale = resolveLocale(state.prefs.language);
  document.documentElement.lang = state.locale;
  applyI18n(document, state.locale);
  renderChrome();
  render();
}

function showAuth(show) {
  els.authGate.classList.toggle('hidden', !show);
  if (show) {
    els.secretInput.value = state.secret || '';
    els.authError.classList.add('hidden');
    els.secretInput.focus();
  }
}

const OVERLAY_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function overlayFocusable(root) {
  if (!root) return [];
  return [...root.querySelectorAll(OVERLAY_FOCUSABLE)]
    .filter((element) => !element.hidden && !element.closest('[hidden], .hidden'));
}

function restoreOverlayFocus(key) {
  const opener = state.overlayFocus[key];
  state.overlayFocus[key] = null;
  if (!opener || !opener.isConnected || opener.disabled) return;
  opener.focus({ preventScroll: true });
}

function trapOverlayFocus(event) {
  const root = !els.rangePopover.classList.contains('hidden')
    ? els.rangePopover.querySelector('.popover-card')
    : !els.settingsDrawer.classList.contains('hidden')
      ? els.settingsDrawer.querySelector('.drawer-panel')
      : null;
  if (!root || event.key !== 'Tab') return false;
  const focusable = overlayFocusable(root);
  if (!focusable.length) {
    event.preventDefault();
    root.focus();
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

function openSettings(open) {
  const nextOpen = Boolean(open);
  const wasOpen = !els.settingsDrawer.classList.contains('hidden');
  if (nextOpen && !wasOpen) state.overlayFocus.settings = document.activeElement;
  els.settingsDrawer.classList.toggle('hidden', !nextOpen);
  els.settingsDrawer.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
  els.settingsOpen?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  els.settingsOpenTop?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  if (nextOpen) {
    els.languageSelect.value = state.prefs.language || 'auto';
    els.themeSelect.value = state.prefs.theme || 'system';
    els.currencySelect.value = state.prefs.currency || 'USD';
    if (els.homeLimitAccountCount) {
      els.homeLimitAccountCount.value = String(clampHomeLimitAccountCount(state.prefs.homeLimitAccountCount, 3));
    }
    els.settingsSecret.value = state.secret || '';
    els.languageSelect.focus({ preventScroll: true });
  } else if (wasOpen) {
    restoreOverlayFocus('settings');
  }
}


function isMobileNav() {
  return window.matchMedia('(max-width: 860px)').matches;
}

function openNav(open) {
  state.navOpen = Boolean(open) && isMobileNav();
  els.app.classList.toggle('nav-open', state.navOpen);
  document.body.classList.toggle('nav-open', state.navOpen);
  if (els.navScrim) els.navScrim.classList.toggle('hidden', !state.navOpen);
  if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', state.navOpen ? 'true' : 'false');
}

function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function pwaStatusText() {
  if (isStandaloneDisplay()) return tr('pwa.status.installed');
  if (!window.isSecureContext) return tr('pwa.status.insecure');
  if (!('serviceWorker' in navigator)) return tr('pwa.status.unsupported');
  if (state.deferredInstall) return tr('pwa.status.ready');
  return tr('pwa.status.hint');
}

function refreshPwaUi() {
  if (els.aboutLine) {
    const base = `Token Monitor hub web · ${state.health?.now ? new Date(state.health.now).toLocaleString(state.locale) : 'ready'}`;
    els.aboutLine.textContent = `${base} · ${pwaStatusText()}`;
  }
  if (!els.pwaBanner) return;
  const canPrompt = Boolean(state.deferredInstall) && !state.pwaDismissed && !isStandaloneDisplay();
  const showInsecureHint = !window.isSecureContext && !state.pwaDismissed && !isStandaloneDisplay() && isMobileNav();
  if (canPrompt) {
    if (els.pwaBannerText) els.pwaBannerText.textContent = tr('pwa.hint');
    if (els.pwaInstallBtn) els.pwaInstallBtn.classList.remove('hidden');
    els.pwaBanner.classList.remove('hidden');
  } else if (showInsecureHint) {
    if (els.pwaBannerText) els.pwaBannerText.textContent = tr('pwa.insecure');
    if (els.pwaInstallBtn) els.pwaInstallBtn.classList.add('hidden');
    els.pwaBanner.classList.remove('hidden');
  } else {
    els.pwaBanner.classList.add('hidden');
  }
}

function openRange(open) {
  const nextOpen = Boolean(open);
  const wasOpen = !els.rangePopover.classList.contains('hidden');
  if (nextOpen && !wasOpen) state.overlayFocus.range = document.activeElement;
  els.rangePopover.classList.toggle('hidden', !nextOpen);
  els.rangePopover.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
  els.customRangeBtn?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  if (nextOpen) {
    const now = new Date();
    const start = state.customRange?.from
      ? new Date(state.customRange.from)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = state.customRange?.to ? new Date(state.customRange.to) : now;
    els.rangeFrom.value = toDatetimeLocalValue(start);
    els.rangeTo.value = toDatetimeLocalValue(end);
    els.rangeError.classList.add('hidden');
    els.rangeFrom.focus({ preventScroll: true });
  } else if (wasOpen) {
    restoreOverlayFocus('range');
  }
}

function viewUsesUsageScope(view = state.prefs.view) {
  return ['overview', 'usage', 'devices', 'trends'].includes(view);
}

function viewKicker(view = state.prefs.view) {
  if (view === 'settings') return tr('settings.webOnly');
  if (view === 'limits') return tr('limits.health');
  return tr('page.overview.kicker');
}

function viewDescription(view = state.prefs.view) {
  return tr(`page.${view}.description`);
}

function renderChrome() {
  const capabilities = state.authorization?.capabilities || state.health?.capabilities || {};
  const admin = state.authorization?.scopes?.includes('admin');
  const visibleViews = VIEWS.filter((view) => {
    if (view.id === 'accounts') return capabilities.hubAccounts !== false;
    if (view.id === 'management') return capabilities.subscriptions !== false || (capabilities.pricing !== false && admin);
    return true;
  });
  if (!visibleViews.some((view) => view.id === state.prefs.view)) state.prefs.view = 'overview';
  els.primaryNav.innerHTML = visibleViews.map((view) => `
    <button type="button" class="nav-btn ${state.prefs.view === view.id ? 'active' : ''}" data-view="${view.id}">
      <span class="nav-ico">${uiIcon(view.icon)}</span>
      <span class="nav-label">${tr(`nav.${view.id}`)}</span>
    </button>
  `).join('');
  const scoped = viewUsesUsageScope();
  els.deviceFilter?.closest('.device-filter')?.classList.toggle('hidden', !scoped);
  els.periodTabs?.classList.toggle('hidden', !scoped);
  els.customRangeBtn?.classList.toggle('hidden', !scoped || capabilities.usageRange === false);

  els.periodTabs.innerHTML = [
    ...PERIODS.map((period) => `
      <button type="button" role="tab" aria-selected="${!state.customPeriod && state.prefs.period === period ? 'true' : 'false'}" class="period-tab ${!state.customPeriod && state.prefs.period === period ? 'active' : ''}" data-period="${period}">
        ${tr(`period.${period}`)}
      </button>
    `),
    state.customPeriod ? `<button type="button" role="tab" aria-selected="true" class="period-tab active" data-period="custom">${tr('period.custom')}</button>` : ''
  ].join('');

  els.pageTitle.textContent = tr(`nav.${state.prefs.view}`);
  const allDevices = state.stats?.devices || [];
  const devices = allDevices.length;
  const periodLabel = state.customPeriod
    ? tr('period.custom')
    : tr(`period.${state.prefs.period}`);
  const selectedDevice = allDevices.find((device) => device.deviceId === state.prefs.deviceFilter);
  const selectedLabel = selectedDevice ? ` · ${selectedDevice.hostname || selectedDevice.deviceId}` : '';
  const scopeMeta = scoped ? `${periodLabel} · ${devices} ${tr('stats.devices').toLowerCase()}${selectedLabel}` : '';
  const desc = viewDescription();
  const kicker = viewKicker();
  els.pageMeta.textContent = scoped
    ? [desc, scopeMeta].filter(Boolean).join(' · ')
    : (kicker ? `${kicker} · ${desc}` : desc);
  if (els.deviceFilter) {
    const current = state.prefs.deviceFilter || '';
    els.deviceFilter.innerHTML = [
      `<option value="">${escapeHtml(tr('filters.allDevices'))}</option>`,
      ...allDevices.map((device) => `<option value="${escapeHtml(device.deviceId || '')}">${escapeHtml(device.hostname || device.deviceId || tr('devices.title'))}</option>`)
    ].join('');
    els.deviceFilter.value = allDevices.some((device) => device.deviceId === current) ? current : '';
  }
  refreshPwaUi();
}

function rowHtml(row, { showIcon = false, sub } = {}) {
  const icon = showIcon && row.client
    ? `<img class="client-icon" src="${clientIconPath(row.client)}" alt="" onerror="this.style.display='none'" />`
    : (showIcon
      ? `<img class="client-icon" src="${clientIconPath(row.key)}" alt="" onerror="this.style.display='none'" />`
      : `<span class="swatch" style="background:${row.color}"></span>`);
  return `
    <div class="row">
      <div class="row-main">
        ${icon}
        <div class="row-copy">
          <div class="row-name">${escapeHtml(row.name)}</div>
          ${sub || row.sub ? `<div class="row-sub">${escapeHtml(sub || row.sub)}</div>` : ''}
        </div>
      </div>
      <div class="row-metrics">
        <div class="row-value">${formatNumber(row.value)}</div>
        <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
      </div>
    </div>
  `;
}

function emptyHtml(key) {
  return `<div class="empty-card">${tr(key)}</div>`;
}

function panel(title, body, meta = '', action = '') {
  return `
    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">${escapeHtml(title)}</h2>
        ${action || (meta ? `<div class="panel-meta tiny">${escapeHtml(meta)}</div>` : '')}
      </div>
      ${body}
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function draftKeyForForm(form) {
  return String(form?.dataset?.draftKey || '').trim();
}

function formFieldSnapshot(form) {
  const fields = {};
  form?.querySelectorAll?.('[name]').forEach((control) => {
    const name = String(control.name || '').trim();
    if (!name || name === 'provider' || name === 'oauthSessionId') return;
    if (control.type === 'checkbox' || control.type === 'radio') {
      fields[name] = { checked: Boolean(control.checked) };
    } else if (control.multiple) {
      fields[name] = { value: [...control.selectedOptions].map((option) => option.value) };
    } else {
      fields[name] = { value: control.value };
    }
  });
  return fields;
}

function rememberFormDraft(target) {
  const form = target?.closest?.('form[data-draft-key]');
  const key = draftKeyForForm(form);
  if (!form || !key) return;
  const hasTopUpLedger = Boolean(form.querySelector('[data-topup-ledger]'));
  const previous = state.formDrafts.get(key);
  const topUpRows = [...form.querySelectorAll('[data-topup-row]')].map((row) => ({
    id: row.getAttribute('data-topup-id') || '',
    date: row.querySelector('[data-topup-date]')?.value || '',
    amount: row.querySelector('[data-topup-amount]')?.value || ''
  }));
  state.formDrafts.set(key, {
    dirty: true,
    fields: formFieldSnapshot(form),
    topUpRows: hasTopUpLedger ? topUpRows : (previous?.topUpRows || []),
    topUpRowsPresent: hasTopUpLedger || Boolean(previous?.topUpRowsPresent)
  });
}

function clearFormDraft(key) {
  if (key) state.formDrafts.delete(String(key));
}

function hasDirtyFormDraft(prefix) {
  return [...state.formDrafts.entries()].some(([key, draft]) => key.startsWith(prefix) && draft?.dirty);
}

function restoreFormDrafts() {
  els.content.querySelectorAll('form[data-draft-key]').forEach((form) => {
    const draft = state.formDrafts.get(draftKeyForForm(form));
    if (!draft?.dirty || !draft.fields) return;
    for (const control of form.querySelectorAll('[name]')) {
      const name = String(control.name || '').trim();
      const value = draft.fields[name];
      if (!name || !value || name === 'provider' || name === 'oauthSessionId') continue;
      if (control.type === 'checkbox' || control.type === 'radio') {
        control.checked = Boolean(value.checked);
      } else if (control.multiple && Array.isArray(value.value)) {
        const selected = new Set(value.value);
        for (const option of control.options) option.selected = selected.has(option.value);
      } else if (value.value !== undefined) {
        control.value = value.value;
      }
    }
  });
}

function describeActiveElement(element) {
  if (!element || element === document.body || element === document.documentElement) return null;
  if (element.id) return { kind: 'id', id: element.id };
  const form = element.closest?.('form[data-draft-key]');
  if (form) {
    if (element.matches('[data-account-provider-trigger]')) return { kind: 'account-provider-trigger', key: draftKeyForForm(form) };
    if (element.matches('[data-account-provider-option]')) {
      return {
        kind: 'account-provider-option',
        key: draftKeyForForm(form),
        provider: element.getAttribute('data-account-provider-option') || ''
      };
    }
    if (element.name) {
      const controls = [...form.querySelectorAll('[name]')].filter((control) => control.name === element.name);
      return {
        kind: 'form-control',
        key: draftKeyForForm(form),
        name: element.name,
        index: Math.max(0, controls.indexOf(element)),
        selectionStart: typeof element.selectionStart === 'number' ? element.selectionStart : null,
        selectionEnd: typeof element.selectionEnd === 'number' ? element.selectionEnd : null,
        selectionDirection: element.selectionDirection || 'none'
      };
    }
  }
  const dataAttributes = [
    'data-view',
    'data-period',
    'data-select-tool',
    'data-select-device',
    'data-device-period',
    'data-stack',
    'data-range',
    'data-trends-metric'
  ];
  for (const attribute of dataAttributes) {
    if (element.hasAttribute?.(attribute)) return { kind: 'data', attribute, value: element.getAttribute(attribute) || '' };
  }
  return null;
}

function findActiveElement(snapshot) {
  if (!snapshot) return null;
  if (snapshot.kind === 'id') return document.getElementById(snapshot.id);
  if (snapshot.kind === 'account-provider-trigger') {
    return [...els.content.querySelectorAll('form[data-draft-key]')]
      .find((form) => draftKeyForForm(form) === snapshot.key)
      ?.querySelector('[data-account-provider-trigger]') || null;
  }
  if (snapshot.kind === 'account-provider-option') {
    const form = [...els.content.querySelectorAll('form[data-draft-key]')]
      .find((entry) => draftKeyForForm(entry) === snapshot.key);
    return [...(form?.querySelectorAll('[data-account-provider-option]') || [])]
      .find((option) => option.getAttribute('data-account-provider-option') === snapshot.provider) || null;
  }
  if (snapshot.kind === 'form-control') {
    const form = [...els.content.querySelectorAll('form[data-draft-key]')]
      .find((entry) => draftKeyForForm(entry) === snapshot.key);
    if (!form) return null;
    return [...form.querySelectorAll('[name]')]
      .filter((control) => control.name === snapshot.name)[snapshot.index] || null;
  }
  if (snapshot.kind === 'data') {
    return [...els.content.querySelectorAll(`[${snapshot.attribute}]`)]
      .find((element) => (element.getAttribute(snapshot.attribute) || '') === snapshot.value) || null;
  }
  return null;
}

function captureRenderState() {
  els.content.querySelectorAll('form[data-draft-key]').forEach((form) => {
    const key = draftKeyForForm(form);
    const draft = state.formDrafts.get(key);
    if (draft?.dirty) draft.fields = formFieldSnapshot(form);
  });
  const active = document.activeElement;
  return {
    active: describeActiveElement(active),
    scrollY: active && (active === els.content || els.content.contains(active)) ? window.scrollY : null
  };
}

function restoreRenderState(snapshot) {
  restoreFormDrafts();
  const active = findActiveElement(snapshot?.active);
  if (active && !active.disabled) {
    active.focus({ preventScroll: true });
    if (snapshot.active.kind === 'form-control'
      && typeof snapshot.active.selectionStart === 'number'
      && typeof active.setSelectionRange === 'function') {
      try {
        active.setSelectionRange(snapshot.active.selectionStart, snapshot.active.selectionEnd, snapshot.active.selectionDirection);
      } catch (_) {
        // Some input types reject selection ranges; focus preservation still applies.
      }
    }
  }
  if (typeof snapshot?.scrollY === 'number' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: snapshot.scrollY, behavior: 'auto' });
  }
}

function segButtons(options, current, dataAttr) {
  return options.map(([value, label]) => `
    <button type="button" class="seg-btn ${String(current) === String(value) ? 'active' : ''}" data-${dataAttr}="${value}">${label}</button>
  `).join('');
}

function shareBarHtml(rows) {
  if (!rows.length) return emptyHtml('empty.usage');
  return `<div class="stack">${rows.map((row) => `
    <div class="share-row">
      <div class="row">
        <div class="row-main">
          ${row.client || row.key
            ? `<img class="client-icon" src="${clientIconPath(row.client || row.key)}" alt="" onerror="this.style.display='none'" />`
            : `<span class="swatch" style="background:${row.color}"></span>`}
          <div class="row-copy">
            <div class="row-name">${escapeHtml(row.name)}</div>
            <div class="row-sub">${Math.round(row.percent || 0)}%</div>
          </div>
        </div>
        <div class="row-metrics">
          <div class="row-value">${formatNumber(row.value)}</div>
          <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
        </div>
      </div>
      <div class="share-meter"><span style="width:${Math.max(0, Math.min(100, row.percent || 0))}%; background:${row.color}"></span></div>
    </div>
  `).join('')}</div>`;
}

function renderHero() {
  const onHome = state.prefs.view === 'overview';
  if (els.heroStrip) {
    els.heroStrip.classList.toggle('hidden', !onHome);
  }
  if (!onHome) return;
  const period = activePeriod();
  const stats = viewStats();
  els.totalTokens.textContent = formatCompact(period.totalTokens || 0);
  els.totalTokens.title = formatNumber(period.totalTokens || 0);
  els.totalCost.textContent = formatCost(period.costUsd || 0, state.prefs.currency);
  els.deviceCount.textContent = formatNumber(stats?.devices?.length || 0);
}

function renderCompletenessNotice(stats, periodName) {
  if (!stats) return '';
  const notes = [];
  if (periodName === 'allTime' && stats.projectsIncomplete) notes.push(tr('data.projectsIncomplete'));
  const omittedSessions = Number(stats.sessionDetailsOmitted?.[periodName] || 0);
  if (omittedSessions > 0) notes.push(tr('data.sessionsOmitted', { count: omittedSessions }));
  const omittedProjects = Number(stats.periodProjectsOmitted?.[periodName] || 0);
  if (omittedProjects > 0) notes.push(tr('data.projectsOmitted', { count: omittedProjects }));
  if (!notes.length) return '';
  return `<div class="notice warn completeness-notice" role="status"><strong>${escapeHtml(tr('data.partial'))}</strong><span>${escapeHtml(notes.join(' '))}</span></div>`;
}

function renderHistoryScopeNotice() {
  const notices = [];
  if (state.prefs.deviceFilter) notices.push(tr('data.historyGlobal'));
  if (state.customPeriod) notices.push(tr('usage.customRangeGlobal'));
  return notices.length
    ? notices.map((notice) => `<div class="notice" role="status">${escapeHtml(notice)}</div>`).join('')
    : '';
}


function historySource() {
  return state.history || state.stats?.historyPreview || null;
}

function historyHasBreakdown(history) {
  return (history?.daily || []).some((day) => {
    const clients = day?.perClient && Object.keys(day.perClient).length > 0;
    const models = day?.perModel && Object.keys(day.perModel).length > 0;
    return Boolean(clients || models);
  });
}

function niceCeiling(value) {
  const n = Math.max(1, Number(value) || 1);
  const exp = Math.floor(Math.log10(n));
  const base = 10 ** exp;
  const mantissa = n / base;
  const nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return nice * base;
}

function yAxisScale(maxValue, tickCount = 4) {
  const top = niceCeiling(maxValue);
  const ticks = [];
  for (let i = 0; i <= tickCount; i += 1) ticks.push((top * i) / tickCount);
  return { top, ticks };
}

function renderYAxis({ pad, width, height, top, ticks }) {
  const innerH = height - pad.top - pad.bottom;
  const lines = ticks.map((value) => {
    const y = height - pad.bottom - (innerH * value) / Math.max(1, top);
    return `
      <line class="grid-line" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" />
      <text class="axis-label axis-y" x="${pad.left - 8}" y="${y + 3}" text-anchor="end">${escapeHtml(formatCompact(value))}</text>
    `;
  }).join('');
  return lines;
}

function tipText(parts) {
  return parts.filter(Boolean).join(' · ');
}

function renderHome() {
  const period = activePeriod();
  const stats = viewStats();
  const tools = toolRows(period).slice(0, 5);
  const models = modelRows(period).slice(0, 5);
  const devices = deviceRows(stats, state.customPeriod ? 'today' : state.prefs.period).slice(0, 5);
  const limits = limitCards(stats, state.locale).slice(0, clampHomeLimitAccountCount(state.prefs.homeLimitAccountCount, 3));
  const history = historySource();
  const daily = historyDaily(history, 14);
  const heatDaily = historyDaily(history, 90);
  const heatMetric = state.prefs.heatmapMetric === 'tokens' ? 'tokens' : 'cost';
  const activeDaysWindow = state.prefs.activeDaysWindow === 'year' ? 'year' : 'all';
  const summary = history?.summary || null;
  const displayActiveDays = countActiveDays(history?.daily || [], activeDaysWindow);
  const summaryActiveDays = Number(summary?.activeDays);
  const activeDaysValue = activeDaysWindow === 'year'
    ? displayActiveDays
    : (Number.isFinite(summaryActiveDays) ? summaryActiveDays : displayActiveDays);

  const totalTokens = Math.max(1, period.totalTokens || 0);

  // Tools: interactive visual proportion bars with client icons
  const toolsBody = tools.length
    ? `<div class="stack">${tools.map((row) => {
        const pct = Math.round((row.value / totalTokens) * 100);
        return `
          <button type="button" class="home-interactive-row" data-jump-view="tool" data-jump-tool="${escapeHtml(row.key)}">
            <div class="row">
              <div class="row-main">
                <img class="client-icon" src="${clientIconPath(row.key)}" alt="" onerror="this.style.display='none'" />
                <div class="row-copy">
                  <div class="row-name">${escapeHtml(row.name)}</div>
                  <div class="row-sub">${pct}% · ${formatCost(row.cost, state.prefs.currency)}</div>
                </div>
              </div>
              <div class="row-metrics">
                <div class="row-value">${formatCompact(row.value)}</div>
              </div>
            </div>
            <div class="share-meter"><span style="width:${Math.max(2, Math.min(100, pct))}%; background:${row.color}"></span></div>
          </button>
        `;
      }).join('')}</div>`
    : emptyHtml('empty.usage');

  // Models: interactive visual proportion bars with model colors
  const modelsBody = models.length
    ? `<div class="stack">${models.map((row) => {
        const pct = Math.round((row.value / totalTokens) * 100);
        return `
          <button type="button" class="home-interactive-row" data-jump-view="model" data-jump-usage-tab="models">
            <div class="row">
              <div class="row-main">
                <span class="swatch" style="background:${row.color}"></span>
                <div class="row-copy">
                  <div class="row-name">${escapeHtml(row.name)}</div>
                  <div class="row-sub">${pct}% · ${formatCost(row.cost, state.prefs.currency)}</div>
                </div>
              </div>
              <div class="row-metrics">
                <div class="row-value">${formatCompact(row.value)}</div>
              </div>
            </div>
            <div class="share-meter"><span style="width:${Math.max(2, Math.min(100, pct))}%; background:${row.color}"></span></div>
          </button>
        `;
      }).join('')}</div>`
    : emptyHtml('empty.usage');

  // Devices: cards with status & quick jump
  const devicesBody = devices.length
    ? `<div class="stack">${devices.map((row) => `
        <button type="button" class="home-interactive-row" data-jump-view="device" data-jump-device="${escapeHtml(row.key)}">
          <div class="row">
            <div class="row-main">
              <span class="swatch" style="background:${row.color}"></span>
              <div class="row-copy">
                <div class="row-name">${escapeHtml(row.name)}</div>
                <div class="row-sub">${row.platformDisplay || devicePlatformLabel(row.platform, row.osName, row.osVersion)}${row.stale ? ` · ${tr('devices.stale')}` : ''}</div>
              </div>
            </div>
            <div class="row-metrics">
              <div class="row-value">${formatCompact(row.value)}</div>
              <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
            </div>
          </div>
        </button>
      `).join('')}</div>`
    : emptyHtml('empty.usage');

  // Limits: graphical cards with progress bars and remaining tone
  const limitsBody = limits.length
    ? `<div class="home-limits-grid">${limits.map((card) => {
        const remaining = card.lowestRemaining;
        const tone = remaining == null ? 'unknown' : limitRemainingTone(remaining);
        const toneClass = `meter-${tone}`;
        const pct = remaining == null ? 0 : Math.max(0, Math.min(100, Math.round(remaining)));
        return `
          <button type="button" class="home-limit-card" data-jump-view="limits">
            <div class="home-limit-head">
              <div class="home-limit-identity">
                <img class="client-icon" src="${clientIconPath(card.provider)}" alt="" onerror="this.style.display='none'" />
                <span class="home-limit-name">${escapeHtml(card.name)}</span>
              </div>
              <span class="home-limit-val remaining-tone-${tone}">${remaining == null ? '—' : `${pct}%`}</span>
            </div>
            <div class="home-limit-bar ${toneClass}"><span style="width:${pct}%"></span></div>
            <div class="home-limit-sub">${escapeHtml(clientLabel(card.provider))}${card.plan ? ` · ${escapeHtml(card.plan)}` : ''}</div>
          </button>
        `;
      }).join('')}</div>`
    : emptyHtml('empty.limits');

  const activeTime = Number(summary?.activeTimeMs || 0);
  const completeness = renderCompletenessNotice(stats, state.prefs.period);

  const viewAllAction = (targetView) => `<button type="button" class="panel-head-action" data-jump-view="${targetView}"><span>${tr(`nav.${targetView}`)}</span>${uiIcon('arrowUpRight')}</button>`;

  const sparklineHeader = `
    <div class="home-sparkline-head">
      <div class="home-sparkline-pills">
        <div class="home-pill"><span class="home-pill-label">${tr('home.activeDays')}:</span><span class="home-pill-val">${formatNumber(activeDaysValue)}</span></div>
        <div class="home-pill"><span class="home-pill-label">${tr('home.streak')}:</span><span class="home-pill-val">${formatNumber(summary?.currentStreak || 0)}d</span></div>
        <div class="home-pill"><span class="home-pill-label">${tr('home.peakDay')}:</span><span class="home-pill-val">${formatCompact(summary?.peakDayTokens || 0)}</span></div>
        ${activeTime > 0 ? `<div class="home-pill"><span class="home-pill-label">${tr('home.activeTime')}:</span><span class="home-pill-val">${formatDuration(activeTime)}</span></div>` : ''}
      </div>
      ${viewAllAction('trends')}
    </div>
  `;

  const sparklineBlock = `
    ${sparklineHeader}
    ${renderSparkline(daily)}
  `;

  const heatmapBody = (summary || heatDaily.length)
    ? `
      <div class="toolbar-row">
        <div class="seg" role="group" aria-label="${tr('home.heatmapMetric')}">
          ${segButtons([['tokens', tr('stats.tokens')], ['cost', tr('stats.cost')]], heatMetric, 'heatmap-metric')}
        </div>
        <div class="seg" role="group" aria-label="${tr('home.activeDaysWindow')}">
          ${segButtons([['all', tr('home.activeDaysWindow.all')], ['year', tr('home.activeDaysWindow.year')]], activeDaysWindow, 'active-days-window')}
        </div>
      </div>
      ${renderHeatmap(heatDaily, heatMetric)}
    `
    : emptyHtml('empty.history');

  return `
    ${completeness}
    ${renderHistoryScopeNotice()}
    ${panel(tr('home.activity'), sparklineBlock, daily.length ? `${daily.length}d` : '')}
    <div class="grid-2">
      ${panel(tr('home.tools'), toolsBody, '', viewAllAction('tool'))}
      ${panel(tr('home.models'), modelsBody, '', viewAllAction('model'))}
      ${panel(tr('home.devices'), devicesBody, '', viewAllAction('device'))}
      ${panel(tr('home.limits'), limitsBody, '', viewAllAction('limits'))}
    </div>
    ${panel(tr('home.summary'), heatmapBody)}
  `;
}


function renderTools() {
  const period = activePeriod();
  const tools = toolRows(period).map((row) => ({ ...row, client: row.key }));
  if (!tools.length) return emptyHtml('empty.usage');
  const selectedId = state.prefs.selectedToolId || tools[0].key;
  const selected = tools.find((row) => row.key === selectedId) || tools[0];
  const modelMap = period?.clientModels?.[selected.key] || {};
  const modelCostMap = period?.clientModelCosts?.[selected.key] || {};
  const models = mapRows(modelMap, modelCostMap, {
    labelFor: (key) => key,
    colorFor: (key) => modelColor(key)
  });
  const toolList = tools.map((row) => {
    const active = row.key === selected.key ? ' selected' : '';
    return `
      <button type="button" class="tool-select-row${active}" data-select-tool="${escapeHtml(row.key)}">
        <div class="row-main">
          <img class="client-icon" src="${clientIconPath(row.key)}" alt="" onerror="this.style.display='none'" />
          <div class="row-copy">
            <div class="row-name">${escapeHtml(row.name)}</div>
            <div class="row-sub">${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%</div>
          </div>
        </div>
        <div class="row-side">
          <div class="row-value">${formatNumber(row.value)}</div>
          <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
        </div>
      </button>`;
  }).join('');

  return `
    <div class="grid-2 tools-layout">
      <section class="panel">
        <div class="panel-head"><h2 class="panel-title">${tr('nav.tool')}</h2></div>
        <div class="stack tool-select-list">${toolList}</div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${escapeHtml(selected.name)}</h2>
          <div class="panel-meta tiny">${tr('tools.models')}</div>
        </div>
        ${selected.metrics ? `<div class="usage-detail-label">${escapeHtml(tr('usage.breakdown'))}</div>${renderTokenMix(selected.metrics)}` : ''}
        <div class="usage-detail-label usage-detail-label-spaced">${escapeHtml(tr('usage.tabs.models'))}</div>
        ${models.length ? shareBarHtml(models.slice(0, 16)) : emptyHtml('empty.usage')}
      </section>
    </div>
  `;
}

function usageMetricCard(label, value, detail = '') {
  return `<div class="usage-metric-card"><span class="summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${detail ? `<span class="row-sub">${escapeHtml(detail)}</span>` : ''}</div>`;
}

function renderUsageMetricStrip(period) {
  const metrics = periodTokenMetrics(period);
  const counts = periodActivityCounts(period);
  const cacheRate = metrics.cacheHitPercent == null ? '—' : `${Math.round(metrics.cacheHitPercent)}%`;
  return `<div class="usage-metric-strip">
    ${usageMetricCard(tr('stats.tokens'), formatNumber(metrics.totalTokens), `${counts.tools} ${tr('usage.tabs.tools').toLowerCase()} · ${counts.models} ${tr('usage.tabs.models').toLowerCase()}`)}
    ${usageMetricCard(tr('usage.input'), formatNumber(metrics.inputTokens), `${formatNumber(metrics.uncachedInputTokens)} ${tr('usage.uncached').toLowerCase()}`)}
    ${usageMetricCard(tr('usage.output'), formatNumber(metrics.outputTokens))}
    ${usageMetricCard(tr('usage.cacheRate'), cacheRate, `${formatNumber(metrics.cacheReadTokens)} ${tr('usage.cacheRead').toLowerCase()}`)}
  </div>`;
}

function renderTokenMix(metrics = {}) {
  const values = [
    [tr('usage.input'), metrics.inputTokens, 'var(--accent)'],
    [tr('usage.output'), metrics.outputTokens, 'var(--good)'],
    [tr('usage.cacheRead'), metrics.cacheReadTokens, 'var(--warn)'],
    [tr('usage.cacheWrite'), metrics.cacheWriteTokens, 'var(--bad)'],
    [tr('usage.uncached'), metrics.uncachedInputTokens, 'var(--stale)']
  ];
  const total = Math.max(1, Number(metrics.totalTokens || 0));
  const visible = values.filter(([, value]) => Number(value || 0) > 0);
  if (!visible.length) return `<div class="usage-detail-empty muted tiny">${escapeHtml(tr('empty.usage'))}</div>`;
  return `<div class="token-mix" aria-label="${escapeHtml(tr('usage.breakdown'))}">
    ${visible.map(([label, value, color]) => {
      const amount = Number(value || 0);
      const percent = Math.max(2, Math.min(100, (amount / total) * 100));
      return `<div class="token-mix-row"><div class="token-mix-head"><span>${escapeHtml(label)}</span><strong>${formatNumber(amount)}</strong></div><div class="share-meter"><span style="width:${percent}%;background:${color}"></span></div></div>`;
    }).join('')}
  </div>`;
}

function renderUsageSubnav() {
  const current = ['tools', 'models', 'projects', 'sessions'].includes(state.prefs.usageTab)
    ? state.prefs.usageTab
    : 'tools';
  return `<nav class="page-tabs" aria-label="${escapeHtml(tr('nav.usage'))}" role="tablist">
    ${['tools', 'models', 'projects', 'sessions'].map((tab) => `<button type="button" role="tab" aria-selected="${current === tab ? 'true' : 'false'}" class="page-tab${current === tab ? ' active' : ''}" data-usage-tab="${tab}">${escapeHtml(tr(`usage.tabs.${tab}`))}</button>`).join('')}
  </nav>`;
}

function usageRowSummary(row, { icon = false, detail = '' } = {}) {
  const iconHtml = icon
    ? `<img class="client-icon" src="${clientIconPath(row.client || row.key)}" alt="" onerror="this.style.display='none'" />`
    : `<span class="swatch" style="background:${row.color || 'var(--accent)'}"></span>`;
  const suffix = row.percent != null ? ` · ${Math.round(row.percent)}%` : '';
  return `<div class="usage-table-row-main"><div class="row-main">${iconHtml}<div class="row-copy"><div class="row-name">${escapeHtml(row.name)}</div><div class="row-sub">${escapeHtml(`${row.sub || ''}${suffix}`.replace(/^ · | · $/g, ''))}</div></div></div><div class="row-metrics"><div class="row-value">${formatNumber(row.value)}</div><div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div></div>${detail ? `<span class="usage-row-chevron">${uiIcon('chevronDown')}</span>` : ''}</div>`;
}

function renderUsageMetricRows(rows, { kind, showIcon = false, emptyKey = 'empty.usage' } = {}) {
  if (!rows.length) return renderListView([], emptyKey);
  return `<div class="usage-table" data-usage-kind="${escapeHtml(kind || '')}">${rows.map((row) => {
    const hasMetrics = row.metrics && row.metrics.totalTokens > 0;
    const detail = hasMetrics ? `<div class="usage-row-detail"><div class="usage-detail-label">${escapeHtml(tr('usage.breakdown'))}</div>${renderTokenMix(row.metrics)}</div>` : '';
    return detail
      ? `<details class="usage-table-row"><summary>${usageRowSummary(row, { icon: showIcon, detail: true })}</summary>${detail}</details>`
      : `<article class="usage-table-row">${usageRowSummary(row, { icon: showIcon })}</article>`;
  }).join('')}</div>`;
}

function renderUsageModels(period) {
  const rows = modelRows(period);
  return panel(tr('usage.tabs.models'), renderUsageMetricRows(rows, { kind: 'model' }));
}

function renderUsageProjects(period) {
  const projectData = projectRows(period, { incomplete: Boolean(viewStats()?.projectsIncomplete) && state.prefs.period === 'allTime' });
  const incompleteBanner = projectData.incomplete
    ? `<div class="notice warn" role="status">${escapeHtml(tr('projects.incomplete'))}</div>`
    : '';
  const rangeBanner = state.customPeriod
    ? `<div class="notice" role="status">${escapeHtml(tr('usage.rangeDetailsUnavailable'))}</div>`
    : '';
  return `${rangeBanner}${incompleteBanner}${panel(tr('usage.tabs.projects'), renderUsageMetricRows(projectData.rows, { kind: 'project', emptyKey: 'empty.projects' }))}`;
}

function renderUsageSessions(period) {
  const sessionData = sessionRows(period);
  const truncated = sessionData.truncated
    ? `<div class="notice" role="status">${escapeHtml(tr('sessions.truncated', { shown: sessionData.rows.length, total: sessionData.total }))}</div>`
    : '';
  const rangeBanner = state.customPeriod
    ? `<div class="notice" role="status">${escapeHtml(tr('usage.rangeDetailsUnavailable'))}</div>`
    : '';
  const rows = sessionData.rows.map((row) => ({
    ...row,
    sub: `${row.sub || ''}${row.lastUsedAt ? ` · ${formatRelative(row.lastUsedAt, state.locale)}` : ''}`
  }));
  return `${rangeBanner}${truncated}${panel(tr('usage.tabs.sessions'), renderUsageMetricRows(rows, { kind: 'session', showIcon: true, emptyKey: 'empty.sessions' }))}`;
}

function renderUsage() {
  const period = activePeriod();
  const tab = ['tools', 'models', 'projects', 'sessions'].includes(state.prefs.usageTab)
    ? state.prefs.usageTab
    : 'tools';
  const body = tab === 'tools'
    ? renderTools()
    : tab === 'models'
      ? renderUsageModels(period)
      : tab === 'projects'
        ? renderUsageProjects(period)
        : renderUsageSessions(period);
  return `<section class="page-intro"><div><div class="eyebrow">${escapeHtml(tr('page.overview.kicker'))}</div><h2>${escapeHtml(tr('nav.usage'))}</h2><p>${escapeHtml(tr('page.usage.description'))}</p></div>${renderUsageSubnav()}</section>${renderHistoryScopeNotice()}${renderUsageMetricStrip(period)}${body}`;
}

function renderListView(rows, emptyKey, { showIcon = false } = {}) {
  if (!rows.length) return emptyHtml(emptyKey);
  return `<div class="stack">${rows.map((row) => rowHtml(row, {
    showIcon,
    sub: row.sub || (row.lastUsedAt ? formatRelative(row.lastUsedAt, state.locale) : '')
  })).join('')}</div>`;
}


function renderDeviceStatusBlocks(device) {
  const clientEntries = clientStatusEntries(device?.clientStatus || device?.raw?.clientStatus);
  const wsl = wslStatusSummary(device?.wslStatus || device?.raw?.wslStatus);
  const parts = [];
  if (clientEntries.length) {
    const tags = clientEntries.map((entry) => {
      const tone = entry.state === 'active' ? 'ok' : (entry.state === 'waiting' ? 'warn' : 'stale');
      const label = tr(`devices.status.${entry.state}`);
      return `<span class="badge ${tone}">${escapeHtml(clientLabel(entry.client))} · ${escapeHtml(label)}</span>`;
    }).join('');
    parts.push(`<div class="status-block"><div class="row-sub">${tr('devices.clientStatus')}</div><div class="status-tags">${tags}</div></div>`);
  }
  if (wsl) {
    const stateLabel = tr(`devices.wsl.${wsl.state}`);
    const detail = [
      wsl.detected.length ? `${tr('devices.wsl.detected')}: ${wsl.detected.map(clientLabel).join(', ')}` : '',
      wsl.withData.length ? `${tr('devices.wsl.withData')}: ${wsl.withData.map(clientLabel).join(', ')}` : ''
    ].filter(Boolean).join(' · ');
    parts.push(`<div class="status-block"><div class="row-sub">${tr('devices.wslStatus')}</div><div class="status-tags"><span class="badge ${wsl.state === 'active' ? 'ok' : 'warn'}">${escapeHtml(stateLabel)}</span></div>${detail ? `<div class="row-sub" style="margin-top:6px">${escapeHtml(detail)}</div>` : ''}</div>`);
  }
  return parts.length ? `<div class="device-status-stack">${parts.join('')}</div>` : '';
}

function renderDevices() {
  const periodKey = state.customPeriod ? 'today' : (state.prefs.deviceDetailPeriod || state.prefs.period || 'today');
  const stats = viewStats();
  const rows = deviceRows(stats, periodKey);
  if (!rows.length) return emptyHtml('empty.usage');
  const selectedId = state.prefs.selectedDeviceId || rows[0].key;
  const selected = rows.find((row) => row.key === selectedId) || rows[0];
  const breakdown = deviceBreakdownRows(selected.raw || selected, periodKey);
  const detailPeriod = state.prefs.deviceDetailPeriod || 'today';
  const activeDevices = rows.filter((row) => !row.stale).length;
  const runtimes = new Set(rows.map((row) => row.agentRuntimeLabel || agentRuntimeLabel(row.agentRuntime)).filter(Boolean));
  const fleetSummary = `<div class="usage-metric-strip device-summary-strip">
    ${usageMetricCard(tr('devices.summary'), rows.length)}
    ${usageMetricCard(tr('devices.live'), activeDevices)}
    ${usageMetricCard(tr('devices.stale'), rows.length - activeDevices)}
    ${usageMetricCard(tr('devices.runtime'), runtimes.size || '—')}
  </div>`;
  const detailMeta = [
    selected.deviceId,
    selected.receivedAt ? `${tr('devices.lastSeen')} ${formatRelative(selected.receivedAt, state.locale)}` : '',
    selected.projectsEnabled === false ? tr('projects.incomplete') : ''
  ].filter(Boolean).join(' · ');
  const customRangeNotice = state.customPeriod
    ? `<div class="notice" role="status">${escapeHtml(tr('devices.customRangeNotice'))}</div>`
    : '';

  return `
    ${customRangeNotice}
    ${fleetSummary}
    <div class="grid-2 devices-layout">
      <section class="panel">
        <div class="panel-head"><h2 class="panel-title">${tr('devices.title')}</h2></div>
        <div style="overflow:auto">
          <table class="device-table">
            <thead>
              <tr>
                <th>${tr('devices.id')}</th>
                <th>${tr('devices.platform')}</th>
                <th>${tr('devices.updated')}</th>
                <th>${tr('devices.tokens')}</th>
                <th>${tr('devices.actions')}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr class="${row.key === selected.key ? 'selected' : ''}" data-select-device="${escapeHtml(row.key)}">
                  <td>
                    <div class="row-name">${escapeHtml(row.name)}</div>
                    <div class="row-sub">${row.stale ? tr('devices.stale') : tr('devices.live')}${(row.agentRuntimeLabel || agentRuntimeLabel(row.agentRuntime)) ? ` · ${escapeHtml(row.agentRuntimeLabel || agentRuntimeLabel(row.agentRuntime))}` : ''}${row.deviceId && row.deviceId !== row.name ? ` · ${escapeHtml(row.deviceId)}` : ''}</div>
                  </td>
                  <td>${escapeHtml(row.platformDisplay || devicePlatformLabel(row.platform, row.osName, row.osVersion))}</td>
                  <td>${escapeHtml(formatRelative(row.updatedAt, state.locale))}</td>
                  <td>
                    <div class="row-value">${formatNumber(row.value)}</div>
                    <div class="row-cost">${formatCost(row.cost, state.prefs.currency)}</div>
                  </td>
                  <td>
                    <div class="device-actions">
                      ${state.authorization?.scopes?.includes('admin') ? `<button type="button" class="ghost-btn" data-rename-device="${escapeHtml(row.key)}">${tr('devices.rename')}</button><button type="button" class="danger-btn" data-delete-device="${escapeHtml(row.key)}">${tr('devices.delete')}</button>` : '—'}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${escapeHtml(selected.name)}</h2>
          <div class="panel-meta tiny">${escapeHtml([
            selected.platformDisplay || devicePlatformLabel(selected.platform, selected.osName, selected.osVersion),
            selected.agentRuntimeLabel || agentRuntimeLabel(selected.agentRuntime),
            selected.stale ? tr('devices.stale') : tr('devices.live')
          ].filter(Boolean).join(' · '))}</div>
        </div>
        ${detailMeta ? `<div class="device-detail-meta muted tiny">${escapeHtml(detailMeta)}</div>` : ''}
        <div class="toolbar-row">
          <div class="seg" role="group" aria-label="${tr('devices.period')}">
            ${segButtons([['today', tr('period.today')], ['month', tr('period.month')], ['allTime', tr('period.allTime')]], detailPeriod, 'device-period')}
          </div>
        </div>
        <div class="summary-grid" style="margin:12px 0 16px">
          <div class="summary-chip"><span class="summary-label">${tr('stats.tokens')}</span><strong>${formatNumber(breakdown.totalTokens)}</strong></div>
          <div class="summary-chip"><span class="summary-label">${tr('stats.cost')}</span><strong>${formatCost(breakdown.totalCost, state.prefs.currency)}</strong></div>
        </div>
        <div class="usage-detail-label">${escapeHtml(tr('usage.breakdown'))}</div>
        ${renderTokenMix(periodTokenMetrics(selected.raw?.periods?.[periodKey] || {}))}
        ${renderDeviceStatusBlocks(selected)}
        ${panel(tr('devices.tools'), shareBarHtml(breakdown.tools.slice(0, 12)) + (breakdown.tools.some((t) => t.models?.length) ? `<div class="device-tool-models">${breakdown.tools.filter((t) => t.models?.length).slice(0, 6).map((tool) => `<div class="status-block" style="margin-top:12px"><div class="row-sub">${escapeHtml(tool.name)}</div>${shareBarHtml(tool.models.slice(0, 6))}</div>`).join('')}</div>` : ''))}
        ${panel(tr('devices.models'), shareBarHtml(breakdown.models.slice(0, 12)))}
      </section>
    </div>
  `;
}

function localizeWindowLabel(window) {
  if (window?.kind === 'balanceUsd') return tr('limits.balanceUsd');
  if (window?.kind === 'balance') return tr('limits.balance');
  if (window?.kind === 'resetCredits') return tr('limits.resetCredits');
  if (window?.kind === 'session') return tr('limits.window.session');
  if (window?.kind === 'weekly') return tr('limits.window.weekly');
  if (window?.kind === 'billing' || window?.kind === 'monthly') return tr('limits.window.monthly');
  return window?.label || '—';
}

function renderLimitCards(cards, { compact = false } = {}) {
  if (!cards.length) return emptyHtml('empty.limits');
  return `
    <div class="grid-2">
      ${cards.map((card) => {
        const sub = [
          clientLabel(card.provider),
          card.plan || '',
          card.source ? String(card.source).toUpperCase() : '',
          card.accountEmail && card.name !== card.accountEmail ? card.accountEmail : ''
        ].filter(Boolean).join(' · ');
        return `
        <article class="limit-card${compact ? ' limit-card-compact' : ''}">
          <div class="limit-head">
            <div class="row-main">
              <img class="client-icon" src="${clientIconPath(card.provider)}" alt="" onerror="this.style.display='none'" />
              <div class="row-copy">
                <div class="row-name">${escapeHtml(card.name)}</div>
                <div class="row-sub">${escapeHtml(sub)}</div>
              </div>
            </div>
            <span class="badge ${card.stale ? 'stale' : (String(card.status).toLowerCase() === 'ok' ? 'ok' : 'warn')}">${card.stale ? tr('devices.stale') : escapeHtml(card.status)}</span>
          </div>
          <div class="limit-windows">
            ${(card.windows.length ? card.windows : [{ label: '—', remaining: null, showMeter: false }]).map((window) => {
              const showMeter = window.showMeter !== false && window.remaining != null;
              const tone = showMeter ? limitRemainingTone(window.remaining) : 'unknown';
              const primary = showMeter
                ? `${Math.round(window.remaining)}%`
                : (window.value || '—');
              const metricHint = window.metric === 'credits' ? tr('limits.credits') : '';
              const label = localizeWindowLabel(window);
              return `
              <div class="limit-window">
                <div class="limit-window-label">
                  <span>${escapeHtml(label)}${metricHint ? ` · ${escapeHtml(metricHint)}` : ''}</span>
                  <strong class="remaining-tone remaining-tone-${tone}">${escapeHtml(String(primary))}</strong>
                </div>
                ${showMeter ? `<div class="meter meter-${limitRemainingTone(window.remaining)}"><span style="width:${Math.max(0, Math.min(100, window.remaining))}%"></span></div>` : '<div class="limit-balance-line"></div>'}
                <div class="row-sub" style="margin-top:8px">
                  ${window.value && showMeter ? escapeHtml(window.value) : ''}
                  ${window.detail ? escapeHtml(window.detail) : ''}
                  ${window.resetsAt ? `${tr('limits.reset')} ${escapeHtml(formatReset(window.resetsAt, state.locale))}` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </article>`;
      }).join('')}
    </div>
  `;
}

function renderLimits() {
  const stats = viewStats();
  const allCards = limitCards(stats, state.locale);
  const providers = [...new Set(allCards.map((card) => card.provider))].sort();
  const cards = state.limitProvider
    ? allCards.filter((card) => card.provider === state.limitProvider)
    : allCards;
  const healthy = cards.filter((card) => !card.stale && String(card.status).toLowerCase() === 'ok').length;
  const stale = cards.filter((card) => card.stale).length;
  const attention = Math.max(0, cards.length - healthy - stale);
  const healthSummary = `<div class="usage-metric-strip limit-health-strip">
    ${usageMetricCard(tr('status.accounts'), cards.length)}
    ${usageMetricCard(tr('limits.healthy'), healthy)}
    ${usageMetricCard(tr('limits.attention'), attention)}
    ${usageMetricCard(tr('limits.stale'), stale)}
  </div>`;
  const filter = `
    <div class="toolbar-row view-toolbar">
      <label class="field inline-field">
        <span>${tr('limits.filter')}</span>
        <select data-limit-provider>
          <option value="">${tr('filters.allProviders')}</option>
          ${providers.map((provider) => `<option value="${escapeHtml(provider)}"${provider === state.limitProvider ? ' selected' : ''}>${escapeHtml(clientLabel(provider))}</option>`).join('')}
        </select>
      </label>
      <span class="panel-meta tiny">${tr('limits.accountsCount', { count: cards.length })}</span>
    </div>`;
  const healthPanel = state.prefs.limitTab === 'health' ? renderStatus() : '';
  return `<section class="page-intro"><div><div class="eyebrow">${escapeHtml(tr('limits.health'))}</div><h2>${escapeHtml(tr('nav.limits'))}</h2><p>${escapeHtml(tr('page.limits.description'))}</p></div></section>${healthSummary}${healthPanel}${filter}${renderLimitCards(cards)}`;
}

function renderStatus() {
  const rows = statusRows(viewStats(), state.locale);
  if (!rows.length) return emptyHtml('empty.status');
  const summary = `
    <div class="summary-grid" style="margin-bottom:16px">
      <div class="summary-chip"><span class="summary-label">${tr('status.accounts')}</span><strong>${rows.length}</strong></div>
      <div class="summary-chip"><span class="summary-label">${tr('status.okCount')}</span><strong>${rows.filter((r) => r.health === 'ok').length}</strong></div>
      <div class="summary-chip"><span class="summary-label">${tr('status.warnCount')}</span><strong>${rows.filter((r) => r.health !== 'ok').length}</strong></div>
    </div>`;
  return panel(tr('nav.status'), summary + renderLimitCards(rows, { compact: true }));
}

function formatSubscriptionMoney(amountMinor, currency) {
  const code = ['USD', 'CNY', 'TWD', 'HKD'].includes(String(currency || '').toUpperCase())
    ? String(currency).toUpperCase()
    : 'USD';
  try {
    return new Intl.NumberFormat(state.locale, { style: 'currency', currency: code }).format(Number(amountMinor || 0) / 100);
  } catch {
    return `${(Number(amountMinor || 0) / 100).toFixed(2)} ${code}`;
  }
}

function subscriptionToday() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nextSubscriptionRenewal(record) {
  if (!record || record.kind === 'topup' || record.autoRenew === false) return '';
  const today = subscriptionToday();
  const override = String(record.nextRenewalOverride || '');
  if (override >= today) return override;
  const start = String(record.startDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '';
  const [year, month, day] = start.split('-').map(Number);
  const step = Math.max(1, Number(record.intervalCount || 1)) * (record.interval === 'year' ? 12 : 1);
  const todayDate = new Date(`${today}T00:00:00Z`);
  let index = Math.max(0, ((todayDate.getUTCFullYear() - year) * 12 + todayDate.getUTCMonth() + 1 - month) / step | 0);
  const candidate = () => {
    const total = (year * 12) + (month - 1) + index * step;
    const nextYear = Math.floor(total / 12);
    const nextMonth = total % 12;
    const maxDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(Math.min(day, maxDay)).padStart(2, '0')}`;
  };
  let result = candidate();
  while (result < today) {
    index += 1;
    result = candidate();
  }
  return result;
}

function subscriptionRecords() {
  return Array.isArray(state.subscriptions?.subscriptions) ? state.subscriptions.subscriptions : [];
}

function subscriptionMonthlyTotals(records) {
  const totals = {};
  const month = subscriptionToday().slice(0, 7);
  for (const record of records) {
    if (record?.endDate && String(record.endDate) <= subscriptionToday()) continue;
    let minor = Number(record.amountMinor || 0);
    if (record.kind === 'topup') {
      minor = (record.topUps || [])
        .filter((entry) => String(entry?.date || '').startsWith(month))
        .reduce((sum, entry) => sum + Number(entry?.amountMinor || 0), 0);
    } else if (record.interval === 'year') {
      minor /= Math.max(1, Number(record.intervalCount || 1) * 12);
    } else {
      minor /= Math.max(1, Number(record.intervalCount || 1));
    }
    const currency = String(record.currency || 'USD').toUpperCase();
    totals[currency] = (totals[currency] || 0) + minor;
  }
  return totals;
}

function subscriptionField(record, key, fallback = '') {
  const value = record?.[key];
  return escapeHtml(value === undefined || value === null ? fallback : value);
}

function subscriptionTopUpRows(record, draft, enabled) {
  if (!enabled) return [];
  if (draft?.dirty && draft.topUpRowsPresent) {
    return Array.isArray(draft.topUpRows) ? draft.topUpRows : [];
  }
  const rows = Array.isArray(record?.topUps)
    ? record.topUps.map((entry, index) => ({
      id: String(entry?.id || `top_existing_${index}`),
      date: String(entry?.date || ''),
      amount: Number.isFinite(Number(entry?.amountMinor)) ? (Number(entry.amountMinor) / 100).toFixed(2) : ''
    }))
    : [];
  return rows.length ? rows : [{ id: 'top_new_0', date: '', amount: '' }];
}

function subscriptionTopUpRowHtml(row) {
  const id = String(row?.id || `top_${Date.now()}`);
  const date = escapeHtml(row?.date || '');
  const amount = escapeHtml(row?.amount ?? '');
  return `<div class="topup-row" data-topup-row data-topup-id="${escapeHtml(id)}">
    <label class="field"><span>${tr('subscriptions.topupDate')}</span><input name="topupDate_${escapeHtml(id)}" data-topup-date type="date" value="${date}" /></label>
    <label class="field"><span>${tr('subscriptions.topupAmount')}</span><input name="topupAmount_${escapeHtml(id)}" data-topup-amount type="number" min="0" step="0.01" value="${amount}" /></label>
    <button type="button" class="ghost-btn topup-remove" data-topup-remove>${tr('subscriptions.topupRemove')}</button>
  </div>`;
}

function renderSubscriptions() {
  if (state.subscriptionsLoading && !state.subscriptions) return loadingHtml();
  if (state.subscriptionsError && !state.subscriptions) {
    return managementError(tr('subscriptions.title'), state.subscriptionsError, 'subscriptions-retry');
  }
  const records = subscriptionRecords();
  const totals = subscriptionMonthlyTotals(records);
  const editing = records.find((record) => record.id === state.subscriptionEditId) || null;
  const canManage = state.authorization?.scopes?.includes('admin');
  const subscriptionDraftKey = `subscription:${state.subscriptionEditId || 'new'}`;
  const subscriptionDraft = state.formDrafts.get(subscriptionDraftKey);
  const draftKind = subscriptionDraft?.dirty ? String(subscriptionDraft.fields?.kind?.value || '') : '';
  const formKind = draftKind === 'topup' || (!draftKind && editing?.kind === 'topup') ? 'topup' : 'subscription';
  const formIsTopUp = formKind === 'topup';
  const topUpRows = subscriptionTopUpRows(editing, subscriptionDraft, formIsTopUp);
  const firstTopUp = topUpRows[0] || null;
  const amount = formIsTopUp
    ? Number(firstTopUp?.amount || 0)
    : Number(editing?.amountMinor || 0) / 100;
  const summary = Object.entries(totals).length
    ? Object.entries(totals).map(([currency, minor]) => `<div class="summary-chip"><span class="summary-label">${escapeHtml(tr('subscriptions.monthly'))} · ${currency}</span><strong>${escapeHtml(formatSubscriptionMoney(minor, currency))}</strong></div>`).join('')
    : `<div class="summary-chip"><span class="summary-label">${tr('subscriptions.monthly')}</span><strong>—</strong></div>`;
  const conflictNotice = state.subscriptionsConflict
    ? `<div class="notice warn management-conflict" role="alert"><span>${escapeHtml(tr('subscriptions.conflict'))}</span><button type="button" class="ghost-btn" data-subscription-reload-latest>${tr('subscriptions.reloadLatest')}</button></div>`
    : '';
  const list = records.length
    ? `<div class="management-list">${records.map((record) => {
      const topUp = record.kind === 'topup';
      const renewal = nextSubscriptionRenewal(record);
      const detail = [
        record.planName || '',
        record.binding?.accountEmail || '',
        topUp ? tr('subscriptions.topup') : (record.interval === 'year' ? tr('subscriptions.yearly') : tr('subscriptions.monthly')),
        renewal ? `${tr('subscriptions.next')} ${renewal}` : ''
      ].filter(Boolean).join(' · ');
      const recordAmount = topUp
        ? (record.topUps || []).reduce((sum, entry) => sum + Number(entry?.amountMinor || 0), 0)
        : Number(record.amountMinor || 0);
      return `<article class="management-row ${record.id === state.subscriptionEditId ? 'is-editing' : ''}">
        <div class="row-main">
          <span class="management-icon">${uiIcon(topUp ? 'arrowUpRight' : 'refresh')}</span>
          <div class="row-copy"><div class="row-name">${escapeHtml(record.provider || tr('subscriptions.untitled'))}</div><div class="row-sub">${escapeHtml(detail || tr('subscriptions.noDetails'))}</div></div>
        </div>
        <div class="row-metrics"><div class="row-value">${escapeHtml(formatSubscriptionMoney(recordAmount, record.currency))}</div><div class="row-cost">${escapeHtml(record.currency || 'USD')}</div></div>
        ${canManage ? `<div class="management-actions"><button type="button" class="ghost-btn" data-subscription-edit="${escapeHtml(record.id)}">${tr('actions.edit')}</button><button type="button" class="danger-btn" data-subscription-delete="${escapeHtml(record.id)}">${tr('actions.delete')}</button></div>` : ''}
      </article>`;
    }).join('')}</div>`
    : emptyHtml('subscriptions.empty');
  const form = `<form class="management-form" data-subscription-form data-draft-key="${escapeHtml(subscriptionDraftKey)}">
    <div class="form-section-head"><div><h3>${editing ? tr('subscriptions.edit') : tr('subscriptions.add')}</h3><p class="muted tiny">${tr('subscriptions.formHint')}</p></div>${editing ? `<button type="button" class="ghost-btn" data-subscription-reset>${tr('actions.cancel')}</button>` : ''}</div>
    <div class="form-grid">
      <label class="field"><span>${tr('subscriptions.provider')}</span><input name="provider" required value="${subscriptionField(editing, 'provider')}" placeholder="codex" /></label>
      <label class="field"><span>${tr('subscriptions.kind')}</span><select name="kind" data-subscription-kind><option value="subscription"${!formIsTopUp ? ' selected' : ''}>${tr('subscriptions.plan')}</option><option value="topup"${formIsTopUp ? ' selected' : ''}>${tr('subscriptions.topup')}</option></select></label>
      <label class="field"><span>${tr('subscriptions.planName')}</span><input name="planName" value="${subscriptionField(editing, 'planName')}" placeholder="Pro" /></label>
      ${!formIsTopUp ? `<label class="field"><span>${tr('subscriptions.amount')}</span><input name="amount" type="number" min="0" step="0.01" value="${escapeHtml(amount || '')}" required /></label>` : ''}
      <label class="field"><span>${tr('subscriptions.currency')}</span><select name="currency">${['USD', 'CNY', 'TWD', 'HKD'].map((code) => `<option value="${code}"${(editing?.currency || 'USD') === code ? ' selected' : ''}>${code}</option>`).join('')}</select></label>
      <label class="field"><span>${tr('subscriptions.interval')}</span><select name="interval"><option value="month"${editing?.interval !== 'year' ? ' selected' : ''}>${tr('subscriptions.monthly')}</option><option value="year"${editing?.interval === 'year' ? ' selected' : ''}>${tr('subscriptions.yearly')}</option></select></label>
      <label class="field"><span>${tr('subscriptions.intervalCount')}</span><input name="intervalCount" type="number" min="1" max="24" step="1" value="${subscriptionField(editing, 'intervalCount', '1')}" /></label>
      ${formIsTopUp ? `<div class="field field-wide topup-ledger" data-topup-ledger><div class="topup-ledger-head"><span>${tr('subscriptions.topupLedger')}</span><button type="button" class="ghost-btn" data-topup-add>${tr('subscriptions.topupAdd')}</button></div>${topUpRows.map(subscriptionTopUpRowHtml).join('')}</div>` : `<label class="field"><span>${tr('subscriptions.startDate')}</span><input name="startDate" type="date" value="${subscriptionField(editing, 'startDate')}" /></label>`}
      <label class="field"><span>${tr('subscriptions.nextRenewal')}</span><input name="nextRenewalOverride" type="date" value="${subscriptionField(editing, 'nextRenewalOverride')}" /></label>
      <label class="field"><span>${tr('subscriptions.endDate')}</span><input name="endDate" type="date" value="${subscriptionField(editing, 'endDate')}" /></label>
      <label class="field"><span>${tr('subscriptions.accountEmail')}</span><input name="accountEmail" type="email" value="${subscriptionField(editing?.binding, 'accountEmail')}" /></label>
      <label class="field"><span>${tr('subscriptions.profileName')}</span><input name="profileName" value="${subscriptionField(editing?.binding, 'profileName')}" /></label>
      <label class="field field-wide"><span>${tr('subscriptions.note')}</span><input name="note" value="${subscriptionField(editing, 'note')}" /></label>
    </div>
    <label class="check-row"><input name="autoRenew" type="checkbox"${editing?.autoRenew !== false ? ' checked' : ''} /><span>${tr('subscriptions.autoRenew')}</span></label>
    <div class="drawer-actions"><button type="submit" class="primary-btn"${state.subscriptionsSaving ? ' disabled' : ''}>${state.subscriptionsSaving ? tr('actions.saving') : tr('actions.save')}</button></div>
  </form>`;
  const management = canManage ? panel(tr('subscriptions.manage'), form) : '';
  return `${renderCompletenessNotice(viewStats(), state.prefs.period)}${conflictNotice}${panel(tr('subscriptions.title'), `<div class="summary-grid subscription-summary">${summary}</div>${list}`)}${management}`;
}

function renderPricing() {
  if (state.pricingLoading && !state.pricing) return loadingHtml();
  if (state.pricingError && !state.pricing) return managementError(tr('pricing.title'), state.pricingError, 'pricing-retry');
  const entries = Array.isArray(state.pricing) ? state.pricing : [];
  const rows = entries.length
    ? `<div class="pricing-list">${entries.map((entry) => pricingForm(entry)).join('')}</div>`
    : emptyHtml('pricing.empty');
  const add = pricingForm(null);
  return `${panel(tr('pricing.title'), `<div class="toolbar-row view-toolbar"><span class="muted tiny">${tr('pricing.hint')}</span><button type="button" class="ghost-btn" data-pricing-refresh-all>${tr('pricing.refreshAll')}</button></div>${rows}`)}${panel(tr('pricing.add'), add)}`;
}

function pricingForm(entry) {
  const model = entry?.model || '';
  const value = (field) => escapeHtml(entry?.[field] ?? '');
  const draftKey = `pricing:${model || 'new'}`;
  return `<form class="pricing-form" data-pricing-form data-pricing-model="${escapeHtml(model)}" data-draft-key="${escapeHtml(draftKey)}">
    <div class="pricing-form-head"><div><h3>${escapeHtml(model || tr('pricing.newModel'))}</h3><p class="muted tiny">${entry?.source ? `${escapeHtml(entry.source)} · ${escapeHtml(entry.updatedAt || '')}` : tr('pricing.formHint')}</p></div>${entry ? `<button type="button" class="ghost-btn" data-pricing-upstream="${escapeHtml(model)}">${tr('pricing.fetch')}</button>` : ''}</div>
    <div class="form-grid pricing-grid">
      <label class="field${entry ? '' : ' field-wide'}"><span>${tr('pricing.model')}</span><input name="model" required value="${escapeHtml(model)}" placeholder="gpt-5"${entry ? ' readonly' : ''} /></label>
      <label class="field"><span>${tr('pricing.input')}</span><input name="inputPricePerMillion" type="number" min="0" step="any" required value="${value('inputPricePerMillion')}" /></label>
      <label class="field"><span>${tr('pricing.output')}</span><input name="outputPricePerMillion" type="number" min="0" step="any" required value="${value('outputPricePerMillion')}" /></label>
      <label class="field"><span>${tr('pricing.cacheRead')}</span><input name="cacheReadPricePerMillion" type="number" min="0" step="any" required value="${value('cacheReadPricePerMillion')}" /></label>
      <label class="field"><span>${tr('pricing.cacheWrite')}</span><input name="cacheWritePricePerMillion" type="number" min="0" step="any" required value="${value('cacheWritePricePerMillion')}" /></label>
    </div>
    <div class="drawer-actions"><button type="submit" class="primary-btn"${state.pricingSaving ? ' disabled' : ''}>${state.pricingSaving ? tr('actions.saving') : tr('actions.save')}</button></div>
  </form>`;
}

function renderManagementSubnav() {
  const current = ['subscriptions', 'pricing'].includes(state.prefs.managementTab)
    ? state.prefs.managementTab
    : 'subscriptions';
  const admin = state.authorization?.scopes?.includes('admin');
  const pricingVisible = state.authorization?.capabilities?.pricing !== false && admin;
  return `<nav class="page-tabs" aria-label="${escapeHtml(tr('nav.management'))}" role="tablist">
    <button type="button" role="tab" aria-selected="${current === 'subscriptions' ? 'true' : 'false'}" class="page-tab${current === 'subscriptions' ? ' active' : ''}" data-management-tab="subscriptions">${escapeHtml(tr('management.tabs.subscriptions'))}</button>
    ${pricingVisible ? `<button type="button" role="tab" aria-selected="${current === 'pricing' ? 'true' : 'false'}" class="page-tab${current === 'pricing' ? ' active' : ''}" data-management-tab="pricing">${escapeHtml(tr('management.tabs.pricing'))}</button>` : ''}
  </nav>`;
}

function renderManagement() {
  const admin = state.authorization?.scopes?.includes('admin');
  const pricingVisible = state.authorization?.capabilities?.pricing !== false && admin;
  const tab = state.prefs.managementTab === 'pricing' && pricingVisible ? 'pricing' : 'subscriptions';
  if (state.prefs.managementTab !== tab) state.prefs.managementTab = tab;
  const body = tab === 'pricing' ? renderPricing() : renderSubscriptions();
  return `<section class="page-intro"><div><div class="eyebrow">${escapeHtml(tr('page.overview.kicker'))}</div><h2>${escapeHtml(tr('nav.management'))}</h2><p>${escapeHtml(tr('page.management.description'))}</p></div>${renderManagementSubnav()}</section>${body}`;
}

function settingsOptionList(options, selected) {
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function renderSettingsPage() {
  const scopes = state.authorization?.scopes || [];
  const capabilities = state.authorization?.capabilities || state.health?.capabilities || {};
  const capabilityEntries = Object.entries(capabilities).filter(([, value]) => value !== undefined);
  const capabilityHtml = capabilityEntries.length
    ? `<div class="settings-capability-list">${capabilityEntries.map(([key, value]) => `<span class="badge ${value === false ? 'stale' : 'ok'}">${escapeHtml(key)} · ${value === false ? 'off' : 'on'}</span>`).join('')}</div>`
    : `<span class="muted tiny">—</span>`;
  const origin = window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : window.location.host || 'current page';
  const streamLabel = tr(`status.${state.stream === 'live' ? 'live' : state.stream === 'connecting' || state.stream === 'retrying' ? 'connecting' : state.stream === 'unauthorized' ? 'unauthorized' : 'offline'}`);
  return `<section class="page-intro settings-page-intro"><div><div class="eyebrow">${escapeHtml(tr('settings.webOnly'))}</div><h2>${escapeHtml(tr('settings.pageTitle'))}</h2><p>${escapeHtml(tr('settings.pageDescription'))}</p></div></section>
    <div class="settings-layout">
      <form class="panel settings-form" data-web-settings-form>
        <div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('settings.webOnly'))}</h2><span class="panel-meta tiny">${escapeHtml(tr('settings.pageDescription'))}</span></div>
        <div class="form-grid">
          <label class="field"><span>${tr('settings.language')}</span><select name="language">${settingsOptionList([['auto', 'Auto'], ['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['ja', '日本語'], ['ko', '한국어']], state.prefs.language || 'auto')}</select></label>
          <label class="field"><span>${tr('settings.theme')}</span><select name="theme">${settingsOptionList([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], state.prefs.theme || 'system')}</select></label>
          <label class="field"><span>${tr('settings.currency')}</span><select name="currency">${settingsOptionList([['USD', 'USD'], ['CNY', 'CNY'], ['TWD', 'TWD'], ['HKD', 'HKD']], state.prefs.currency || 'USD')}</select></label>
          <label class="field"><span>${tr('settings.homeLimitAccountCount')}</span><input name="homeLimitAccountCount" type="number" min="1" max="12" step="1" value="${clampHomeLimitAccountCount(state.prefs.homeLimitAccountCount, 3)}" /></label>
          <label class="field field-wide"><span>${tr('settings.secret')}</span><input name="secret" type="password" autocomplete="off" spellcheck="false" value="${escapeHtml(state.secret || '')}" /></label>
        </div>
        <p class="muted tiny settings-form-hint">${escapeHtml(tr('settings.authHint'))}</p>
        <div class="drawer-actions"><button type="submit" class="primary-btn">${escapeHtml(tr('settings.savePage'))}</button><button type="button" class="ghost-btn" data-web-signout>${escapeHtml(tr('settings.signOut'))}</button></div>
      </form>
      <div class="settings-side-stack">
        <section class="panel settings-info-panel"><div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('settings.connection'))}</h2></div><p class="muted tiny">${escapeHtml(tr('settings.connectionHint'))}</p><dl class="settings-definition-list"><div><dt>${escapeHtml(tr('settings.currentOrigin'))}</dt><dd>${escapeHtml(origin)}</dd></div><div><dt>${escapeHtml(tr('settings.role'))}</dt><dd>${escapeHtml(scopes.length ? scopes.join(' · ') : '—')}</dd></div><div><dt>${escapeHtml(tr('settings.stream'))}</dt><dd>${escapeHtml(streamLabel)}</dd></div></dl><div class="settings-capabilities"><span class="summary-label">${escapeHtml(tr('settings.capabilities'))}</span>${capabilityHtml}</div></section>
        <section class="panel settings-info-panel"><div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('settings.pwa'))}</h2></div><p class="muted tiny">${escapeHtml(pwaStatusText())}</p>${state.deferredInstall ? `<button type="button" class="ghost-btn" data-pwa-install>${escapeHtml(tr('pwa.install'))}</button>` : ''}</section>
        <section class="panel settings-boundary-panel"><div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('settings.desktopOnly'))}</h2></div><p class="muted tiny">${escapeHtml(tr('settings.desktopOnlyHint'))}</p></section>
      </div>
    </div>`;
}

async function saveWebSettingsForm(form) {
  const values = new FormData(form);
  state.prefs.language = String(values.get('language') || 'auto');
  state.prefs.theme = String(values.get('theme') || 'system');
  state.prefs.currency = String(values.get('currency') || 'USD');
  state.prefs.homeLimitAccountCount = clampHomeLimitAccountCount(values.get('homeLimitAccountCount'), 3);
  savePrefs({
    language: state.prefs.language,
    theme: state.prefs.theme,
    currency: state.prefs.currency,
    homeLimitAccountCount: state.prefs.homeLimitAccountCount
  });
  const nextSecret = String(values.get('secret') || '').trim();
  const secretChanged = nextSecret !== state.secret;
  applyTheme();
  applyLocale();
  if (secretChanged) {
    const ok = await tryConnect(nextSecret, true);
    if (!ok) return false;
  }
  showToast(tr('toast.saved'));
  return true;
}

function signOutFromHub() {
  clearSecret();
  state.secret = '';
  if (state.stopStream) state.stopStream();
  state.stopStream = null;
  setStreamStatus('offline');
  showAuth(true);
}

function loadingHtml() {
  return `<div class="loading-stack" aria-live="polite"><div class="skeleton skeleton-title"></div><div class="skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div><div class="skeleton skeleton-panel"></div><span class="muted tiny">${tr('loading')}</span></div>`;
}

function managementError(title, error, retryAction) {
  return `<section class="error-card"><div class="error-kicker">${escapeHtml(title)}</div><h2>${escapeHtml(tr('error.title'))}</h2><p>${escapeHtml(error?.message || tr('error.generic'))}</p><button type="button" class="primary-btn" data-management-retry="${retryAction}">${tr('actions.retry')}</button></section>`;
}

function renderSparkline(daily) {
  if (!daily.length) return emptyHtml('empty.history');
  const width = 720;
  const height = 240;
  const pad = { top: 18, right: 16, bottom: 32, left: 52 };
  const values = daily.map((day) => Number(day.tokens || 0));
  const { top, ticks } = yAxisScale(Math.max(1, ...values));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(1, daily.length);
  const barW = Math.max(4, slot - 4);
  const bars = daily.map((day, index) => {
    const tokens = Number(day.tokens || 0);
    const cost = Number(day.cost || 0);
    const h = Math.max(tokens > 0 ? 2 : 0, (innerH * tokens) / top);
    const x = pad.left + index * slot + (slot - barW) / 2;
    const y = height - pad.bottom - h;
    const tip = tipText([
      day.date || '',
      `${formatNumber(tokens)} ${tr('stats.tokens')}`,
      cost ? formatCost(cost, state.prefs.currency) : ''
    ]);
    return `<rect class="bar-seg chart-hit" x="${x}" y="${tokens > 0 ? y : height - pad.bottom - 2}" width="${barW}" height="${tokens > 0 ? h : 2}" rx="3" fill="var(--accent)" opacity="${tokens > 0 ? 0.9 : 0.25}" data-tip="${escapeHtml(tip)}"></rect>`;
  }).join('');
  const labelDays = [daily[0], daily[Math.floor(daily.length / 2)], daily[daily.length - 1]].filter(Boolean);
  const labels = labelDays.map((day) => {
    const idx = daily.indexOf(day);
    const x = pad.left + idx * slot + slot / 2;
    return `<text class="axis-label" x="${x}" y="${height - 10}" text-anchor="middle">${escapeHtml(String(day.date || '').slice(5))}</text>`;
  }).join('');
  return `
    <div class="chart-wrap">
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Usage trend">
        ${renderYAxis({ pad, width, height, top, ticks })}
        <line class="axis-base" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" />
        ${bars}
        ${labels}
      </svg>
    </div>
  `;
}

function renderHeatmap(daily, metric = 'tokens') {
  if (!daily.length) return emptyHtml('empty.history');
  const heatMetric = metric === 'cost' ? 'cost' : 'tokens';
  const values = daily.map((day) => heatmapValue(day, heatMetric));
  const max = Math.max(1, ...values);
  const cell = 12;
  const gap = 3;
  const first = daily[0]?.date;
  const startDow = first ? new Date(`${first}T00:00:00Z`).getUTCDay() : 0;
  const weeks = Math.ceil((daily.length + startDow) / 7);
  const left = 28;
  const top = 4;
  const width = left + weeks * (cell + gap) + 8;
  const height = top + 7 * (cell + gap) + 8;
  const dowLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    .map((label, index) => `<text class="axis-label" x="0" y="${top + index * (cell + gap) + cell - 1}">${label}</text>`)
    .join('');
  const cells = daily.map((day, index) => {
    const pos = index + startDow;
    const week = Math.floor(pos / 7);
    const dow = pos % 7;
    const tokens = Number(day.tokens || 0);
    const cost = Number(day.cost || 0);
    const value = heatmapValue(day, heatMetric);
    const ratio = value / max;
    const level = value <= 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
    const x = left + week * (cell + gap);
    const y = top + dow * (cell + gap);
    const tip = tipText([
      day.date || '',
      `${formatNumber(tokens)} ${tr('stats.tokens')}`,
      cost ? formatCost(cost, state.prefs.currency) : ''
    ]);
    return `<rect class="heat heat-${heatMetric} lvl-${level} chart-hit" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" data-tip="${escapeHtml(tip)}"></rect>`;
  }).join('');
  return `
    <div class="chart-wrap chart-wrap-heat">
      <svg class="chart-svg chart-svg-heat" style="min-width:${Math.max(320, width)}px;height:${height + 12}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="Activity heatmap">
        ${dowLabels}
        ${cells}
      </svg>
    </div>
  `;
}

function trendValue(value, metric) {
  if (metric === 'cost') return Number(value?.cost ?? value ?? 0);
  if (metric === 'activeTime') return Number(value?.activeTimeMs || 0);
  return Number(value?.tokens ?? value ?? 0);
}

function formatTrendValue(value, metric) {
  return metric === 'cost'
    ? formatCost(value, state.prefs.currency)
    : metric === 'activeTime'
      ? formatDuration(value)
      : formatNumber(value);
}

function renderStackedBars(daily, stackBy, metric = 'tokens') {
  if (!daily.length) return emptyHtml('empty.history');
  const width = 760;
  const height = 280;
  const pad = { top: 18, right: 16, bottom: 36, left: 52 };
  const seriesKeys = new Map();
  for (const day of daily) {
    const map = stackBy === 'model' ? (day.perModel || {}) : (day.perClient || {});
    for (const [key, value] of Object.entries(map)) {
      const amount = trendValue(value, metric);
      if (amount > 0) seriesKeys.set(key, (seriesKeys.get(key) || 0) + amount);
    }
  }
  let topKeys = [...seriesKeys.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([key]) => key);
  const useTotalsFallback = topKeys.length === 0;
  if (useTotalsFallback) {
    topKeys = ['total'];
    for (const day of daily) {
      const amount = trendValue(day, metric);
      if (amount > 0) seriesKeys.set('total', (seriesKeys.get('total') || 0) + amount);
    }
  }

  const dayTotals = daily.map((day) => {
    if (useTotalsFallback) return trendValue(day, metric);
    const map = stackBy === 'model' ? (day.perModel || {}) : (day.perClient || {});
    return topKeys.reduce((sum, key) => sum + trendValue(map[key], metric), 0);
  });
  const { top, ticks } = yAxisScale(Math.max(1, ...dayTotals, 1));
  const slot = (width - pad.left - pad.right) / Math.max(1, daily.length);
  const barW = Math.max(4, slot - 4);
  const palette = ['#2563eb', '#0f9f6e', '#c98512', '#d6455d', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
  const colorMap = Object.fromEntries(topKeys.map((key, index) => [key, useTotalsFallback ? 'var(--accent)' : palette[index % palette.length]]));

  const bars = daily.map((day, index) => {
    const map = useTotalsFallback
      ? { total: day }
      : (stackBy === 'model' ? (day.perModel || {}) : (day.perClient || {}));
    let y = height - pad.bottom;
    const x = pad.left + index * slot + (slot - barW) / 2;
    const parts = [];
    const tipLines = [];
    for (const key of topKeys) {
      const amount = trendValue(map[key], metric);
      if (amount <= 0) continue;
      const h = Math.max(1, ((height - pad.top - pad.bottom) * amount) / top);
      y -= h;
      const label = useTotalsFallback
        ? tr('stats.tokens')
        : (stackBy === 'model' ? key : clientLabel(key));
      tipLines.push(`${label}: ${formatTrendValue(amount, metric)}`);
      parts.push(`<rect class="bar-seg chart-hit" x="${x}" y="${y}" width="${barW}" height="${h}" fill="${colorMap[key]}" data-tip="${escapeHtml(tipText([day.date || '', `${label}: ${formatTrendValue(amount, metric)}`]))}"></rect>`);
    }
    const total = dayTotals[index];
    const totalTip = tipText([
      day.date || '',
      formatTrendValue(total, metric),
      Number(day.cost || 0) ? formatCost(day.cost, state.prefs.currency) : '',
      ...tipLines
    ]);
    // Full-height invisible hit area so empty days and gaps still show the day total.
    parts.unshift(`<rect class="chart-hit chart-hit-day" x="${x}" y="${pad.top}" width="${barW}" height="${height - pad.top - pad.bottom}" fill="transparent" data-tip="${escapeHtml(totalTip)}"></rect>`);
    return parts.join('');
  }).join('');

  const labelDays = [daily[0], daily[Math.floor(daily.length / 2)], daily[daily.length - 1]].filter(Boolean);
  const labels = labelDays.map((day) => {
    const idx = daily.indexOf(day);
    const x = pad.left + idx * slot + slot / 2;
    return `<text class="axis-label" x="${x}" y="${height - 12}" text-anchor="middle">${escapeHtml(String(day.date || '').slice(5))}</text>`;
  }).join('');

  const legend = topKeys.map((key) => `
    <div class="row">
      <div class="row-main">
        <span class="swatch" style="background:${colorMap[key]}"></span>
        <div class="row-name">${escapeHtml(useTotalsFallback ? tr('stats.tokens') : (stackBy === 'model' ? key : clientLabel(key)))}</div>
      </div>
      <div class="row-value">${escapeHtml(formatTrendValue(seriesKeys.get(key) || 0, metric))}</div>
    </div>
  `).join('');

  return `
    <div class="stack">
      <div class="chart-wrap">
        <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Stacked usage">
          ${renderYAxis({ pad, width, height, top, ticks })}
          <line class="axis-base" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" />
          ${bars}
          ${labels}
        </svg>
      </div>
      <div class="stack">${legend || emptyHtml('empty.history')}</div>
    </div>
  `;
}

function renderTrends() {
  const heatMetric = state.prefs.heatmapMetric === 'tokens' ? 'tokens' : 'cost';
  const daily = historyDaily(historySource(), state.prefs.trendsRange === 'all' ? 0 : state.prefs.trendsRange);
  const trendMetric = ['tokens', 'cost', 'activeTime'].includes(state.prefs.trendsMetric) ? state.prefs.trendsMetric : 'tokens';
  const rangeSummary = daily.reduce((summary, day) => ({
    tokens: summary.tokens + Number(day?.tokens || 0),
    cost: summary.cost + Number(day?.cost || 0),
    activeTime: summary.activeTime + Number(day?.activeTimeMs || 0)
  }), { tokens: 0, cost: 0, activeTime: 0 });
  const trendSummary = `<div class="usage-metric-strip trend-summary">
    ${usageMetricCard(tr('home.activeDays'), formatNumber(daily.filter((day) => Number(day?.tokens || 0) > 0 || Number(day?.cost || 0) > 0).length))}
    ${usageMetricCard(tr('stats.tokens'), formatNumber(rangeSummary.tokens))}
    ${usageMetricCard(tr('stats.cost'), formatCost(rangeSummary.cost, state.prefs.currency))}
    ${usageMetricCard(tr('home.activeTime'), formatDuration(rangeSummary.activeTime))}
  </div>`;
  return `
    ${renderHistoryScopeNotice()}
    ${trendSummary}
    <div class="toolbar-row">
      <div class="seg">
        <button type="button" class="seg-btn ${state.prefs.trendsStack === 'client' ? 'active' : ''}" data-stack="client">${tr('trends.stack.client')}</button>
        <button type="button" class="seg-btn ${state.prefs.trendsStack === 'model' ? 'active' : ''}" data-stack="model">${tr('trends.stack.model')}</button>
      </div>
      <div class="seg">
        ${['7', '30', '90', '365', 'all'].map((range) => `
          <button type="button" class="seg-btn ${String(state.prefs.trendsRange) === range ? 'active' : ''}" data-range="${range}">${range === 'all' ? 'All' : `${range}d`}</button>
        `).join('')}
      </div>
      <div class="seg" role="group" aria-label="${tr('home.heatmapMetric')}">
        ${segButtons([['tokens', tr('stats.tokens')], ['cost', tr('stats.cost')]], heatMetric, 'heatmap-metric')}
      </div>
      <div class="seg" role="group" aria-label="${tr('trends.metric')}">
        ${segButtons([['tokens', tr('stats.tokens')], ['cost', tr('stats.cost')], ['activeTime', tr('home.activeTime')]], trendMetric, 'trends-metric')}
      </div>
    </div>
    ${panel(tr('nav.trends'), renderStackedBars(daily, state.prefs.trendsStack, trendMetric))}
    ${panel(tr('home.heatmap'), renderHeatmap(daily, heatMetric))}
  `;
}

function render() {
  const renderState = captureRenderState();
  if (state.prefs.view !== 'accounts') state.accountProviderMenuOpen = false;
  renderChrome();
  if (state.loading && !state.stats) {
    els.content.innerHTML = loadingHtml();
    restoreRenderState(renderState);
    return;
  }
  if (state.error && !state.stats) {
    els.content.innerHTML = `<section class="error-card"><div class="error-kicker">Token Monitor</div><h2>${escapeHtml(tr('error.title'))}</h2><p>${escapeHtml(state.error.message || tr('error.generic'))}</p><button type="button" class="primary-btn" data-retry-dashboard>${tr('actions.retry')}</button></section>`;
    restoreRenderState(renderState);
    return;
  }
  renderHero();
  let html;
  switch (state.prefs.view) {
    case 'usage':
      html = renderUsage();
      break;
    case 'devices':
      html = renderDevices();
      break;
    case 'limits':
      html = renderLimits();
      break;
    case 'accounts':
      html = renderAccountsPage();
      break;
    case 'trends':
      html = renderTrends();
      break;
    case 'management':
      html = renderManagement();
      break;
    case 'settings':
      html = renderSettingsPage();
      break;
    default:
      html = renderHome();
  }
  els.content.innerHTML = html;
  restoreRenderState(renderState);
}

async function ensureHistory({ force = false } = {}) {
  // Full /api/history includes perClient/perModel stacks needed by Trends.
  // historyPreview from /api/stats is totals-only and must NOT block this fetch.
  if (!state.secret && state.health?.secretRequired) return;
  if (!force && historyHasBreakdown(state.history)) return;
  if (state.historyRequest) return state.historyRequest;
  state.historyLoading = true;
  state.historyRequest = (async () => {
    try {
      const full = await fetchJson('/api/history', { secret: state.secret });
      if (full && Array.isArray(full.daily)) state.history = full;
    } catch (error) {
      if (error.status === 401) showAuth(true);
      // Keep any previously loaded full history; charts fall back to historyPreview totals.
    } finally {
      state.historyLoading = false;
      state.historyRequest = null;
    }
  })();
  return state.historyRequest;
}

function applyStatsSnapshot(stats) {
  if (!stats || typeof stats !== 'object') return;
  const previous = state.stats;
  const historyChanged = Boolean(previous)
    && (previous.historyRevision !== stats.historyRevision
      || previous.deviceHistoryRevision !== stats.deviceHistoryRevision);
  const subscriptionsChanged = Boolean(previous)
    && previous.subscriptionsUpdatedAt !== stats.subscriptionsUpdatedAt;
  state.stats = stats;
  state.loading = false;
  state.error = null;
  if (historyChanged) {
    state.history = null;
    if (state.prefs.view === 'overview' || state.prefs.view === 'trends') {
      void ensureHistory({ force: true }).then(() => render());
    }
  }
  if (subscriptionsChanged && state.subscriptions) {
    void loadSubscriptions({ force: true, preserveDraft: hasDirtyFormDraft('subscription:') });
  }
  render();
}

async function refreshStats() {
  state.error = null;
  const stats = await fetchJson('/api/stats', { secret: state.secret });
  applyStatsSnapshot(stats);
  return stats;
}

function connectStream() {
  if (state.stopStream) {
    state.stopStream();
    state.stopStream = null;
  }
  state.stopStream = openStatsStream({
    secret: state.secret,
    onStatus: setStreamStatus,
    onStats: (stats) => {
      applyStatsSnapshot(stats);
    },
    onRetry: (delay) => {
      if (state.stream !== 'live') setStreamStatus('retrying');
      if (delay) els.streamStatus.title = `${tr('status.retrying')} · ${Math.ceil(delay / 1000)}s`;
    }
  });
}

function startManagementRequest(kind) {
  state.managementControllers[kind]?.abort();
  const controller = new AbortController();
  const seq = (state.managementRequestSeq[kind] || 0) + 1;
  state.managementRequestSeq[kind] = seq;
  state.managementControllers[kind] = controller;
  return { controller, seq };
}

function isCurrentManagementRequest(kind, seq) {
  return state.managementRequestSeq[kind] === seq;
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

async function loadSubscriptions({ force = false, preserveDraft = false } = {}) {
  if (!force && state.subscriptions) return state.subscriptions;
  if (!force && state.subscriptionsLoading) return state.managementPromises.subscriptions || state.subscriptions;
  const { controller, seq } = startManagementRequest('subscriptions');
  state.subscriptionsLoading = true;
  state.subscriptionsError = null;
  const keepDraft = Boolean(preserveDraft || hasDirtyFormDraft('subscription:'));
  const request = (async () => {
    try {
      const next = await fetchJson('/api/subscriptions', { secret: state.secret, signal: controller.signal });
      if (!isCurrentManagementRequest('subscriptions', seq)) return state.subscriptions;
      if (keepDraft && state.subscriptions) {
        state.subscriptionsPending = next;
        state.subscriptionsConflict = true;
      } else {
        state.subscriptions = next;
        state.subscriptionsPending = null;
        state.subscriptionsConflict = false;
      }
      return state.subscriptions;
    } catch (error) {
      if (!isCurrentManagementRequest('subscriptions', seq) || isAbortError(error)) return state.subscriptions;
      state.subscriptionsError = error;
      if (error.status === 401) showAuth(true);
      return null;
    } finally {
      if (isCurrentManagementRequest('subscriptions', seq)) {
        state.subscriptionsLoading = false;
        state.managementControllers.subscriptions = null;
        state.managementPromises.subscriptions = null;
        if (state.prefs.view === 'management' && state.prefs.managementTab === 'subscriptions') render();
      }
    }
  })();
  state.managementPromises.subscriptions = request;
  return request;
}

async function loadPricing({ force = false } = {}) {
  if (!force && state.pricing) return state.pricing;
  if (!force && state.pricingLoading) return state.managementPromises.pricing || state.pricing;
  const { controller, seq } = startManagementRequest('pricing');
  state.pricingLoading = true;
  state.pricingError = null;
  const request = (async () => {
    try {
      const payload = await fetchJson('/api/pricing', { secret: state.secret, signal: controller.signal });
      if (!isCurrentManagementRequest('pricing', seq)) return state.pricing;
      state.pricing = Array.isArray(payload?.pricing) ? payload.pricing : [];
      return state.pricing;
    } catch (error) {
      if (!isCurrentManagementRequest('pricing', seq) || isAbortError(error)) return state.pricing;
      state.pricingError = error;
      if (error.status === 401) showAuth(true);
      return null;
    } finally {
      if (isCurrentManagementRequest('pricing', seq)) {
        state.pricingLoading = false;
        state.managementControllers.pricing = null;
        state.managementPromises.pricing = null;
        if (state.prefs.view === 'management' && state.prefs.managementTab === 'pricing') render();
      }
    }
  })();
  state.managementPromises.pricing = request;
  return request;
}

async function loadAccounts({ force = false } = {}) {
  if (!force && state.accounts) return state.accounts;
  if (!force && state.accountsLoading) return state.managementPromises.accounts || state.accounts;
  const { controller, seq } = startManagementRequest('accounts');
  state.accountsLoading = true;
  state.accountsError = null;
  const request = (async () => {
    try {
      const payload = await fetchJson('/api/accounts', { secret: state.secret, signal: controller.signal });
      if (!isCurrentManagementRequest('accounts', seq)) return state.accounts;
      state.accounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
      return state.accounts;
    } catch (error) {
      if (!isCurrentManagementRequest('accounts', seq) || isAbortError(error)) return state.accounts;
      state.accountsError = error;
      if (error.status === 401) showAuth(true);
      return null;
    } finally {
      if (isCurrentManagementRequest('accounts', seq)) {
        state.accountsLoading = false;
        state.managementControllers.accounts = null;
        state.managementPromises.accounts = null;
        if (state.prefs.view === 'accounts') render();
      }
    }
  })();
  state.managementPromises.accounts = request;
  return request;
}

function accountRecords() {
  return Array.isArray(state.accounts) ? state.accounts : [];
}

function accountField(record, key, fallback = '') {
  const value = record?.[key];
  return escapeHtml(value === undefined || value === null ? fallback : value);
}

function accountCredentialField(record, key, fallback = '') {
  const value = record?.credentialMetadata?.[key];
  return escapeHtml(value === undefined || value === null ? fallback : value);
}

function renderAccounts() {
  if (state.accountsLoading && !state.accounts) return loadingHtml();
  if (state.accountsError && !state.accounts) {
    return managementError(tr('accounts.title'), state.accountsError, 'accounts-retry');
  }
  const records = accountRecords();
  const editing = records.find((record) => record.id === state.accountEditId) || null;
  const currentProvider = editing?.provider || state.accountSelectedProvider || 'deepseek';
  const canManage = state.authorization?.scopes?.includes('admin');

  const healthyCount = records.filter((r) => r.enabled !== false && r.status === 'ok').length;
  const errorCount = records.filter((r) => r.enabled !== false && r.status && r.status !== 'ok').length;
  const disabledCount = records.filter((r) => r.enabled === false).length;

  const summary = `
    <div class="summary-chip"><span class="summary-label">${escapeHtml(tr('status.accounts'))}</span><strong>${records.length}</strong></div>
    <div class="summary-chip"><span class="summary-label">${escapeHtml(tr('accounts.statusOk'))}</span><strong>${healthyCount}</strong></div>
    ${errorCount ? `<div class="summary-chip"><span class="summary-label">${escapeHtml(tr('accounts.statusError'))}</span><strong style="color:var(--warn, #e06c75)">${errorCount}</strong></div>` : ''}
    ${disabledCount ? `<div class="summary-chip"><span class="summary-label">${escapeHtml(tr('accounts.statusDisabled'))}</span><strong>${disabledCount}</strong></div>` : ''}
  `;

  const list = records.length
    ? `<div class="management-list">${records.map((record) => {
      const providerLabel = clientLabel(record.provider);
      const isOk = record.status === 'ok';
      const isRefreshing = record.status === 'refreshing' || record.status === 'pending';
      const isDisabled = record.enabled === false;
      let badgeTone = 'warn';
      let badgeText = escapeHtml(record.status || 'unknown');
      if (isDisabled) {
        badgeTone = 'stale';
        badgeText = tr('accounts.statusDisabled');
      } else if (isRefreshing) {
        badgeTone = 'warn';
        badgeText = tr('accounts.statusRefreshing');
      } else if (isOk) {
        badgeTone = 'ok';
        badgeText = tr('accounts.statusOk');
      }

      const metaParts = [
        providerLabel,
        record.label ? escapeHtml(record.label) : '',
        record.accountEmail || record.accountKey ? escapeHtml(record.accountEmail || record.accountKey) : '',
        record.lastSuccessAt ? tr('accounts.lastRefresh', { time: escapeHtml(formatRelative(record.lastSuccessAt, state.locale)) }) : ''
      ].filter(Boolean);

      const errorDetail = record.lastErrorMessage ? `<div class="row-sub row-error" style="color:var(--warn, #e06c75);margin-top:4px;">${escapeHtml(record.lastErrorMessage)}</div>` : '';

      return `<article class="management-row account-management-row ${record.id === state.accountEditId ? 'is-editing' : ''}">
        <div class="row-main">
          <img class="client-icon" src="${clientIconPath(record.provider)}" alt="" onerror="this.style.display='none'" />
          <div class="row-copy">
            <div class="row-name">
              ${escapeHtml(record.name || providerLabel)}
              <span class="badge ${badgeTone}" style="margin-left:8px;font-size:11px;">${badgeText}</span>
            </div>
            <div class="row-sub">${metaParts.join(' · ')}</div>
            ${errorDetail}
          </div>
        </div>
        ${canManage ? `<div class="management-actions">
          <button type="button" class="ghost-btn" data-account-refresh="${escapeHtml(record.id)}" ${state.accountsSaving ? 'disabled' : ''}>${tr('accounts.refresh')}</button>
          <button type="button" class="ghost-btn" data-account-toggle="${escapeHtml(record.id)}" ${state.accountsSaving ? 'disabled' : ''}>${record.enabled === false ? tr('accounts.enabled') : tr('accounts.statusDisabled')}</button>
          <button type="button" class="ghost-btn" data-account-edit="${escapeHtml(record.id)}">${tr('actions.edit')}</button>
          <button type="button" class="danger-btn" data-account-delete="${escapeHtml(record.id)}">${tr('actions.delete')}</button>
        </div>` : ''}
      </article>`;
    }).join('')}</div>`
    : emptyHtml('accounts.empty');

  const isEditing = Boolean(editing);
  const selectedProvider = HUB_ACCOUNT_PROVIDERS.find((provider) => provider.id === currentProvider)
    || { id: currentProvider, label: clientLabel(currentProvider) };
  const providerMenuOpen = !isEditing && state.accountProviderMenuOpen;
  const providerOptionsHtml = HUB_ACCOUNT_PROVIDERS.map((provider) => {
    const selected = provider.id === currentProvider;
    return `<button type="button" class="account-select-option${selected ? ' selected' : ''}" role="option" aria-selected="${selected ? 'true' : 'false'}" data-account-provider-option="${escapeHtml(provider.id)}">
      <img class="account-select-option-icon" src="${escapeHtml(clientIconPath(provider.id))}" alt="" aria-hidden="true" onerror="this.style.display='none'" />
      <span>${escapeHtml(provider.label || clientLabel(provider.id))}</span>
      ${selected ? `<span class="account-select-option-check">${uiIcon('check')}</span>` : ''}
    </button>`;
  }).join('');
  const providerSelectHtml = `
    <div class="account-provider-select${providerMenuOpen ? ' is-open' : ''}" data-account-provider-select data-value="${escapeHtml(currentProvider)}">
      <input type="hidden" name="provider" value="${escapeHtml(currentProvider)}" data-account-provider-input />
      <button type="button" class="account-select-trigger" data-account-provider-trigger aria-haspopup="listbox" aria-expanded="${providerMenuOpen ? 'true' : 'false'}" aria-controls="account-provider-menu" ${isEditing ? 'disabled' : ''}>
        <span class="account-select-current">
          <img class="account-select-current-icon" src="${escapeHtml(clientIconPath(selectedProvider.id))}" alt="" aria-hidden="true" onerror="this.style.display='none'" />
          <span>${escapeHtml(selectedProvider.label || clientLabel(selectedProvider.id))}</span>
        </span>
        <span class="account-select-chevron">${uiIcon('chevronDown')}</span>
      </button>
      <div id="account-provider-menu" class="account-select-menu" data-account-provider-menu role="listbox" aria-label="${escapeHtml(tr('accounts.provider'))}"${providerMenuOpen ? '' : ' hidden'}>
        ${providerOptionsHtml}
      </div>
    </div>`;
  const formTitle = isEditing ? tr('accounts.edit') : tr('accounts.add');
  const isOAuthCandidate = !isEditing && (currentProvider === 'codex' || currentProvider === 'antigravity');
  // If editing, default to simple; if OAuth candidate and mode not explicitly switched to simple/json, default to oauth
  const effectiveMode = isOAuthCandidate
    ? (state.accountFormMode === 'simple' || state.accountFormMode === 'json' ? state.accountFormMode : 'oauth')
    : (state.accountFormMode === 'json' ? 'json' : 'simple');
  const oauthModeActive = effectiveMode === 'oauth';
  const simpleModeActive = effectiveMode === 'simple';

  let simpleFieldsHtml;
  switch (currentProvider) {
    case 'claude':
    case 'commandcode':
    case 'ollama':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="sessionKey=... / cookie" ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'codex':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.codexAuthJson')}</span><textarea name="authJson" rows="3" spellcheck="false" autocomplete="off" placeholder="${escapeHtml(tr('accounts.codexAuthJsonPlaceholder'))}"></textarea></label>
        <label class="field"><span>${tr('accounts.accessToken')}</span><input name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.codexAccessTokenPlaceholder'))}" /></label>
        <label class="field"><span>Account ID (optional)</span><input name="accountId" value="${accountCredentialField(editing, 'accountId')}" spellcheck="false" placeholder="chatgpt_account_id" /></label>
      `;
      break;
    case 'antigravity':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.agyEndpoint')}</span><input name="endpoint" type="url" value="${accountCredentialField(editing, 'endpoint')}" spellcheck="false" placeholder="http://127.0.0.1:port" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>${tr('accounts.agyCsrfToken')}</span><input name="csrfToken" type="password" autocomplete="off" spellcheck="false" placeholder="csrf token" ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'qoder':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="cookie" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>${tr('accounts.site')}</span><select name="site"><option value="global"${accountCredentialField(editing, 'site', 'global') === 'global' ? ' selected' : ''}>Global</option><option value="cn"${accountCredentialField(editing, 'site') === 'cn' ? ' selected' : ''}>China (CN)</option></select></label>
      `;
      break;
    case 'mimo':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="userId=...; serviceToken=..." ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'copilot':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.accessToken')}</span><input name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="ghu_... / token" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>Enterprise Host (optional)</span><input name="enterpriseHost" value="${accountCredentialField(editing, 'enterpriseHost')}" spellcheck="false" placeholder="github.mycompany.com" /></label>
      `;
      break;
    case 'volcengine':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.accessKeyId')}</span><input name="accessKeyId" value="${accountCredentialField(editing, 'accessKeyId')}" spellcheck="false" placeholder="AKLT..." /></label>
        <label class="field"><span>${tr('accounts.secretAccessKey')}</span><input name="secretAccessKey" type="password" autocomplete="off" spellcheck="false" placeholder="Secret Access Key" /></label>
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Ark API Key (alternative)" /></label>
        <label class="field"><span>${tr('accounts.region')}</span><input name="region" value="${accountCredentialField(editing, 'region')}" spellcheck="false" placeholder="cn-beijing" /></label>
      `;
      break;
    case 'zaiteam':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>Organization ID</span><input name="organizationId" value="${accountCredentialField(editing, 'organizationId')}" spellcheck="false" placeholder="org_..." ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>Project ID</span><input name="projectId" value="${accountCredentialField(editing, 'projectId')}" spellcheck="false" placeholder="proj_..." ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'thirdparty':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.thirdPartyAdapter')}</span><select name="adapter"><option value="newapi"${accountCredentialField(editing, 'adapter', 'newapi') === 'newapi' ? ' selected' : ''}>New API / OneAPI</option><option value="custom"${accountCredentialField(editing, 'adapter') === 'custom' ? ' selected' : ''}>Custom</option></select></label>
        <label class="field"><span>${tr('accounts.thirdPartyBaseUrl')}</span><input name="baseUrl" type="url" value="${accountCredentialField(editing, 'baseUrl')}" spellcheck="false" placeholder="https://api.example.com" ${isEditing ? '' : 'required'} /></label>
        <label class="field field-wide"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'zai':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>${tr('accounts.region')}</span><select name="region"><option value="global"${accountCredentialField(editing, 'region', 'global') === 'global' ? ' selected' : ''}>Global</option><option value="cn"${accountCredentialField(editing, 'region') === 'cn' ? ' selected' : ''}>China (BigModel)</option></select></label>
      `;
      break;
    case 'kimi':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." /></label>
        <label class="field"><span>Web Access Token</span><input name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="Access token" /></label>
      `;
      break;
    case 'opencode':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" /></label>
        <label class="field"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="Cookie / Token" /></label>
      `;
      break;
    default:
      // deepseek, openrouter, minimax
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." ${isEditing ? '' : 'required'} /></label>
      `;
      break;
  }

  let credentialInputsHtml;
  if (oauthModeActive) {
    const session = state.oauthSession && state.oauthSession.provider === currentProvider
      ? state.oauthSession
      : null;
    credentialInputsHtml = `
      <div class="account-oauth-wizard">
        <div class="account-oauth-step">
          <strong>${escapeHtml(tr('accounts.oauthStep1'))}</strong>
          <p class="muted tiny">${escapeHtml(tr('accounts.oauthStep1Desc'))}</p>
          ${session ? `
            <div class="account-oauth-link-row">
              <input type="text" readonly value="${escapeHtml(session.authUrl)}" class="account-oauth-link-input" />
              <button type="button" class="primary-btn" data-account-oauth-open="${escapeHtml(session.authUrl)}">${tr('accounts.oauthOpenLink')}</button>
              <button type="button" class="ghost-btn" data-account-oauth-copy="${escapeHtml(session.authUrl)}">${tr('accounts.oauthCopyLink')}</button>
            </div>
          ` : `
            <button type="button" class="primary-btn" data-account-oauth-start="${escapeHtml(currentProvider)}" ${state.oauthLoading ? 'disabled' : ''}>
              ${state.oauthLoading ? tr('accounts.oauthStarting') : tr('accounts.oauthStart')}
            </button>
          `}
        </div>
        ${session ? `
          <div class="account-oauth-step account-oauth-step-secondary">
            <strong>${escapeHtml(tr('accounts.oauthStep2'))}</strong>
            <p class="muted tiny">${escapeHtml(tr('accounts.oauthStep2Desc'))}</p>
            <input name="redirectUrl" required placeholder="${escapeHtml(tr('accounts.oauthUrlPlaceholder'))}" class="account-oauth-redirect-input" spellcheck="false" autocomplete="off" />
            <input type="hidden" name="oauthSessionId" value="${escapeHtml(session.sessionId)}" />
          </div>
        ` : ''}
      </div>
    `;
  } else if (simpleModeActive) {
    credentialInputsHtml = `<div class="form-grid account-simple-fields">${simpleFieldsHtml}</div>`;
  } else {
    credentialInputsHtml = `<label class="field field-wide">
        <span>${tr('accounts.modeJson')}</span>
        <textarea name="credentialJson" rows="4" spellcheck="false" autocomplete="off" placeholder='{"apiKey":"sk-..."}'></textarea>
      </label>`;
  }

  const accountDraftKey = `account:${editing?.id || 'new'}`;
  const form = `<form class="management-form account-form" data-account-form data-account-mode="${escapeHtml(effectiveMode)}" data-draft-key="${escapeHtml(accountDraftKey)}">
    <div class="form-section-head">
      <div>
        <h3>${formTitle}</h3>
        <p class="muted tiny">${tr('accounts.hint')}</p>
        ${isEditing ? `<p class="muted tiny">${tr('accounts.credentialKeepHint')}</p>` : ''}
      </div>
      <div class="account-form-head-actions">
        <div class="mode-toggle-group">
          ${isOAuthCandidate ? `<button type="button" class="ghost-btn ${oauthModeActive ? 'active' : ''}" data-account-mode="oauth">${tr('accounts.oauthModeToggle')}</button>` : ''}
          <button type="button" class="ghost-btn ${!oauthModeActive && simpleModeActive ? 'active' : ''}" data-account-mode="simple">${tr('accounts.modeSimple')}</button>
          <button type="button" class="ghost-btn ${!oauthModeActive && !simpleModeActive ? 'active' : ''}" data-account-mode="json">${tr('accounts.modeJson')}</button>
        </div>
        ${isEditing ? `<button type="button" class="ghost-btn" data-account-reset>${tr('actions.cancel')}</button>` : ''}
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <span>${tr('accounts.provider')}</span>
        ${providerSelectHtml}
      </div>
      <label class="field">
        <span>${tr('accounts.name')}</span>
        <input name="name" required value="${accountField(editing, 'name')}" placeholder="${currentProvider}-1" maxlength="128" />
      </label>
      <label class="field field-wide">
        <span>${tr('accounts.label')}</span>
        <input name="label" value="${accountField(editing, 'label')}" placeholder="Production / Personal" maxlength="256" />
      </label>
      ${isEditing ? `
      <label class="check-row field-wide">
        <input name="enabled" type="checkbox" ${editing?.enabled !== false ? 'checked' : ''} />
        <span>${tr('accounts.enabled')}</span>
      </label>` : ''}
    </div>
    ${credentialInputsHtml}
    ${(currentProvider === 'codex' || currentProvider === 'antigravity') ? `
    <div class="account-disclaimer-box">
      <div class="account-disclaimer-head">
        <span class="account-disclaimer-icon">${uiIcon('warning')}</span>
        <strong>${escapeHtml(tr('accounts.disclaimerTitle'))}</strong>
      </div>
      <p class="account-disclaimer-text">${escapeHtml(tr('accounts.disclaimerText'))}</p>
      ${!isEditing ? `
      <label class="check-row account-disclaimer-check">
        <input name="disclaimerAgree" type="checkbox" required />
        <span>${escapeHtml(tr('accounts.disclaimerAgree'))}</span>
      </label>` : ''}
    </div>` : ''}
    ${state.accountFormError ? `<p class="form-error account-form-error" role="alert">${escapeHtml(state.accountFormError)}</p>` : ''}
    <div class="drawer-actions">
      <button type="submit" class="primary-btn" ${state.accountsSaving ? 'disabled' : ''}>
        ${state.accountsSaving ? tr('actions.saving') : tr('actions.save')}
      </button>
    </div>
  </form>`;

  const management = state.authorization?.scopes?.includes('admin')
    ? panel(tr('accounts.add'), form)
    : '';

  return `${panel(tr('accounts.title'), `<div class="summary-grid account-summary">${summary}</div>${list}`)}${management}`;
}

function renderAccountsPage() {
  return `<section class="page-intro"><div><div class="eyebrow">${escapeHtml(tr('page.overview.kicker'))}</div><h2>${escapeHtml(tr('nav.accounts'))}</h2><p>${escapeHtml(tr('page.accounts.description'))}</p></div></section>${renderAccounts()}`;
}

function setAccountProviderMenuOpen(open) {
  const wrapper = els.content.querySelector('[data-account-provider-select]');
  if (!wrapper) {
    state.accountProviderMenuOpen = false;
    return;
  }
  state.accountProviderMenuOpen = Boolean(open);
  wrapper.classList.toggle('is-open', state.accountProviderMenuOpen);
  const trigger = wrapper.querySelector('[data-account-provider-trigger]');
  const menu = wrapper.querySelector('[data-account-provider-menu]');
  trigger?.setAttribute('aria-expanded', state.accountProviderMenuOpen ? 'true' : 'false');
  if (menu) {
    menu.hidden = !state.accountProviderMenuOpen;
  }
}

async function saveAccountFromForm(form) {
  const values = new FormData(form);
  const editing = state.accounts?.find((a) => a.id === state.accountEditId) || null;
  const mode = String(form.dataset.accountMode || state.accountFormMode || 'simple');
  const draftKey = draftKeyForForm(form);
  const provider = editing ? editing.provider : String(values.get('provider') || '').trim().toLowerCase();
  const name = String(values.get('name') || '').trim();
  const label = String(values.get('label') || '').trim();
  const enabled = values.get('enabled') !== null ? values.get('enabled') === 'on' : true;

  if (!name) throw new Error(tr('accounts.nameRequired'));
  if (!provider) throw new Error(tr('accounts.providerRequired'));

  const oauthMode = !editing && mode === 'oauth' && (provider === 'codex' || provider === 'antigravity');
  if (oauthMode) {
    const agree = values.get('disclaimerAgree');
    if (agree !== 'on') throw new Error(tr('accounts.disclaimerRequired'));
    const sessionId = String(values.get('oauthSessionId') || '').trim();
    const redirectUrl = String(values.get('redirectUrl') || '').trim();
    if (!sessionId || !redirectUrl) throw new Error(tr('accounts.oauthStep2Desc'));

    state.accountsSaving = true;
    state.accountFormError = '';
    render();
    try {
      await fetchJson('/api/accounts/oauth/exchange', {
        secret: state.secret,
        method: 'POST',
        body: { sessionId, redirectUrl, name, label }
      });
      state.oauthSession = null;
      state.accountFormMode = 'simple';
      state.accountSelectedProvider = 'deepseek';
      state.accountFormError = '';
      clearFormDraft(draftKey);
      showToast(tr('accounts.updated'));
      await loadAccounts({ force: true });
      await refreshStats();
    } catch (error) {
      state.accountFormError = error.message || tr('error.generic');
      showToast(state.accountFormError);
    } finally {
      state.accountsSaving = false;
      render();
    }
    return;
  }

  let credential = null;
  if (mode === 'json') {
    const rawJson = String(values.get('credentialJson') || '').trim();
    if (rawJson) {
      try {
        credential = JSON.parse(rawJson);
      } catch (err) {
        throw new Error(tr('accounts.invalidJson'), { cause: err });
      }
      if (!credential || typeof credential !== 'object' || Array.isArray(credential)) {
        throw new Error(tr('accounts.invalidJson'));
      }
    }
  } else {
    // Simple mode
    const apiKey = String(values.get('apiKey') || '').trim();
    const cookie = String(values.get('cookie') || '').trim();
    const accessToken = String(values.get('accessToken') || '').trim();
    const accessKeyId = String(values.get('accessKeyId') || '').trim();
    const secretAccessKey = String(values.get('secretAccessKey') || '').trim();
    const region = String(values.get('region') || '').trim();
    const site = String(values.get('site') || '').trim();
    const organizationId = String(values.get('organizationId') || '').trim();
    const projectId = String(values.get('projectId') || '').trim();
    const adapter = String(values.get('adapter') || '').trim();
    const baseUrl = String(values.get('baseUrl') || '').trim();
    const enterpriseHost = String(values.get('enterpriseHost') || '').trim();
    const authJson = String(values.get('authJson') || '').trim();
    const endpoint = String(values.get('endpoint') || '').trim();
    const csrfToken = String(values.get('csrfToken') || '').trim();
    const accountId = String(values.get('accountId') || '').trim();

    const credObj = {};
    if (apiKey) credObj.apiKey = apiKey;
    if (cookie) credObj.cookie = cookie;
    if (accessToken) credObj.accessToken = accessToken;
    if (accessKeyId) credObj.accessKeyId = accessKeyId;
    if (secretAccessKey) credObj.secretAccessKey = secretAccessKey;
    if (region) credObj.region = region;
    if (site) credObj.site = site;
    if (organizationId) credObj.organizationId = organizationId;
    if (projectId) credObj.projectId = projectId;
    if (enterpriseHost) credObj.enterpriseHost = enterpriseHost;
    if (endpoint) credObj.endpoint = endpoint;
    if (csrfToken) credObj.csrfToken = csrfToken;
    if (accountId) credObj.accountId = accountId;
    if (authJson) {
      try { credObj.authJson = JSON.parse(authJson); }
      catch (_) { credObj.authJson = authJson; }
    }
    if (adapter || baseUrl) {
      credObj.adapter = adapter || 'newapi';
      credObj.baseUrl = baseUrl;
    }
    if (Object.keys(credObj).length > 0) {
      credential = credObj;
    }
  }

  if (!editing && !credential) {
    throw new Error(tr('accounts.credentialRequired'));
  }

  if (!editing && (provider === 'codex' || provider === 'antigravity')) {
    const agree = values.get('disclaimerAgree');
    if (agree !== 'on') {
      throw new Error(tr('accounts.disclaimerRequired'));
    }
  }

  state.accountsSaving = true;
  state.accountFormError = '';
  render();
  try {
    if (editing) {
      const patch = { name, label, enabled };
      if (credential) {
        patch.credential = credential;
        patch.credentialMode = mode === 'json' ? 'replace' : 'merge';
      }
      await fetchJson(`/api/accounts/${encodeURIComponent(editing.id)}`, {
        secret: state.secret,
        method: 'PATCH',
        body: patch
      });
      state.accountEditId = '';
    } else {
      await fetchJson('/api/accounts', {
        secret: state.secret,
        method: 'POST',
        body: { provider, name, label, credential }
      });
    }
    clearFormDraft(draftKey);
    state.accountFormError = '';
    state.accountFormMode = 'simple';
    state.accountSelectedProvider = 'deepseek';
    showToast(tr('accounts.updated'));
    await loadAccounts({ force: true });
    await refreshStats();
  } catch (error) {
    state.accountFormError = error.message || tr('error.generic');
    showToast(state.accountFormError);
  } finally {
    state.accountsSaving = false;
    render();
  }
}

async function refreshAccount(accountId) {
  if (!accountId) return;
  state.accountsSaving = true;
  render();
  try {
    await fetchJson(`/api/accounts/${encodeURIComponent(accountId)}/refresh`, {
      secret: state.secret,
      method: 'POST'
    });
    showToast(tr('toast.refreshed'));
    await loadAccounts({ force: true });
    await refreshStats();
  } catch (error) {
    showToast(error.message || tr('error.generic'));
  } finally {
    state.accountsSaving = false;
    render();
  }
}

async function toggleAccount(accountId) {
  const account = state.accounts?.find((a) => a.id === accountId);
  if (!account) return;
  state.accountsSaving = true;
  render();
  try {
    await fetchJson(`/api/accounts/${encodeURIComponent(accountId)}`, {
      secret: state.secret,
      method: 'PATCH',
      body: { enabled: !account.enabled }
    });
    showToast(tr('accounts.updated'));
    await loadAccounts({ force: true });
    await refreshStats();
  } catch (error) {
    showToast(error.message || tr('error.generic'));
  } finally {
    state.accountsSaving = false;
    render();
  }
}

async function deleteAccount(accountId) {
  const account = state.accounts?.find((a) => a.id === accountId);
  if (!account) return;
  if (!window.confirm(tr('accounts.confirmDelete', { name: account.name || account.provider }))) return;
  state.accountsSaving = true;
  render();
  try {
    await fetchJson(`/api/accounts/${encodeURIComponent(accountId)}`, {
      secret: state.secret,
      method: 'DELETE'
    });
    if (state.accountEditId === accountId) state.accountEditId = '';
    clearFormDraft(`account:${accountId}`);
    showToast(tr('accounts.deleted'));
    await loadAccounts({ force: true });
    await refreshStats();
  } catch (error) {
    showToast(error.message || tr('error.generic'));
  } finally {
    state.accountsSaving = false;
    render();
  }
}

async function bootstrapAuthorized() {
  showAuth(false);
  state.loading = true;
  state.error = null;
  render();
  await refreshStats();
  const capabilities = state.authorization?.capabilities || state.health?.capabilities || {};
  await Promise.all([
    ensureHistory(),
    capabilities.subscriptions === false ? null : loadSubscriptions(),
    capabilities.pricing === false ? null : loadPricing(),
    capabilities.hubAccounts === false ? null : loadAccounts()
  ]);
  connectStream();
  render();
}

async function tryConnect(secret, remember = true) {
  state.secret = String(secret || '').trim();
  try {
    await fetchJson('/api/stats', { secret: state.secret });
    state.authorization = await fetchJson('/api/capabilities', { secret: state.secret });
    saveSecret(state.secret, remember);
    els.authError.classList.add('hidden');
    await bootstrapAuthorized();
    return true;
  } catch (error) {
    if (error.status === 401) {
      els.authError.textContent = tr('auth.error');
      els.authError.classList.remove('hidden');
      showAuth(true);
      return false;
    }
    state.error = error;
    state.loading = false;
    showAuth(false);
    render();
    return false;
  }
}

async function deleteDevice(deviceId) {
  if (!deviceId) return;
  if (!window.confirm(tr('devices.confirmDelete'))) return;
  await fetchJson(`/api/devices/${encodeURIComponent(deviceId)}`, {
    secret: state.secret,
    method: 'DELETE'
  });
  showToast(tr('toast.deleted'));
  await refreshStats();
}

async function renameDevice(deviceId) {
  if (!deviceId) return;
  const nextDeviceId = String(window.prompt(tr('devices.renamePrompt'), deviceId) || '').trim();
  if (!nextDeviceId || nextDeviceId === deviceId) return;
  if (!window.confirm(tr('devices.renameCredentialWarning'))) return;
  await fetchJson(`/api/devices/${encodeURIComponent(deviceId)}/rename`, {
    secret: state.secret,
    method: 'POST',
    body: { deviceId: nextDeviceId }
  });
  showToast(tr('devices.renamed'));
  await refreshStats();
}

function subscriptionFromForm(form) {
  const values = new FormData(form);
  const id = String(state.subscriptionEditId || '').trim();
  const existing = subscriptionRecords().find((record) => record.id === id) || null;
  const kind = values.get('kind') === 'topup' ? 'topup' : 'subscription';
  if (!String(values.get('provider') || '').trim()) throw new Error(tr('subscriptions.providerRequired'));
  let startDate = String(values.get('startDate') || '').trim();
  let amountMinor = Math.max(0, Math.round(Number(values.get('amount') || 0) * 100));
  let topUps = [];
  if (kind === 'topup') {
    const rows = [...form.querySelectorAll('[data-topup-row]')];
    topUps = rows.map((row) => ({
      id: row.getAttribute('data-topup-id') || `top_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: String(row.querySelector('[data-topup-date]')?.value || '').trim(),
      amountMinor: Math.max(0, Math.round(Number(row.querySelector('[data-topup-amount]')?.value || 0) * 100))
    }));
    if (!topUps.length || topUps.some((entry) => !entry.date)) throw new Error(tr('subscriptions.dateRequired'));
    amountMinor = topUps.reduce((sum, entry) => sum + entry.amountMinor, 0);
    startDate = null;
  } else if (!startDate) {
    throw new Error(tr('subscriptions.dateRequired'));
  }
  return {
    ...(existing || {}),
    id: id || undefined,
    provider: String(values.get('provider') || '').trim(),
    kind,
    binding: {
      ...(existing?.binding || {}),
      profileName: String(values.get('profileName') || '').trim(),
      accountEmail: String(values.get('accountEmail') || '').trim()
    },
    planName: String(values.get('planName') || '').trim(),
    amountMinor,
    currency: String(values.get('currency') || 'USD').toUpperCase(),
    interval: values.get('interval') === 'year' ? 'year' : 'month',
    intervalCount: Math.max(1, Math.min(24, Math.round(Number(values.get('intervalCount') || 1)))),
    startDate: kind === 'topup' ? null : startDate,
    topUps,
    autoRenew: kind === 'subscription' && values.get('autoRenew') === 'on',
    nextRenewalOverride: String(values.get('nextRenewalOverride') || '').trim() || null,
    endDate: String(values.get('endDate') || '').trim() || null,
    note: String(values.get('note') || '').trim()
  };
}

async function saveSubscriptions(next) {
  const draftKey = `subscription:${state.subscriptionEditId || 'new'}`;
  state.subscriptionsSaving = true;
  render();
  try {
    const response = await fetchJson('/api/subscriptions', {
      secret: state.secret,
      method: 'PUT',
      body: {
        baseUpdatedAt: state.subscriptions?.updatedAt || '',
        subscriptions: next
      }
    });
    state.subscriptions = response;
    state.subscriptionEditId = '';
    clearFormDraft(draftKey);
    state.subscriptionsConflict = false;
    state.subscriptionsPending = null;
    state.subscriptionsError = null;
    showToast(tr('toast.saved'));
  } catch (error) {
    if (error.status === 409 && error.payload?.subscriptions) {
      state.subscriptionsPending = error.payload;
      state.subscriptionsConflict = true;
      showToast(tr('subscriptions.conflict'));
    } else {
      state.subscriptionsError = error;
      showToast(error.message || tr('error.generic'));
    }
  } finally {
    state.subscriptionsSaving = false;
    render();
  }
}

async function deleteSubscription(id) {
  const record = subscriptionRecords().find((entry) => entry.id === id);
  if (!record || !window.confirm(tr('subscriptions.confirmDelete'))) return;
  await saveSubscriptions(subscriptionRecords().filter((entry) => entry.id !== id));
}

async function savePricingForm(form) {
  const values = new FormData(form);
  const draftKey = draftKeyForForm(form);
  const model = String(values.get('model') || '').trim();
  if (!model) return;
  const fields = ['inputPricePerMillion', 'outputPricePerMillion', 'cacheReadPricePerMillion', 'cacheWritePricePerMillion'];
  const prices = {};
  for (const field of fields) {
    const value = Number(values.get(field));
    if (!Number.isFinite(value) || value < 0) {
      showToast(tr('pricing.invalid'));
      return;
    }
    prices[field] = value;
  }
  state.pricingSaving = true;
  render();
  try {
    await fetchJson(`/api/pricing/${encodeURIComponent(model)}`, {
      secret: state.secret,
      method: 'PUT',
      body: prices
    });
    await loadPricing({ force: true });
    clearFormDraft(draftKey);
    showToast(tr('toast.saved'));
  } catch (error) {
    showToast(error.message || tr('error.generic'));
  } finally {
    state.pricingSaving = false;
    render();
  }
}

async function fetchPricingUpstream(model) {
  if (!model) return;
  state.pricingSaving = true;
  render();
  try {
    await fetchJson(`/api/pricing/${encodeURIComponent(model)}/fetch-upstream`, {
      secret: state.secret,
      method: 'POST'
    });
    await loadPricing({ force: true });
    showToast(tr('pricing.updated'));
  } catch (error) {
    showToast(error.message || tr('pricing.fetchFailed'));
  } finally {
    state.pricingSaving = false;
    render();
  }
}

async function fetchAllPricing() {
  state.pricingSaving = true;
  render();
  try {
    await fetchJson('/api/pricing/fetch-upstream-all', { secret: state.secret, method: 'POST' });
    await loadPricing({ force: true });
    showToast(tr('pricing.updated'));
  } catch (error) {
    showToast(error.message || tr('pricing.fetchFailed'));
  } finally {
    state.pricingSaving = false;
    render();
  }
}

async function applyCustomRange() {
  const fromValue = els.rangeFrom.value;
  const toValue = els.rangeTo.value;
  if (!fromValue || !toValue) {
    els.rangeError.textContent = tr('range.invalid');
    els.rangeError.classList.remove('hidden');
    return;
  }
  const from = new Date(fromValue);
  const to = new Date(toValue);
  if (!(from.getTime() < to.getTime())) {
    els.rangeError.textContent = tr('range.invalid');
    els.rangeError.classList.remove('hidden');
    return;
  }
  try {
    const payload = await fetchJson(`/api/usage/range?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, {
      secret: state.secret
    });
    state.customRange = { from: from.toISOString(), to: to.toISOString() };
    state.customPeriod = {
      totalTokens: payload.totalTokens || 0,
      costUsd: payload.costUsd || 0,
      clients: payload.clients || {},
      clientCosts: payload.clientCosts || {},
      models: payload.models || {},
      modelCosts: payload.modelCosts || {},
      projects: payload.projects || {},
      sessions: payload.sessions || {}
    };
    openRange(false);
    render();
  } catch {
    els.rangeError.textContent = tr('range.failed');
    els.rangeError.classList.remove('hidden');
  }
}

function clearCustomRange() {
  state.customRange = null;
  state.customPeriod = null;
  openRange(false);
  render();
}

function switchView(viewId, { updateHistory = true, replace = false, tab = '' } = {}) {
  const target = String(viewId || 'overview').trim().replace(/^\/+/, '');
  const legacy = LEGACY_ROUTE_ALIASES[`/${target}`];
  const validView = legacy?.view || normalizeViewId(target);
  const nextUsageTab = tab || legacy?.usageTab || state.prefs.usageTab;
  const nextManagementTab = tab || legacy?.managementTab || state.prefs.managementTab;
  const nextLimitTab = tab || legacy?.limitTab || state.prefs.limitTab;
  const usageTab = ['tools', 'models', 'projects', 'sessions'].includes(nextUsageTab) ? nextUsageTab : 'tools';
  const managementTab = ['subscriptions', 'pricing'].includes(nextManagementTab) ? nextManagementTab : 'subscriptions';
  const limitTab = nextLimitTab === 'health' ? 'health' : 'limits';
  const changed = state.prefs.view !== validView
    || (validView === 'usage' && state.prefs.usageTab !== usageTab)
    || (validView === 'management' && state.prefs.managementTab !== managementTab)
    || (validView === 'limits' && state.prefs.limitTab !== limitTab);
  state.prefs.view = validView;
  if (validView === 'usage') state.prefs.usageTab = usageTab;
  if (validView === 'management') state.prefs.managementTab = managementTab;
  if (validView === 'limits') state.prefs.limitTab = limitTab;
  savePrefs({
    view: validView,
    usageTab: state.prefs.usageTab,
    managementTab: state.prefs.managementTab,
    limitTab: state.prefs.limitTab
  });
  if (updateHistory) {
    syncUrlForView(validView, {
      replace: replace || !changed,
      tab: validView === 'usage' ? usageTab : validView === 'management' ? managementTab : (validView === 'limits' && limitTab === 'health' ? 'health' : '')
    });
  }
  openNav(false);
  if (validView === 'management' && state.prefs.managementTab === 'subscriptions') void loadSubscriptions().then(() => render());
  if (validView === 'management' && state.prefs.managementTab === 'pricing') void loadPricing().then(() => render());
  if (validView === 'accounts') void loadAccounts().then(() => render());
  if (validView === 'trends' || validView === 'overview') {
    void ensureHistory().then(() => render());
    return;
  }
  if (!changed && !updateHistory) return;
  render();
}

function bindEvents() {
  window.addEventListener('popstate', () => {
    const route = routeFromLocation();
    switchView(route.view, {
      updateHistory: false,
      tab: route.usageTab || route.managementTab || route.limitTab
    });
  });

  els.primaryNav.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-view]');
    if (!btn) return;
    switchView(btn.dataset.view);
  });

  if (els.deviceFilter) {
    els.deviceFilter.addEventListener('change', () => {
      state.prefs.deviceFilter = els.deviceFilter.value || '';
      savePrefs({ deviceFilter: state.prefs.deviceFilter });
      render();
    });
  }

  els.periodTabs.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-period]');
    if (!btn) return;
    if (btn.dataset.period === 'custom') {
      openRange(true);
      return;
    }
    state.customPeriod = null;
    state.customRange = null;
    state.prefs.period = btn.dataset.period;
    savePrefs({ period: state.prefs.period });
    render();
  });


  const chartTip = document.createElement('div');
  chartTip.id = 'chartTip';
  chartTip.className = 'chart-tip hidden';
  chartTip.setAttribute('role', 'tooltip');
  document.body.appendChild(chartTip);

  function placeChartTip(clientX, clientY) {
    const pad = 12;
    const rect = chartTip.getBoundingClientRect();
    let left = clientX + 14;
    let top = clientY + 14;
    if (left + rect.width + pad > window.innerWidth) left = clientX - rect.width - 14;
    if (top + rect.height + pad > window.innerHeight) top = clientY - rect.height - 14;
    chartTip.style.left = `${Math.max(pad, left)}px`;
    chartTip.style.top = `${Math.max(pad, top)}px`;
  }

  function showChartTip(text, clientX, clientY) {
    if (!text) {
      chartTip.classList.add('hidden');
      return;
    }
    chartTip.textContent = text;
    chartTip.classList.remove('hidden');
    placeChartTip(clientX, clientY);
  }

  els.content.addEventListener('pointerover', (event) => {
    const hit = event.target.closest('[data-tip]');
    if (!hit || !els.content.contains(hit)) return;
    showChartTip(hit.getAttribute('data-tip') || '', event.clientX, event.clientY);
  });
  els.content.addEventListener('pointermove', (event) => {
    const hit = event.target.closest('[data-tip]');
    if (!hit || !els.content.contains(hit)) {
      chartTip.classList.add('hidden');
      return;
    }
    showChartTip(hit.getAttribute('data-tip') || '', event.clientX, event.clientY);
  });
  els.content.addEventListener('pointerleave', () => {
    chartTip.classList.add('hidden');
  });

  els.content.addEventListener('click', (event) => {
    const usageTab = event.target.closest('[data-usage-tab]');
    if (usageTab) {
      state.prefs.usageTab = ['tools', 'models', 'projects', 'sessions'].includes(usageTab.dataset.usageTab)
        ? usageTab.dataset.usageTab
        : 'tools';
      savePrefs({ usageTab: state.prefs.usageTab });
      switchView('usage', { tab: state.prefs.usageTab });
      return;
    }
    const managementTab = event.target.closest('[data-management-tab]');
    if (managementTab) {
      const nextTab = managementTab.dataset.managementTab === 'pricing' ? 'pricing' : 'subscriptions';
      state.prefs.managementTab = nextTab;
      savePrefs({ managementTab: nextTab });
      switchView('management', { tab: nextTab });
      return;
    }
    const jumpView = event.target.closest('[data-jump-view]');
    if (jumpView) {
      const view = jumpView.dataset.jumpView;
      if (jumpView.dataset.jumpTool) {
        state.prefs.selectedToolId = jumpView.dataset.jumpTool;
        savePrefs({ selectedToolId: state.prefs.selectedToolId });
      }
      if (jumpView.dataset.jumpDevice) {
        state.prefs.selectedDeviceId = jumpView.dataset.jumpDevice;
        savePrefs({ selectedDeviceId: state.prefs.selectedDeviceId });
      }
      switchView(view, { tab: jumpView.dataset.jumpUsageTab || '' });
      return;
    }
    const webSignOut = event.target.closest('[data-web-signout]');
    if (webSignOut) {
      signOutFromHub();
      return;
    }
    const pwaInstall = event.target.closest('[data-pwa-install]');
    if (pwaInstall) {
      if (!state.deferredInstall) return;
      const promptEvent = state.deferredInstall;
      state.deferredInstall = null;
      void promptEvent.prompt().then(() => promptEvent.userChoice).catch(() => {}).finally(() => refreshPwaUi());
      return;
    }
    const retryDashboard = event.target.closest('[data-retry-dashboard]');
    if (retryDashboard) {
      void bootstrapAuthorized().catch((error) => {
        state.error = error;
        state.loading = false;
        render();
      });
      return;
    }
    const managementRetry = event.target.closest('[data-management-retry]');
    if (managementRetry) {
      if (managementRetry.dataset.managementRetry === 'subscriptions-retry') void loadSubscriptions({ force: true });
      if (managementRetry.dataset.managementRetry === 'pricing-retry') void loadPricing({ force: true });
      if (managementRetry.dataset.managementRetry === 'accounts-retry') void loadAccounts({ force: true });
      return;
    }
    const accountRefresh = event.target.closest('[data-account-refresh]');
    if (accountRefresh) {
      void refreshAccount(accountRefresh.dataset.accountRefresh);
      return;
    }
    const accountToggle = event.target.closest('[data-account-toggle]');
    if (accountToggle) {
      void toggleAccount(accountToggle.dataset.accountToggle);
      return;
    }
    const accountEdit = event.target.closest('[data-account-edit]');
    if (accountEdit) {
      state.accountEditId = accountEdit.dataset.accountEdit || '';
      state.accountFormError = '';
      state.accountFormMode = 'simple';
      state.accountProviderMenuOpen = false;
      render();
      return;
    }
    const accountReset = event.target.closest('[data-account-reset]');
    if (accountReset) {
      clearFormDraft(`account:${state.accountEditId || 'new'}`);
      state.accountEditId = '';
      state.accountFormError = '';
      state.accountFormMode = 'simple';
      state.accountProviderMenuOpen = false;
      render();
      return;
    }
    const accountDelete = event.target.closest('[data-account-delete]');
    if (accountDelete) {
      void deleteAccount(accountDelete.dataset.accountDelete);
      return;
    }
    const accountMode = event.target.closest('button[data-account-mode]');
    if (accountMode) {
      state.accountFormMode = accountMode.dataset.accountMode;
      state.accountFormError = '';
      render();
      return;
    }
    const accountProviderTrigger = event.target.closest('[data-account-provider-trigger]');
    if (accountProviderTrigger) {
      event.preventDefault();
      setAccountProviderMenuOpen(!state.accountProviderMenuOpen);
      return;
    }
    const accountProviderOption = event.target.closest('[data-account-provider-option]');
    if (accountProviderOption) {
      event.preventDefault();
      const provider = String(accountProviderOption.dataset.accountProviderOption || '').trim().toLowerCase();
      const previousProvider = state.accountSelectedProvider;
      state.accountSelectedProvider = provider || 'deepseek';
      state.accountProviderMenuOpen = false;
      if (previousProvider === state.accountSelectedProvider) {
        setAccountProviderMenuOpen(false);
        return;
      }
      state.oauthSession = null;
      state.accountFormError = '';
      state.accountFormMode = state.accountSelectedProvider === 'codex' || state.accountSelectedProvider === 'antigravity'
        ? 'oauth'
        : 'simple';
      render();
      return;
    }
    if (state.accountProviderMenuOpen && !event.target.closest('[data-account-provider-select]')) {
      setAccountProviderMenuOpen(false);
    }
    const accountOAuthStart = event.target.closest('[data-account-oauth-start]');
    if (accountOAuthStart) {
      const form = accountOAuthStart.closest('form');
      const providerInput = form?.querySelector('[data-account-provider-input]');
      const provider = String(providerInput?.value || accountOAuthStart.dataset.accountOAuthStart || state.accountSelectedProvider || '').trim().toLowerCase();
      state.oauthLoading = true;
      render();
      void (async () => {
        try {
          const res = await fetchJson('/api/accounts/oauth/start', {
            secret: state.secret,
            method: 'POST',
            body: { provider }
          });
          state.oauthSession = res;
        } catch (err) {
          showToast(err.message || tr('error.generic'));
        } finally {
          state.oauthLoading = false;
          render();
        }
      })();
      return;
    }
    const accountOAuthOpen = event.target.closest('[data-account-oauth-open]');
    if (accountOAuthOpen) {
      const url = accountOAuthOpen.dataset.accountOauthOpen;
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) showToast(tr('error.generic'));
      return;
    }
    const accountOAuthCopy = event.target.closest('[data-account-oauth-copy]');
    if (accountOAuthCopy) {
      const url = accountOAuthCopy.dataset.accountOauthCopy;
      if (!navigator.clipboard?.writeText) {
        showToast(tr('error.generic'));
        return;
      }
      void navigator.clipboard.writeText(url).then(() => {
        showToast(tr('accounts.oauthLinkCopied'));
      }).catch(() => {
        showToast(tr('error.generic'));
      });
      return;
    }
    const topUpAdd = event.target.closest('[data-topup-add]');
    if (topUpAdd) {
      const form = topUpAdd.closest('[data-subscription-form]');
      const ledger = form?.querySelector('[data-topup-ledger]');
      if (!form || !ledger) return;
      const id = `top_new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      ledger.insertAdjacentHTML('beforeend', subscriptionTopUpRowHtml({ id, date: '', amount: '' }));
      rememberFormDraft(form);
      ledger.querySelector(`[data-topup-id="${id}"] [data-topup-date]`)?.focus();
      return;
    }
    const topUpRemove = event.target.closest('[data-topup-remove]');
    if (topUpRemove) {
      const form = topUpRemove.closest('[data-subscription-form]');
      const row = topUpRemove.closest('[data-topup-row]');
      if (!form || !row) return;
      row.remove();
      rememberFormDraft(form);
      return;
    }
    const subscriptionEdit = event.target.closest('[data-subscription-edit]');
    if (subscriptionEdit) {
      state.subscriptionEditId = subscriptionEdit.dataset.subscriptionEdit || '';
      render();
      return;
    }
    const subscriptionReloadLatest = event.target.closest('[data-subscription-reload-latest]');
    if (subscriptionReloadLatest) {
      for (const key of state.formDrafts.keys()) {
        if (key.startsWith('subscription:')) state.formDrafts.delete(key);
      }
      if (state.subscriptionsPending) {
        state.subscriptions = state.subscriptionsPending;
        state.subscriptionsPending = null;
        state.subscriptionsConflict = false;
        state.subscriptionEditId = '';
        render();
      } else {
        void loadSubscriptions({ force: true });
      }
      return;
    }
    const subscriptionReset = event.target.closest('[data-subscription-reset]');
    if (subscriptionReset) {
      clearFormDraft(`subscription:${state.subscriptionEditId || 'new'}`);
      state.subscriptionEditId = '';
      render();
      return;
    }
    const subscriptionDelete = event.target.closest('[data-subscription-delete]');
    if (subscriptionDelete) {
      void deleteSubscription(subscriptionDelete.dataset.subscriptionDelete);
      return;
    }
    const pricingUpstream = event.target.closest('[data-pricing-upstream]');
    if (pricingUpstream) {
      void fetchPricingUpstream(pricingUpstream.dataset.pricingUpstream);
      return;
    }
    const pricingRefresh = event.target.closest('[data-pricing-refresh-all]');
    if (pricingRefresh) {
      void fetchAllPricing();
      return;
    }
    const limitProvider = event.target.closest('[data-limit-provider]');
    if (limitProvider) return;
    const del = event.target.closest('[data-delete-device]');
    if (del) {
      void deleteDevice(del.getAttribute('data-delete-device')).catch((error) => {
        if (error.status === 401) showAuth(true);
        else showToast(error.message || tr('error.generic'));
      });
      return;
    }
    const rename = event.target.closest('[data-rename-device]');
    if (rename) {
      void renameDevice(rename.getAttribute('data-rename-device')).catch((error) => {
        showToast(error.message || tr('error.generic'));
      });
      return;
    }
    const heatmapMetric = event.target.closest('[data-heatmap-metric]');
    if (heatmapMetric) {
      state.prefs.heatmapMetric = heatmapMetric.dataset.heatmapMetric === 'tokens' ? 'tokens' : 'cost';
      savePrefs({ heatmapMetric: state.prefs.heatmapMetric });
      render();
      return;
    }
    const activeDaysWindow = event.target.closest('[data-active-days-window]');
    if (activeDaysWindow) {
      state.prefs.activeDaysWindow = activeDaysWindow.dataset.activeDaysWindow === 'year' ? 'year' : 'all';
      savePrefs({ activeDaysWindow: state.prefs.activeDaysWindow });
      render();
      return;
    }
    const selectTool = event.target.closest('[data-select-tool]');
    if (selectTool) {
      state.prefs.selectedToolId = selectTool.dataset.selectTool || '';
      savePrefs({ selectedToolId: state.prefs.selectedToolId });
      render();
      return;
    }
    const selectDevice = event.target.closest('[data-select-device]');
    if (selectDevice && !event.target.closest('[data-delete-device]')) {
      state.prefs.selectedDeviceId = selectDevice.dataset.selectDevice || '';
      savePrefs({ selectedDeviceId: state.prefs.selectedDeviceId });
      render();
      return;
    }
    const devicePeriod = event.target.closest('[data-device-period]');
    if (devicePeriod) {
      state.prefs.deviceDetailPeriod = devicePeriod.dataset.devicePeriod || 'today';
      savePrefs({ deviceDetailPeriod: state.prefs.deviceDetailPeriod });
      render();
      return;
    }
    const stack = event.target.closest('[data-stack]');
    if (stack) {
      state.prefs.trendsStack = stack.dataset.stack;
      savePrefs({ trendsStack: state.prefs.trendsStack });
      render();
      return;
    }
    const range = event.target.closest('[data-range]');
    if (range) {
      state.prefs.trendsRange = range.dataset.range;
      savePrefs({ trendsRange: state.prefs.trendsRange });
      render();
      return;
    }
    const trendMetric = event.target.closest('[data-trends-metric]');
    if (trendMetric) {
      state.prefs.trendsMetric = ['tokens', 'cost', 'activeTime'].includes(trendMetric.dataset.trendsMetric)
        ? trendMetric.dataset.trendsMetric
        : 'tokens';
      savePrefs({ trendsMetric: state.prefs.trendsMetric });
      render();
    }
  });

  els.content.addEventListener('input', (event) => {
    rememberFormDraft(event.target);
  });

  els.content.addEventListener('change', (event) => {
    rememberFormDraft(event.target);
    const subscriptionKind = event.target.closest('[data-subscription-kind]');
    if (subscriptionKind) {
      render();
      return;
    }
    const provider = event.target.closest('[data-limit-provider]');
    if (provider) {
      state.limitProvider = provider.value || '';
      render();
      return;
    }
  });

  els.content.addEventListener('keydown', (event) => {
    const trigger = event.target.closest('[data-account-provider-trigger]');
    if (trigger) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setAccountProviderMenuOpen(true);
        els.content.querySelector('[data-account-provider-option]')?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setAccountProviderMenuOpen(false);
      }
      return;
    }
    const option = event.target.closest('[data-account-provider-option]');
    if (!option) return;
    const options = [...els.content.querySelectorAll('[data-account-provider-option]')];
    const index = options.indexOf(option);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = event.key === 'ArrowDown'
        ? (index + 1) % options.length
        : (index - 1 + options.length) % options.length;
      options[nextIndex]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      option.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setAccountProviderMenuOpen(false);
      els.content.querySelector('[data-account-provider-trigger]')?.focus();
    }
  });

  els.content.addEventListener('submit', (event) => {
    const webSettingsForm = event.target.closest('[data-web-settings-form]');
    if (webSettingsForm) {
      event.preventDefault();
      void saveWebSettingsForm(webSettingsForm).catch((error) => {
        showToast(error.message || tr('error.generic'));
      });
      return;
    }
    const accountForm = event.target.closest('[data-account-form]');
    if (accountForm) {
      event.preventDefault();
      void saveAccountFromForm(accountForm).catch((error) => {
        state.accountFormError = error.message || tr('error.generic');
        showToast(state.accountFormError);
        render();
      });
      return;
    }
    const subscriptionForm = event.target.closest('[data-subscription-form]');
    if (subscriptionForm) {
      event.preventDefault();
      try {
        const next = subscriptionRecords().filter((record) => record.id !== state.subscriptionEditId);
        next.push(subscriptionFromForm(subscriptionForm));
        void saveSubscriptions(next);
      } catch (error) {
        showToast(error.message || tr('error.generic'));
      }
      return;
    }
    const pricingFormElement = event.target.closest('[data-pricing-form]');
    if (pricingFormElement) {
      event.preventDefault();
      void savePricingForm(pricingFormElement);
    }
  });

  els.refreshBtn.addEventListener('click', async () => {
    try {
      await refreshStats();
      state.history = null;
      await ensureHistory();
      await Promise.all([
        loadSubscriptions({ force: true }),
        loadPricing({ force: true }),
        loadAccounts({ force: true })
      ]);
      showToast(tr('toast.refreshed'));
    } catch (error) {
      if (error.status === 401) showAuth(true);
      else {
        state.error = error;
        render();
      }
    }
  });

  els.customRangeBtn.addEventListener('click', () => openRange(true));
  els.rangeClose.addEventListener('click', () => openRange(false));
  els.rangeApply.addEventListener('click', () => void applyCustomRange());
  els.rangeClear.addEventListener('click', () => clearCustomRange());
  els.rangePopover.addEventListener('click', (event) => {
    if (event.target === els.rangePopover) openRange(false);
  });

  if (els.menuToggle) {
    els.menuToggle.addEventListener('click', () => openNav(!state.navOpen));
  }
  if (els.navScrim) {
    els.navScrim.addEventListener('click', () => openNav(false));
  }
  window.addEventListener('keydown', (event) => {
    if (trapOverlayFocus(event)) return;
    if (event.key === 'Escape') {
      if (!els.rangePopover.classList.contains('hidden')) {
        event.preventDefault();
        openRange(false);
        return;
      }
      if (!els.settingsDrawer.classList.contains('hidden')) {
        event.preventDefault();
        openSettings(false);
        return;
      }
      openNav(false);
      setAccountProviderMenuOpen(false);
    }
  });
  document.addEventListener('click', (event) => {
    if (state.accountProviderMenuOpen && !event.target.closest('[data-account-provider-select]')) {
      setAccountProviderMenuOpen(false);
    }
  });
  window.addEventListener('resize', () => {
    if (!isMobileNav()) openNav(false);
    refreshPwaUi();
  });

  const navigateToSettingsAndCloseNav = () => {
    openNav(false);
    switchView('settings');
  };
  els.customRangeBtn?.setAttribute('aria-controls', 'rangePopover');
  els.customRangeBtn?.setAttribute('aria-expanded', 'false');
  els.settingsOpen?.addEventListener('click', navigateToSettingsAndCloseNav);
  if (els.settingsOpenTop) {
    els.settingsOpenTop.addEventListener('click', navigateToSettingsAndCloseNav);
  }
  els.settingsDrawer.querySelectorAll('[data-close-settings]').forEach((el) => {
    el.addEventListener('click', () => openSettings(false));
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    refreshPwaUi();
  });
  window.addEventListener('appinstalled', () => {
    state.deferredInstall = null;
    state.pwaDismissed = true;
    localStorage.setItem('token-monitor.hub.pwaDismissed', '1');
    refreshPwaUi();
    showToast(tr('pwa.installed'));
  });
  if (els.pwaInstallBtn) {
    els.pwaInstallBtn.addEventListener('click', async () => {
      if (!state.deferredInstall) return;
      const promptEvent = state.deferredInstall;
      state.deferredInstall = null;
      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch {
        /* user dismissed native sheet */
      }
      refreshPwaUi();
    });
  }
  if (els.pwaDismissBtn) {
    els.pwaDismissBtn.addEventListener('click', () => {
      state.pwaDismissed = true;
      localStorage.setItem('token-monitor.hub.pwaDismissed', '1');
      refreshPwaUi();
    });
  }
  els.saveSettingsBtn.addEventListener('click', async () => {
    state.prefs.language = els.languageSelect.value;
    state.prefs.theme = els.themeSelect.value;
    state.prefs.currency = els.currencySelect.value;
    if (els.homeLimitAccountCount) {
      state.prefs.homeLimitAccountCount = clampHomeLimitAccountCount(els.homeLimitAccountCount.value, 3);
      els.homeLimitAccountCount.value = String(state.prefs.homeLimitAccountCount);
    }
    savePrefs({
      language: state.prefs.language,
      theme: state.prefs.theme,
      currency: state.prefs.currency,
      homeLimitAccountCount: state.prefs.homeLimitAccountCount
    });
    const nextSecret = els.settingsSecret.value.trim();
    const secretChanged = nextSecret !== state.secret;
    applyTheme();
    applyLocale();
    if (secretChanged) {
      const ok = await tryConnect(nextSecret, true);
      if (!ok) return;
    }
    openSettings(false);
    showToast(tr('toast.saved'));
  });
  els.signOutBtn.addEventListener('click', () => {
    openSettings(false);
    signOutFromHub();
  });

  els.authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await tryConnect(els.secretInput.value, els.rememberSecret.checked);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((state.prefs.theme || 'system') === 'system') applyTheme();
  });
}

async function init() {
  renderStaticUiIcons();
  applyTheme();
  applyLocale();
  bindEvents();
  renderChrome();

  if ('serviceWorker' in navigator && window.isSecureContext) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (reg?.update) void reg.update();
    } catch {
      /* optional when the browser rejects the worker */
    }
  }
  refreshPwaUi();

  try {
    state.health = await fetchHealth();
  } catch {
    state.health = { secretRequired: true };
  }

  if (!state.health.secretRequired) {
    await tryConnect('', true);
    return;
  }

  if (state.secret) {
    const ok = await tryConnect(state.secret, Boolean(localStorage.getItem('token-monitor.hub.secret')));
    if (ok) return;
  }
  showAuth(true);
}

void init();
