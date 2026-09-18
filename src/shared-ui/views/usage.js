// Usage view: per-tool drill-down plus the model/project/session breakdowns.
//
// Extracted from app.js so a view can be read and tested on its own. Renders from
// the app's shared state; anything host-specific goes through transport/.

import {
  formatCost,
  formatNumber,
  formatRelative
} from '../core/format.js';
import {
  clientIconPath,
  mapRows,
  modelColor,
  modelRows,
  periodActivityCounts,
  periodTokenMetrics,
  projectRows,
  sessionRows
} from '../core/data.js';
import { tr, escapeHtml, appState, viewHelper } from '../core/viewContext.js';
import { renderListView, usageMetricCard } from './rows.js';

const panel = (...args) => viewHelper('panel')(...args);
const viewStats = (...args) => viewHelper('viewStats')(...args);
const activePeriod = (...args) => viewHelper('activePeriod')(...args);
const uiIcon = (...args) => viewHelper('uiIcon')(...args);
const toolRows = (...args) => viewHelper('toolRows')(...args);
const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const shareBarHtml = (...args) => viewHelper('shareBarHtml')(...args);
const renderHistoryScopeNotice = (...args) => viewHelper('renderHistoryScopeNotice')(...args);

export function renderTools() {
  const period = activePeriod();
  const tools = toolRows(period).map((row) => ({ ...row, client: row.key }));
  if (!tools.length) return emptyHtml('empty.usage');
  const selectedId = appState().prefs.selectedToolId || tools[0].key;
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
          <div class="row-cost">${formatCost(row.cost, appState().prefs.currency)}</div>
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



export function renderUsageMetricStrip(period) {
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

export function renderTokenMix(metrics = {}) {
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

export function renderUsageSubnav() {
  const current = ['tools', 'models', 'projects', 'sessions'].includes(appState().prefs.usageTab)
    ? appState().prefs.usageTab
    : 'tools';
  return `<nav class="page-tabs" aria-label="${escapeHtml(tr('nav.usage'))}" role="tablist">
    ${['tools', 'models', 'projects', 'sessions'].map((tab) => `<button type="button" role="tab" aria-selected="${current === tab ? 'true' : 'false'}" class="page-tab${current === tab ? ' active' : ''}" data-usage-tab="${tab}">${escapeHtml(tr(`usage.tabs.${tab}`))}</button>`).join('')}
  </nav>`;
}

export function usageRowSummary(row, { icon = false, detail = '' } = {}) {
  const iconHtml = icon
    ? `<img class="client-icon" src="${clientIconPath(row.client || row.key)}" alt="" onerror="this.style.display='none'" />`
    : `<span class="swatch" style="background:${row.color || 'var(--accent)'}"></span>`;
  const suffix = row.percent != null ? ` · ${Math.round(row.percent)}%` : '';
  return `<div class="usage-table-row-main"><div class="row-main">${iconHtml}<div class="row-copy"><div class="row-name">${escapeHtml(row.name)}</div><div class="row-sub">${escapeHtml(`${row.sub || ''}${suffix}`.replace(/^ · | · $/g, ''))}</div></div></div><div class="row-metrics"><div class="row-value">${formatNumber(row.value)}</div><div class="row-cost">${formatCost(row.cost, appState().prefs.currency)}</div></div>${detail ? `<span class="usage-row-chevron">${uiIcon('chevronDown')}</span>` : ''}</div>`;
}

export function renderUsageMetricRows(rows, { kind, showIcon = false, emptyKey = 'empty.usage' } = {}) {
  if (!rows.length) return renderListView([], emptyKey);
  return `<div class="usage-table" data-usage-kind="${escapeHtml(kind || '')}">${rows.map((row) => {
    const hasMetrics = row.metrics && row.metrics.totalTokens > 0;
    const detail = hasMetrics ? `<div class="usage-row-detail"><div class="usage-detail-label">${escapeHtml(tr('usage.breakdown'))}</div>${renderTokenMix(row.metrics)}</div>` : '';
    return detail
      ? `<details class="usage-table-row"><summary>${usageRowSummary(row, { icon: showIcon, detail: true })}</summary>${detail}</details>`
      : `<article class="usage-table-row">${usageRowSummary(row, { icon: showIcon })}</article>`;
  }).join('')}</div>`;
}

export function renderUsageModels(period) {
  const rows = modelRows(period);
  return panel(tr('usage.tabs.models'), renderUsageMetricRows(rows, { kind: 'model' }));
}

export function renderUsageProjects(period) {
  const projectData = projectRows(period, { incomplete: Boolean(viewStats()?.projectsIncomplete) && appState().prefs.period === 'allTime' });
  const incompleteBanner = projectData.incomplete
    ? `<div class="notice warn" role="status">${escapeHtml(tr('projects.incomplete'))}</div>`
    : '';
  const rangeBanner = appState().customPeriod
    ? `<div class="notice" role="status">${escapeHtml(tr('usage.rangeDetailsUnavailable'))}</div>`
    : '';
  return `${rangeBanner}${incompleteBanner}${panel(tr('usage.tabs.projects'), renderUsageMetricRows(projectData.rows, { kind: 'project', emptyKey: 'empty.projects' }))}`;
}

export function renderUsageSessions(period) {
  const sessionData = sessionRows(period);
  const truncated = sessionData.truncated
    ? `<div class="notice" role="status">${escapeHtml(tr('sessions.truncated', { shown: sessionData.rows.length, total: sessionData.total }))}</div>`
    : '';
  const rangeBanner = appState().customPeriod
    ? `<div class="notice" role="status">${escapeHtml(tr('usage.rangeDetailsUnavailable'))}</div>`
    : '';
  const rows = sessionData.rows.map((row) => ({
    ...row,
    sub: `${row.sub || ''}${row.lastUsedAt ? ` · ${formatRelative(row.lastUsedAt, appState().locale)}` : ''}`
  }));
  return `${rangeBanner}${truncated}${panel(tr('usage.tabs.sessions'), renderUsageMetricRows(rows, { kind: 'session', showIcon: true, emptyKey: 'empty.sessions' }))}`;
}

export function renderUsage() {
  const period = activePeriod();
  const tab = ['tools', 'models', 'projects', 'sessions'].includes(appState().prefs.usageTab)
    ? appState().prefs.usageTab
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

