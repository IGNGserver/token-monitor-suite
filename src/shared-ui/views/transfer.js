// Transfer view: move one device's recorded history onto another device.
//
// The source device keeps reporting normally — only the ownership of the
// already-recorded data changes. The Hub moves the ledger, merges the target's
// periods and sessions, and pins the source's ingest baseline, so its next
// upload books only new usage. This view just states that contract and asks
// the Hub to do it; every mutation happens inside one Hub transaction.

import { request, confirmAction } from '../transport/index.js';
import { tr, escapeHtml, appState, viewHelper, showToast, rerender } from '../core/viewContext.js';
import { deviceRows } from '../core/data.js';

const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const viewStats = (...args) => viewHelper('viewStats')(...args);

function deviceOptions(rows, selectedId) {
  return rows.map((row) => `<fluent-option value="${escapeHtml(row.key)}"${row.key === selectedId ? ' selected' : ''}>${escapeHtml(row.name)}</fluent-option>`).join('');
}

export function renderTransfer() {
  const stats = viewStats();
  const rows = deviceRows(stats, 'allTime');
  if (!rows.length) return emptyHtml('empty.usage');

  const admin = appState().authorization?.scopes?.includes('admin');
  const selectedId = appState().prefs.selectedDeviceId || rows[0].key;
  return `
    <div class="notice warn" role="status">${escapeHtml(tr('transfer.notice'))}</div>
    <form class="panel transfer-form" data-transfer-form>
      <div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('transfer.title'))}</h2></div>
      <p class="muted tiny">${escapeHtml(tr('transfer.description'))}</p>
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

/** Submit the transfer. Returns an error message or ''. */
export async function submitTransfer(form) {
  const source = String(form.querySelector('[name="sourceDevice"]')?.value || '').trim();
  const target = String(form.querySelector('[name="targetDevice"]')?.value || '').trim();
  if (!source || !target) return tr('transfer.missingFields');
  if (source === target) return tr('transfer.sameDevice');
  // The Hub refuses a missing target and never touches the source's identity,
  // so the confirm dialog is the only gate this destructive action needs.
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
