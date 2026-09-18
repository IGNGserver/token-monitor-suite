// Trends view: charts over the daily history series.
//
// Extracted from app.js so a view can be read and tested on its own. The module
// renders from the app's shared state and never reaches for host APIs — anything
// environment-specific goes through transport/.

import {
  formatCompact,
  formatCost,
  formatNumber
} from '../core/format.js';
import { clientLabel, heatmapValue, historyDaily } from '../core/data.js';
import {
  tr,
  escapeHtml,
  appState,
  viewHelper
} from '../core/viewContext.js';

// Helpers the app owns and installs on the view context. Binding them at module
// scope keeps the extracted render code byte-identical to what it replaced,
// instead of threading a context object through every helper.
const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const panel = (...args) => viewHelper('panel')(...args);
const segButtons = (...args) => viewHelper('segButtons')(...args);
const usageMetricCard = (...args) => viewHelper('usageMetricCard')(...args);
const formatDuration = (...args) => viewHelper('formatDuration')(...args);
const trendValue = (...args) => viewHelper('trendValue')(...args);
const formatTrendValue = (...args) => viewHelper('formatTrendValue')(...args);

export function renderCompletenessNotice(stats, periodName) {
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

export function renderHistoryScopeNotice() {
  const notices = [];
  if (appState().prefs.deviceFilter) notices.push(tr('data.historyGlobal'));
  if (appState().customPeriod) notices.push(tr('usage.customRangeGlobal'));
  return notices.length
    ? notices.map((notice) => `<div class="notice" role="status">${escapeHtml(notice)}</div>`).join('')
    : '';
}


export function historySource() {
  return appState().history || appState().stats?.historyPreview || null;
}

export function historyHasBreakdown(history) {
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

export function renderSparkline(daily) {
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
      cost ? formatCost(cost, appState().prefs.currency) : ''
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

export function renderHeatmap(daily, metric = 'tokens') {
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
      cost ? formatCost(cost, appState().prefs.currency) : ''
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

export function renderStackedBars(daily, stackBy, metric = 'tokens') {
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
      Number(day.cost || 0) ? formatCost(day.cost, appState().prefs.currency) : '',
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

export function renderTrends() {
  const heatMetric = appState().prefs.heatmapMetric === 'tokens' ? 'tokens' : 'cost';
  const daily = historyDaily(historySource(), appState().prefs.trendsRange === 'all' ? 0 : appState().prefs.trendsRange);
  const trendMetric = ['tokens', 'cost', 'activeTime'].includes(appState().prefs.trendsMetric) ? appState().prefs.trendsMetric : 'tokens';
  const rangeSummary = daily.reduce((summary, day) => ({
    tokens: summary.tokens + Number(day?.tokens || 0),
    cost: summary.cost + Number(day?.cost || 0),
    activeTime: summary.activeTime + Number(day?.activeTimeMs || 0)
  }), { tokens: 0, cost: 0, activeTime: 0 });
  const trendSummary = `<div class="usage-metric-strip trend-summary">
    ${usageMetricCard(tr('home.activeDays'), formatNumber(daily.filter((day) => Number(day?.tokens || 0) > 0 || Number(day?.cost || 0) > 0).length))}
    ${usageMetricCard(tr('stats.tokens'), formatNumber(rangeSummary.tokens))}
    ${usageMetricCard(tr('stats.cost'), formatCost(rangeSummary.cost, appState().prefs.currency))}
    ${usageMetricCard(tr('home.activeTime'), formatDuration(rangeSummary.activeTime))}
  </div>`;
  return `
    ${renderHistoryScopeNotice()}
    ${trendSummary}
    <div class="toolbar-row">
      <div class="seg">
        <button type="button" class="seg-btn ${appState().prefs.trendsStack === 'client' ? 'active' : ''}" data-stack="client">${tr('trends.stack.client')}</button>
        <button type="button" class="seg-btn ${appState().prefs.trendsStack === 'model' ? 'active' : ''}" data-stack="model">${tr('trends.stack.model')}</button>
      </div>
      <div class="seg">
        ${['7', '30', '90', '365', 'all'].map((range) => `
          <button type="button" class="seg-btn ${String(appState().prefs.trendsRange) === range ? 'active' : ''}" data-range="${range}">${range === 'all' ? 'All' : `${range}d`}</button>
        `).join('')}
      </div>
      <div class="seg" role="group" aria-label="${tr('home.heatmapMetric')}">
        ${segButtons([['tokens', tr('stats.tokens')], ['cost', tr('stats.cost')]], heatMetric, 'heatmap-metric')}
      </div>
      <div class="seg" role="group" aria-label="${tr('trends.metric')}">
        ${segButtons([['tokens', tr('stats.tokens')], ['cost', tr('stats.cost')], ['activeTime', tr('home.activeTime')]], trendMetric, 'trends-metric')}
      </div>
    </div>
    ${panel(tr('nav.trends'), renderStackedBars(daily, appState().prefs.trendsStack, trendMetric))}
    ${panel(tr('home.heatmap'), renderHeatmap(daily, heatMetric))}
  `;
}
