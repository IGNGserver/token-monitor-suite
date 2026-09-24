// Devices view: the fleet table and the selected device's detail panels.
//
// Extracted from app.js so a view can be read and tested on its own. Renders from
// the app's shared state; anything host-specific goes through transport/.

import {
  formatCost,
  formatNumber,
  formatRelative
} from '../core/format.js';
import {
  periodTokenMetrics,
  agentRuntimeLabel,
  clientLabel,
  clientStatusEntries,
  deviceBreakdownRows,
  devicePlatformLabel,
  deviceRows,
  wslStatusSummary
} from '../core/data.js';
import { tr, escapeHtml, appState, viewHelper } from '../core/viewContext.js';
import { usageMetricCard } from './rows.js';

const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const panel = (...args) => viewHelper('panel')(...args);
const viewStats = (...args) => viewHelper('viewStats')(...args);
const renderTokenMix = (...args) => viewHelper('renderTokenMix')(...args);
const shareBarHtml = (...args) => viewHelper('shareBarHtml')(...args);



export function renderDeviceStatusBlocks(device) {
  const clientEntries = clientStatusEntries(device?.clientStatus || device?.raw?.clientStatus);
  const wsl = wslStatusSummary(device?.wslStatus || device?.raw?.wslStatus);
  const parts = [];
  if (clientEntries.length) {
    const activeCount = clientEntries.filter((entry) => entry.state === 'active').length;
    const waitingCount = clientEntries.filter((entry) => entry.state === 'waiting').length;
    const missingCount = clientEntries.filter((entry) => entry.state === 'missing').length;
    const tags = clientEntries.map((entry) => {
      const tone = entry.state === 'active' ? 'ok' : (entry.state === 'waiting' ? 'warn' : 'stale');
      const label = tr(`devices.status.${entry.state}`);
      return `<span class="badge ${tone}">${escapeHtml(clientLabel(entry.client))} · ${escapeHtml(label)}</span>`;
    }).join('');
    parts.push(`<div class="status-block">
      <div class="device-status-summary"><span class="row-sub">${tr('devices.clientStatus')}</span><div class="device-status-counts"><span class="badge ok">${tr('devices.status.active')} · ${activeCount}</span><span class="badge warn">${tr('devices.status.waiting')} · ${waitingCount}</span><span class="badge stale">${tr('devices.status.missing')} · ${missingCount}</span></div></div>
      <details class="device-status-details"><summary>${tr('devices.clientStatus')} · ${clientEntries.length}</summary><div class="status-tags">${tags}</div></details>
    </div>`);
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

export function renderDevices() {
  const periodKey = appState().customPeriod ? 'today' : (appState().prefs.period || 'today');
  const stats = viewStats();
  const rows = deviceRows(stats, periodKey);
  if (!rows.length) return emptyHtml('empty.usage');
  const selectedId = appState().prefs.selectedDeviceId || rows[0].key;
  const selected = rows.find((row) => row.key === selectedId) || rows[0];
  const breakdown = deviceBreakdownRows(selected.raw || selected, periodKey);
  const activeDevices = rows.filter((row) => !row.stale).length;
  const fleetSummary = `<div class="usage-metric-strip device-summary-strip">
    ${usageMetricCard(tr('devices.summary'), rows.length)}
    ${usageMetricCard(tr('devices.live'), activeDevices)}
    ${usageMetricCard(tr('devices.stale'), rows.length - activeDevices)}
  </div>`;
  const detailMeta = [
    selected.deviceId,
    selected.receivedAt ? `${tr('devices.lastSeen')} ${formatRelative(selected.receivedAt, appState().locale)}` : '',
    selected.projectsEnabled === false ? tr('projects.incomplete') : ''
  ].filter(Boolean).join(' · ');
  const customRangeNotice = appState().customPeriod
    ? `<div class="notice" role="status">${escapeHtml(tr('devices.customRangeNotice'))}</div>`
    : '';

  return `
    ${customRangeNotice}
    ${fleetSummary}
    <div class="grid-2 devices-layout">
      <section class="panel">
        <div class="panel-head"><h2 class="panel-title">${tr('devices.title')}</h2><span class="panel-meta tiny">${escapeHtml(tr('devices.lastSeen'))}</span></div>
        <div class="device-list" role="list">
          ${rows.map((row) => {
            const lastSeen = formatRelative(row.updatedAt, appState().locale);
            const platform = row.platformDisplay || devicePlatformLabel(row.platform, row.osName, row.osVersion);
            const actions = appState().authorization?.scopes?.includes('admin')
              ? `<details class="row-action-menu"><summary aria-label="${escapeHtml(tr('actions.more'))}">•••</summary><div class="row-action-popover"><fluent-button appearance="transparent" type="button" data-rename-device="${escapeHtml(row.key)}">${tr('devices.rename')}</fluent-button><fluent-button appearance="transparent" type="button" class="danger-btn" data-delete-device="${escapeHtml(row.key)}">${tr('devices.delete')}</fluent-button></div></details>`
              : '';
            return `<article class="device-list-row${row.key === selected.key ? ' selected' : ''}" role="listitem">
              <button type="button" class="device-row-select" data-select-device="${escapeHtml(row.key)}" aria-current="${row.key === selected.key ? 'true' : 'false'}" title="${escapeHtml(row.name)}">
                <span class="row-name">${escapeHtml(row.name)}</span>
                <span class="device-row-description"><span>${escapeHtml(platform)}</span><span class="badge ${row.stale ? 'stale' : 'ok'}">${escapeHtml(row.stale ? tr('devices.stale') : tr('devices.live'))}</span></span>
              </button>
              <div class="device-row-actions"><span class="device-row-last-seen" aria-label="${escapeHtml(`${tr('devices.updated')} ${lastSeen}`)}" title="${escapeHtml(`${tr('devices.updated')} ${lastSeen}`)}">${escapeHtml(lastSeen)}</span>${actions}</div>
            </article>`;
          }).join('')}
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
        ${selected.stale ? `<div class="notice warn device-stale-notice" role="status">${escapeHtml(`${tr('devices.stale')} · ${tr('devices.lastSeen')} ${formatRelative(selected.updatedAt, appState().locale)}`)}</div>` : ''}
        <div class="summary-grid" style="margin:12px 0 16px">
          <div class="summary-chip"><span class="summary-label">${tr('stats.tokens')}</span><strong>${formatNumber(breakdown.totalTokens)}</strong></div>
          <div class="summary-chip"><span class="summary-label">${tr('stats.cost')}</span><strong>${formatCost(breakdown.totalCost, appState().prefs.currency)}</strong></div>
        </div>
        <div class="usage-detail-label">${escapeHtml(tr('usage.breakdown'))}</div>
        ${renderTokenMix(periodTokenMetrics(selected.raw?.periods?.[periodKey] || {}))}
        ${renderDeviceStatusBlocks(selected)}
        <div class="device-detail-breakdowns">
          <section class="device-detail-section"><h3>${tr('devices.tools')}</h3>${shareBarHtml(breakdown.tools.slice(0, 12))}${breakdown.tools.some((tool) => tool.models?.length) ? `<div class="device-tool-models">${breakdown.tools.filter((tool) => tool.models?.length).slice(0, 6).map((tool) => `<div class="device-tool-model-group"><div class="row-sub">${escapeHtml(tool.name)}</div>${shareBarHtml(tool.models.slice(0, 6), { clientIcons: false })}</div>`).join('')}</div>` : ''}</section>
          <section class="device-detail-section"><h3>${tr('devices.models')}</h3>${shareBarHtml(breakdown.models.slice(0, 12), { clientIcons: false })}</section>
        </div>
      </section>
    </div>
  `;
}
