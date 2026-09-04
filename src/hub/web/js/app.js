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
  modelColor
} from './data.js';

const VIEWS = [
  { id: 'home', icon: '⌂' },
  { id: 'tool', icon: '⚒' },
  { id: 'device', icon: '▣' },
  { id: 'model', icon: '◈' },
  { id: 'project', icon: '◫' },
  { id: 'session', icon: '☰' },
  { id: 'limits', icon: '◔' },
  { id: 'status', icon: '◉' },
  { id: 'trends', icon: '∿' },
  { id: 'subscriptions', icon: '◌' },
  { id: 'pricing', icon: '¤' }
];

const PERIODS = ['today', 'month', 'allTime'];

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
  homeReturnBtn: document.getElementById('homeReturnBtn'),
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

const state = {
  prefs: {
    language: 'auto',
    theme: 'system',
    currency: 'USD',
    view: 'home',
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
    ...loadPrefs()
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
  pricing: null,
  pricingLoading: false,
  pricingError: null,
  pricingSaving: false,
  limitProvider: '',
  loading: true,
  error: null,
  customRange: null,
  customPeriod: null,
  stream: 'offline',
  stopStream: null,
  toastTimer: null,
  navOpen: false,
  deferredInstall: null,
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
    limits: device.limits || { providers: [] },
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

function openSettings(open) {
  els.settingsDrawer.classList.toggle('hidden', !open);
  els.settingsDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) {
    els.languageSelect.value = state.prefs.language || 'auto';
    els.themeSelect.value = state.prefs.theme || 'system';
    els.currencySelect.value = state.prefs.currency || 'USD';
    if (els.homeLimitAccountCount) {
      els.homeLimitAccountCount.value = String(clampHomeLimitAccountCount(state.prefs.homeLimitAccountCount, 3));
    }
    els.settingsSecret.value = state.secret || '';
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
  els.rangePopover.classList.toggle('hidden', !open);
  if (open) {
    const now = new Date();
    const start = state.customRange?.from
      ? new Date(state.customRange.from)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = state.customRange?.to ? new Date(state.customRange.to) : now;
    els.rangeFrom.value = toDatetimeLocalValue(start);
    els.rangeTo.value = toDatetimeLocalValue(end);
    els.rangeError.classList.add('hidden');
  }
}

function renderChrome() {
  const capabilities = state.authorization?.capabilities || state.health?.capabilities || {};
  const admin = state.authorization?.scopes?.includes('admin');
  const visibleViews = VIEWS.filter((view) => view.id !== 'pricing' || (capabilities.pricing !== false && admin));
  if (!visibleViews.some((view) => view.id === state.prefs.view)) state.prefs.view = 'home';
  els.primaryNav.innerHTML = visibleViews.map((view) => `
    <button type="button" class="nav-btn ${state.prefs.view === view.id ? 'active' : ''}" data-view="${view.id}">
      <span class="nav-ico" aria-hidden="true">${view.icon}</span>
      <span class="nav-label">${tr(`nav.${view.id}`)}</span>
    </button>
  `).join('');
  if (els.customRangeBtn) els.customRangeBtn.classList.toggle('hidden', capabilities.usageRange === false);

  els.periodTabs.innerHTML = [
    ...PERIODS.map((period) => `
      <button type="button" class="period-tab ${!state.customPeriod && state.prefs.period === period ? 'active' : ''}" data-period="${period}">
        ${tr(`period.${period}`)}
      </button>
    `),
    state.customPeriod ? `<button type="button" class="period-tab active" data-period="custom">${tr('period.custom')}</button>` : ''
  ].join('');

  els.pageTitle.textContent = tr(`nav.${state.prefs.view}`);
  const allDevices = state.stats?.devices || [];
  const devices = allDevices.length;
  const periodLabel = state.customPeriod
    ? tr('period.custom')
    : tr(`period.${state.prefs.period}`);
  const selectedDevice = allDevices.find((device) => device.deviceId === state.prefs.deviceFilter);
  const selectedLabel = selectedDevice ? ` · ${selectedDevice.hostname || selectedDevice.deviceId}` : '';
  els.pageMeta.textContent = `${periodLabel} · ${devices} ${tr('stats.devices').toLowerCase()}${selectedLabel}`;
  if (els.deviceFilter) {
    const current = state.prefs.deviceFilter || '';
    els.deviceFilter.innerHTML = [
      `<option value="">${escapeHtml(tr('filters.allDevices'))}</option>`,
      ...allDevices.map((device) => `<option value="${escapeHtml(device.deviceId || '')}">${escapeHtml(device.hostname || device.deviceId || tr('devices.title'))}</option>`)
    ].join('');
    els.deviceFilter.value = allDevices.some((device) => device.deviceId === current) ? current : '';
  }
  if (els.homeReturnBtn) {
    const onHome = state.prefs.view === 'home';
    els.homeReturnBtn.classList.toggle('hidden', onHome);
    els.homeReturnBtn.title = tr('home.return');
    els.homeReturnBtn.setAttribute('aria-label', tr('home.return'));
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

function panel(title, body, meta = '') {
  return `
    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">${escapeHtml(title)}</h2>
        ${meta ? `<div class="panel-meta tiny">${escapeHtml(meta)}</div>` : ''}
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
  return state.prefs.deviceFilter
    ? `<div class="notice" role="status">${escapeHtml(tr('data.historyGlobal'))}</div>`
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

  const toolsBody = tools.length
    ? `<div class="stack">${tools.map((row) => rowHtml({ ...row, client: row.key }, { showIcon: true, sub: `${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const modelsBody = models.length
    ? `<div class="stack">${models.map((row) => rowHtml(row, { sub: `${Math.round((row.value / Math.max(1, period.totalTokens || 0)) * 100)}%` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const devicesBody = devices.length
    ? `<div class="stack">${devices.map((row) => rowHtml(row, { sub: `${row.platformDisplay || devicePlatformLabel(row.platform, row.osName, row.osVersion)}${row.stale ? ` · ${tr('devices.stale')}` : ''}` })).join('')}</div>`
    : emptyHtml('empty.usage');
  const limitsBody = limits.length
    ? `<div class="stack">${limits.map((card) => `
        <div class="row">
          <div class="row-main">
            <img class="client-icon" src="${clientIconPath(card.provider)}" alt="" onerror="this.style.display='none'" />
            <div class="row-copy">
              <div class="row-name">${escapeHtml(card.name)}</div>
              <div class="row-sub">${escapeHtml(clientLabel(card.provider))}${card.plan ? ` · ${escapeHtml(card.plan)}` : ''}${card.accountEmail && card.name !== card.accountEmail ? ` · ${escapeHtml(card.accountEmail)}` : ''}</div>
            </div>
          </div>
          <div class="row-metrics">
            <div class="row-value remaining-tone remaining-tone-${card.lowestRemaining == null ? 'unknown' : limitRemainingTone(card.lowestRemaining)}">${card.lowestRemaining == null ? '—' : `${Math.round(card.lowestRemaining)}%`}</div>
            <div class="row-cost">${card.stale ? tr('devices.stale') : tr('devices.live')}</div>
          </div>
        </div>
      `).join('')}</div>`
    : emptyHtml('empty.limits');

  const activeTime = Number(summary?.activeTimeMs || 0);
  const completeness = renderCompletenessNotice(stats, state.prefs.period);
  const summaryBody = (summary || heatDaily.length)
    ? `
      <div class="summary-grid">
        <div class="summary-chip"><span class="summary-label">${tr('home.activeDays')}</span><strong>${formatNumber(activeDaysValue)}</strong></div>
        <div class="summary-chip"><span class="summary-label">${tr('home.streak')}</span><strong>${formatNumber(summary?.currentStreak || 0)}</strong></div>
        <div class="summary-chip"><span class="summary-label">${tr('home.peakDay')}</span><strong>${formatCompact(summary?.peakDayTokens || 0)}</strong></div>
        <div class="summary-chip"><span class="summary-label">${tr('home.activeTime')}</span><strong>${formatDuration(activeTime)}</strong></div>
      </div>
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
    <div class="grid-2">
      ${panel(tr('home.tools'), toolsBody)}
      ${panel(tr('home.models'), modelsBody)}
      ${panel(tr('home.devices'), devicesBody)}
      ${panel(tr('home.limits'), limitsBody)}
    </div>
    ${panel(tr('home.summary'), summaryBody)}
    ${panel(tr('home.activity'), renderSparkline(daily), daily.length ? `${daily.length}d` : '')}
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
        ${models.length ? shareBarHtml(models.slice(0, 16)) : emptyHtml('empty.usage')}
      </section>
    </div>
  `;
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

  return `
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
        <div class="toolbar-row">
          <div class="seg" role="group" aria-label="${tr('devices.period')}">
            ${segButtons([['today', tr('period.today')], ['month', tr('period.month')], ['allTime', tr('period.allTime')]], detailPeriod, 'device-period')}
          </div>
        </div>
        <div class="summary-grid" style="margin:12px 0 16px">
          <div class="summary-chip"><span class="summary-label">${tr('stats.tokens')}</span><strong>${formatNumber(breakdown.totalTokens)}</strong></div>
          <div class="summary-chip"><span class="summary-label">${tr('stats.cost')}</span><strong>${formatCost(breakdown.totalCost, state.prefs.currency)}</strong></div>
        </div>
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
  return filter + renderLimitCards(cards);
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

function renderSubscriptions() {
  if (state.subscriptionsLoading && !state.subscriptions) return loadingHtml();
  if (state.subscriptionsError && !state.subscriptions) {
    return managementError(tr('subscriptions.title'), state.subscriptionsError, 'subscriptions-retry');
  }
  const records = subscriptionRecords();
  const totals = subscriptionMonthlyTotals(records);
  const editing = records.find((record) => record.id === state.subscriptionEditId) || null;
  const firstTopUp = editing?.topUps?.[0] || null;
  const amount = editing?.kind === 'topup' ? Number(firstTopUp?.amountMinor || 0) / 100 : Number(editing?.amountMinor || 0) / 100;
  const summary = Object.entries(totals).length
    ? Object.entries(totals).map(([currency, minor]) => `<div class="summary-chip"><span class="summary-label">${escapeHtml(tr('subscriptions.monthly'))} · ${currency}</span><strong>${escapeHtml(formatSubscriptionMoney(minor, currency))}</strong></div>`).join('')
    : `<div class="summary-chip"><span class="summary-label">${tr('subscriptions.monthly')}</span><strong>—</strong></div>`;
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
          <span class="management-icon">${topUp ? '↗' : '↻'}</span>
          <div class="row-copy"><div class="row-name">${escapeHtml(record.provider || tr('subscriptions.untitled'))}</div><div class="row-sub">${escapeHtml(detail || tr('subscriptions.noDetails'))}</div></div>
        </div>
        <div class="row-metrics"><div class="row-value">${escapeHtml(formatSubscriptionMoney(recordAmount, record.currency))}</div><div class="row-cost">${escapeHtml(record.currency || 'USD')}</div></div>
        <div class="management-actions"><button type="button" class="ghost-btn" data-subscription-edit="${escapeHtml(record.id)}">${tr('actions.edit')}</button><button type="button" class="danger-btn" data-subscription-delete="${escapeHtml(record.id)}">${tr('actions.delete')}</button></div>
      </article>`;
    }).join('')}</div>`
    : emptyHtml('subscriptions.empty');
  const form = `<form class="management-form" data-subscription-form>
    <div class="form-section-head"><div><h3>${editing ? tr('subscriptions.edit') : tr('subscriptions.add')}</h3><p class="muted tiny">${tr('subscriptions.formHint')}</p></div>${editing ? `<button type="button" class="ghost-btn" data-subscription-reset>${tr('actions.cancel')}</button>` : ''}</div>
    <div class="form-grid">
      <label class="field"><span>${tr('subscriptions.provider')}</span><input name="provider" required value="${subscriptionField(editing, 'provider')}" placeholder="codex" /></label>
      <label class="field"><span>${tr('subscriptions.kind')}</span><select name="kind"><option value="subscription"${editing?.kind !== 'topup' ? ' selected' : ''}>${tr('subscriptions.plan')}</option><option value="topup"${editing?.kind === 'topup' ? ' selected' : ''}>${tr('subscriptions.topup')}</option></select></label>
      <label class="field"><span>${tr('subscriptions.planName')}</span><input name="planName" value="${subscriptionField(editing, 'planName')}" placeholder="Pro" /></label>
      <label class="field"><span>${tr('subscriptions.amount')}</span><input name="amount" type="number" min="0" step="0.01" value="${escapeHtml(amount || '')}" required /></label>
      <label class="field"><span>${tr('subscriptions.currency')}</span><select name="currency">${['USD', 'CNY', 'TWD', 'HKD'].map((code) => `<option value="${code}"${(editing?.currency || 'USD') === code ? ' selected' : ''}>${code}</option>`).join('')}</select></label>
      <label class="field"><span>${tr('subscriptions.interval')}</span><select name="interval"><option value="month"${editing?.interval !== 'year' ? ' selected' : ''}>${tr('subscriptions.monthly')}</option><option value="year"${editing?.interval === 'year' ? ' selected' : ''}>${tr('subscriptions.yearly')}</option></select></label>
      <label class="field"><span>${tr('subscriptions.intervalCount')}</span><input name="intervalCount" type="number" min="1" max="24" step="1" value="${subscriptionField(editing, 'intervalCount', '1')}" /></label>
      <label class="field"><span>${tr('subscriptions.startDate')}</span><input name="startDate" type="date" value="${subscriptionField(editing?.kind === 'topup' ? firstTopUp : editing, editing?.kind === 'topup' ? 'date' : 'startDate')}" /></label>
      <label class="field"><span>${tr('subscriptions.nextRenewal')}</span><input name="nextRenewalOverride" type="date" value="${subscriptionField(editing, 'nextRenewalOverride')}" /></label>
      <label class="field"><span>${tr('subscriptions.endDate')}</span><input name="endDate" type="date" value="${subscriptionField(editing, 'endDate')}" /></label>
      <label class="field"><span>${tr('subscriptions.accountEmail')}</span><input name="accountEmail" type="email" value="${subscriptionField(editing?.binding, 'accountEmail')}" /></label>
      <label class="field"><span>${tr('subscriptions.profileName')}</span><input name="profileName" value="${subscriptionField(editing?.binding, 'profileName')}" /></label>
      <label class="field field-wide"><span>${tr('subscriptions.note')}</span><input name="note" value="${subscriptionField(editing, 'note')}" /></label>
    </div>
    <label class="check-row"><input name="autoRenew" type="checkbox"${editing?.autoRenew !== false ? ' checked' : ''} /><span>${tr('subscriptions.autoRenew')}</span></label>
    <div class="drawer-actions"><button type="submit" class="primary-btn"${state.subscriptionsSaving ? ' disabled' : ''}>${state.subscriptionsSaving ? tr('actions.saving') : tr('actions.save')}</button></div>
  </form>`;
  const management = state.authorization?.scopes?.includes('admin') ? panel(tr('subscriptions.manage'), form) : '';
  return `${renderCompletenessNotice(viewStats(), state.prefs.period)}${panel(tr('subscriptions.title'), `<div class="summary-grid subscription-summary">${summary}</div>${list}`)}${management}`;
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
  return `<form class="pricing-form" data-pricing-form data-pricing-model="${escapeHtml(model)}">
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
  return `
    ${renderHistoryScopeNotice()}
    <div class="toolbar-row">
      <div class="seg">
        <button type="button" class="seg-btn ${state.prefs.trendsStack === 'client' ? 'active' : ''}" data-stack="client">${tr('trends.stack.client')}</button>
        <button type="button" class="seg-btn ${state.prefs.trendsStack === 'model' ? 'active' : ''}" data-stack="model">${tr('trends.stack.model')}</button>
      </div>
      <div class="seg">
        ${['7', '30', '90', 'all'].map((range) => `
          <button type="button" class="seg-btn ${String(state.prefs.trendsRange) === range ? 'active' : ''}" data-range="${range}">${range === 'all' ? 'All' : range}</button>
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
    ${panel(tr('home.heatmap'), renderHeatmap(historyDaily(historySource(), 90), heatMetric))}
  `;
}

function render() {
  renderChrome();
  if (state.loading && !state.stats) {
    els.content.innerHTML = loadingHtml();
    return;
  }
  if (state.error && !state.stats) {
    els.content.innerHTML = `<section class="error-card"><div class="error-kicker">Token Monitor</div><h2>${escapeHtml(tr('error.title'))}</h2><p>${escapeHtml(state.error.message || tr('error.generic'))}</p><button type="button" class="primary-btn" data-retry-dashboard>${tr('actions.retry')}</button></section>`;
    return;
  }
  renderHero();
  const period = activePeriod();
  let html;
  switch (state.prefs.view) {
    case 'tool':
      html = renderTools();
      break;
    case 'device':
      html = renderDevices();
      break;
    case 'model':
      html = panel(tr('nav.model'), renderListView(modelRows(period), 'empty.usage'));
      break;
    case 'project': {
      const projectData = projectRows(period, { incomplete: Boolean(viewStats()?.projectsIncomplete) && state.prefs.period === 'allTime' });
      const incompleteBanner = projectData.incomplete
        ? `<div class="notice warn" style="margin-bottom:12px">${escapeHtml(tr('projects.incomplete'))}</div>`
        : '';
      html = panel(tr('nav.project'), incompleteBanner + renderListView(projectData.rows, 'empty.projects'));
      break;
    }
    case 'session': {
      const sessionData = sessionRows(period);
      const truncated = sessionData.truncated
        ? `<div class="notice" style="margin-bottom:12px">${escapeHtml(tr('sessions.truncated', { shown: sessionData.rows.length, total: sessionData.total }))}</div>`
        : '';
      html = panel(
        tr('nav.session'),
        truncated + renderListView(
          sessionData.rows.map((row) => ({
            ...row,
            sub: `${row.sub || ''}${row.lastUsedAt ? ` · ${formatRelative(row.lastUsedAt, state.locale)}` : ''}`
          })),
          'empty.sessions',
          { showIcon: true }
        )
      );
      break;
    }
    case 'limits':
      html = renderLimits();
      break;
    case 'status':
      html = renderStatus();
      break;
    case 'trends':
      html = renderTrends();
      break;
    case 'subscriptions':
      html = renderSubscriptions();
      break;
    case 'pricing':
      html = renderPricing();
      break;
    default:
      html = renderHome();
  }
  els.content.innerHTML = html;
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
    if (state.prefs.view === 'home' || state.prefs.view === 'trends') {
      void ensureHistory({ force: true }).then(() => render());
    }
  }
  if (subscriptionsChanged && state.subscriptions) void loadSubscriptions({ force: true });
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

async function loadSubscriptions({ force = false } = {}) {
  if (!force && state.subscriptions) return state.subscriptions;
  if (state.subscriptionsLoading) return state.subscriptions;
  state.subscriptionsLoading = true;
  state.subscriptionsError = null;
  try {
    state.subscriptions = await fetchJson('/api/subscriptions', { secret: state.secret });
    return state.subscriptions;
  } catch (error) {
    state.subscriptionsError = error;
    if (error.status === 401) showAuth(true);
    return null;
  } finally {
    state.subscriptionsLoading = false;
    if (state.prefs.view === 'subscriptions') render();
  }
}

async function loadPricing({ force = false } = {}) {
  if (!force && state.pricing) return state.pricing;
  if (state.pricingLoading) return state.pricing;
  state.pricingLoading = true;
  state.pricingError = null;
  try {
    const payload = await fetchJson('/api/pricing', { secret: state.secret });
    state.pricing = Array.isArray(payload?.pricing) ? payload.pricing : [];
    return state.pricing;
  } catch (error) {
    state.pricingError = error;
    if (error.status === 401) showAuth(true);
    return null;
  } finally {
    state.pricingLoading = false;
    if (state.prefs.view === 'pricing') render();
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
    capabilities.pricing === false ? null : loadPricing()
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
  const startDate = String(values.get('startDate') || '').trim();
  const amountMinor = Math.max(0, Math.round(Number(values.get('amount') || 0) * 100));
  if (!String(values.get('provider') || '').trim()) throw new Error(tr('subscriptions.providerRequired'));
  if (!startDate) throw new Error(tr('subscriptions.dateRequired'));
  const topUps = kind === 'topup'
    ? [{ id: existing?.topUps?.[0]?.id || `top_${Date.now()}`, date: startDate, amountMinor }, ...(existing?.topUps || []).slice(1)]
    : [];
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
    state.subscriptionsError = null;
    showToast(tr('toast.saved'));
  } catch (error) {
    if (error.status === 409 && error.payload?.subscriptions) {
      state.subscriptions = error.payload;
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

function bindEvents() {
  if (els.homeReturnBtn) {
    els.homeReturnBtn.addEventListener('click', () => {
      if (state.prefs.view === 'home') return;
      state.prefs.view = 'home';
      savePrefs({ view: 'home' });
      openNav(false);
      void ensureHistory().then(() => render());
    });
  }
  els.primaryNav.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-view]');
    if (!btn) return;
    state.prefs.view = btn.dataset.view;
    savePrefs({ view: state.prefs.view });
    openNav(false);
    if (state.prefs.view === 'subscriptions') void loadSubscriptions().then(() => render());
    if (state.prefs.view === 'pricing') void loadPricing().then(() => render());
    if (state.prefs.view === 'trends' || state.prefs.view === 'home') {
      void ensureHistory().then(() => render());
      return;
    }
    render();
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
      return;
    }
    const subscriptionEdit = event.target.closest('[data-subscription-edit]');
    if (subscriptionEdit) {
      state.subscriptionEditId = subscriptionEdit.dataset.subscriptionEdit || '';
      render();
      return;
    }
    const subscriptionReset = event.target.closest('[data-subscription-reset]');
    if (subscriptionReset) {
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

  els.content.addEventListener('change', (event) => {
    const provider = event.target.closest('[data-limit-provider]');
    if (!provider) return;
    state.limitProvider = provider.value || '';
    render();
  });

  els.content.addEventListener('submit', (event) => {
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
      await Promise.all([loadSubscriptions({ force: true }), loadPricing({ force: true })]);
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
    if (event.key === 'Escape') openNav(false);
  });
  window.addEventListener('resize', () => {
    if (!isMobileNav()) openNav(false);
    refreshPwaUi();
  });

  const openSettingsAndCloseNav = () => {
    openNav(false);
    openSettings(true);
  };
  els.settingsOpen.addEventListener('click', openSettingsAndCloseNav);
  if (els.settingsOpenTop) {
    els.settingsOpenTop.addEventListener('click', openSettingsAndCloseNav);
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
    clearSecret();
    state.secret = '';
    if (state.stopStream) state.stopStream();
    setStreamStatus('offline');
    openSettings(false);
    showAuth(true);
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
