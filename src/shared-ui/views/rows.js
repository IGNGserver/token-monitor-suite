// Shared row rendering used by more than one view.
//
// Kept out of any single view because both the usage and devices views render the
// same expandable metric rows; having one import the other would invert their
// relationship for the sake of a helper.

import { formatRelative } from '../core/format.js';
import { appState, escapeHtml, viewHelper } from '../core/viewContext.js';

const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const rowHtml = (...args) => viewHelper('rowHtml')(...args);

export function renderListView(rows, emptyKey, { showIcon = false } = {}) {
  if (!rows.length) return emptyHtml(emptyKey);
  return `<div class="stack">${rows.map((row) => rowHtml(row, {
    showIcon,
    sub: row.sub || (row.lastUsedAt ? formatRelative(row.lastUsedAt, appState().locale) : '')
  })).join('')}</div>`;
}

export function usageMetricCard(label, value, detail = '', className = '') {
  const extraClass = className ? ` ${escapeHtml(className)}` : '';
  return `<div class="usage-metric-card${extraClass}"><span class="summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${detail ? `<span class="row-sub">${escapeHtml(detail)}</span>` : ''}</div>`;
}
