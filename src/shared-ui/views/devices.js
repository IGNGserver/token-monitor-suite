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
const segButtons = (...args) => viewHelper('segButtons')(...args);
const renderTokenMix = (...args) => viewHelper('renderTokenMix')(...args);
const shareBarHtml = (...args) => viewHelper('shareBarHtml')(...args);



export function renderDeviceStatusBlocks(device) {
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

export function renderDevices() {
  const periodKey = appState().customPeriod ? 'today' : (appState().prefs.deviceDetailPeriod || appState().prefs.period || 'today');
  const stats = viewStats();
  const rows = deviceRows(stats, periodKey);
  if (!rows.length) return emptyHtml('empty.usage');
  const selectedId = appState().prefs.selectedDeviceId || rows[0].key;
  const selected = rows.find((row) => row.key === selectedId) || rows[0];
  const breakdown = deviceBreakdownRows(selected.raw || selected, periodKey);
  const detailPeriod = appState().prefs.deviceDetailPeriod || 'today';
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
                  <td>${escapeHtml(formatRelative(row.updatedAt, appState().locale))}</td>
                  <td>
                    <div class="row-value">${formatNumber(row.value)}</div>
                    <div class="row-cost">${formatCost(row.cost, appState().prefs.currency)}</div>
                  </td>
                  <td>
                    <div class="device-actions">
                      ${appState().authorization?.scopes?.includes('admin') ? `<button type="button" class="ghost-btn" data-rename-device="${escapeHtml(row.key)}">${tr('devices.rename')}</button><button type="button" class="danger-btn" data-delete-device="${escapeHtml(row.key)}">${tr('devices.delete')}</button>` : '—'}
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
          <div class="summary-chip"><span class="summary-label">${tr('stats.cost')}</span><strong>${formatCost(breakdown.totalCost, appState().prefs.currency)}</strong></div>
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
