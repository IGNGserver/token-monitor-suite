// Device data transfer panel.
//
// Move one device's entire recorded history onto another existing device.
// The Hub rewrites every ledger row to the target, additively merges its
// periods and sessions, and then removes the source device — the warning the
// UI shows is the contract the endpoint implements. Every mutation happens
// inside one Hub transaction.
//
// The panel renders inside the settings page (group `transfer`) and as a
// standalone view; both call sites share renderTransferPanel().

import { request, confirmAction } from '../transport/index.js';
import { tr, escapeHtml, appState, viewHelper, showToast, rerender } from '../core/viewContext.js';
import { deviceRows } from '../core/data.js';

const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const viewStats = (...args) => viewHelper('viewStats')(...args);

function deviceOptions(rows, selectedId) {
  return rows.map((row) => `<fluent-option value="${escapeHtml(row.key)}"${row.key === selectedId ? ' selected' : ''}>${escapeHtml(row.name)}</fluent-option>`).join('');
}

/** The transfer form as it appears inside the settings page. */
export function renderTransferPanel() {
  const rows = deviceRows(viewStats(), 'allTime');
  const admin = appState().authorization?.scopes?.includes('admin');
  if (!rows.length) return `<p class="muted tiny">${escapeHtml(tr('transfer.noDevices'))}</p>`;
  const selectedId = appState().prefs.selectedDeviceId || rows[0].key;
  return `
    <p class="muted tiny">${escapeHtml(tr('transfer.description'))}</p>
    <div class="notice warn" role="status">${escapeHtml(tr('transfer.notice'))}</div>
    <form class="transfer-form" data-transfer-form>
      <div class="form-grid">
        <label class="field"><span>${tr('transfer.source')}</span>
          <fluent-dropdown name="sourceDevice">${deviceOptions(rows, selectedId)}</fluent-dropdown>
        </label>
        <fluent-text-input class="field" type="text" name="targetDevice" spellcheck="false" placeholder="${escapeHtml(tr('transfer.targetPlaceholder'))}">${escapeHtml(tr('transfer.target'))}</fluent-text-input>
      </div>
      <p class="muted tiny">${escapeHtml(tr('transfer.targetHint'))}</p>
      <div class="drawer-actions settings-actions">
        <fluent-button appearance="primary" type="submit" class="primary-btn"${admin ? '' : ' disabled'}>${escapeHtml(tr('transfer.submit'))}</fluent-button>
      </div>
      ${admin ? '' : `<p class="muted tiny">${escapeHtml(tr('transfer.needsAdmin'))}</p>`}
    </form>`;
}

/** The standalone transfer view wraps the same panel. */
export function renderTransfer() {
  const rows = deviceRows(viewStats(), 'allTime');
  if (!rows.length) return emptyHtml('empty.usage');
  return `<div class="settings-layout settings-transfer-layout">
      <section class="panel desktop-settings-group" data-desktop-group="transfer">
        <div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('transfer.title'))}</h2></div>
        <div class="desktop-settings-body">${renderTransferPanel()}</div>
      </section>
    </div>`;
}

/** Submit the transfer. Returns an error message or ''. */
export async function submitTransfer(form) {
  const source = String(form.querySelector('[name="sourceDevice"]')?.value || '').trim();
  const target = String(form.querySelector('[name="targetDevice"]')?.value || '').trim();
  if (!source || !target) return tr('transfer.missingFields');
  if (source === target) return tr('transfer.sameDevice');
  // The confirm dialog is the only gate: the Hub moves every recorded row to
  // the target and deletes the source device in one transaction.
  const confirmed = await confirmAction(tr('transfer.confirm', { source, target }), { danger: true });
  if (!confirmed) return '';
  try {
    await request(`/api/devices/${encodeURIComponent(source)}/transfer`, {
      method: 'POST',
      body: { targetDeviceId: target }
    });
    showToast(tr('transfer.done'));
    rerender();
    return '';
  } catch (error) {
    const code = String(error?.code || error?.message || '');
    if (code.includes('target_not_found')) return tr('transfer.errorTargetMissing');
    if (code.includes('same_device')) return tr('transfer.sameDevice');
    if (code.includes('unauthorized') || code.includes('forbidden')) return tr('transfer.needsAdmin');
    return error?.message || tr('error.generic');
  }
}
