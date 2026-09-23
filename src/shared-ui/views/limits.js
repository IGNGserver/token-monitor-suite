// Limits view: per-provider quota cards plus the service-status panel.
//
// Extracted from app.js so a view can be read and tested on its own. Renders
// from the app's shared state; anything host-specific goes through transport/.

import {
  formatRelative,
  formatReset
} from '../core/format.js';
import {
  clientIconPath,
  clientLabel,
  limitCards,
  limitRemainingTone,
  statusRows
} from '../core/data.js';
import { tr, escapeHtml, appState, viewHelper } from '../core/viewContext.js';

const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const panel = (...args) => viewHelper('panel')(...args);
const viewStats = (...args) => viewHelper('viewStats')(...args);
const usageMetricCard = (...args) => viewHelper('usageMetricCard')(...args);

export function localizeWindowLabel(window) {
  if (window?.kind === 'balanceUsd') return tr('limits.balanceUsd');
  if (window?.kind === 'balance') return tr('limits.balance');
  if (window?.kind === 'resetCredits') return tr('limits.resetCredits');
  if (window?.kind === 'named') return window?.label || tr('limits.window.named');
  if (window?.kind === 'credits') return tr('limits.credits');
  if (window?.kind === 'session') return tr('limits.window.session');
  if (window?.kind === 'weekly') return tr('limits.window.weekly');
  if (window?.kind === 'billing' || window?.kind === 'monthly') return tr('limits.window.monthly');
  return window?.label || '—';
}

export function groupAntigravityWindows(windows = []) {
  const groups = new Map();
  const ungrouped = [];
  const suffixPattern = /\s+(?:5-hour|weekly)$/i;

  for (const window of windows) {
    const rawLabel = String(window.label || '').trim();
    const match = rawLabel.match(suffixPattern);
    if ((window.kind === 'session' || window.kind === 'weekly') && match) {
      const groupName = rawLabel.replace(suffixPattern, '').trim() || 'General';
      const cleanWindow = {
        ...window,
        displayLabel: window.kind === 'session' ? tr('limits.window.session') : tr('limits.window.weekly')
      };
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(cleanWindow);
    } else {
      ungrouped.push(window);
    }
  }

  if (groups.size === 0) return null;
  return {
    groups: [...groups.entries()].map(([title, items]) => ({ title, items })),
    ungrouped
  };
}

export function renderSingleLimitWindow(window) {
  const isBalanceKind = window.kind === 'balance' || window.kind === 'balanceUsd';
  const showMeter = window.showMeter !== false && window.remaining != null && !isBalanceKind;
  const tone = showMeter ? limitRemainingTone(window.remaining) : 'unknown';
  const primary = (isBalanceKind || !showMeter)
    ? (window.value || (window.remaining != null ? `${Math.round(window.remaining)}%` : '—'))
    : `${Math.round(window.remaining)}%`;
  const metricHint = window.metric === 'credits' ? tr('limits.credits') : window.metric === 'resets' ? tr('limits.resetCredits') : '';
  const label = window.displayLabel || localizeWindowLabel(window);
  const isWide = window.kind === 'named' || window.kind === 'resetCredits' || isBalanceKind;

  return `
  <div class="limit-window${isWide ? ' limit-window-wide' : ''}">
    <div class="limit-window-label">
      <span>${escapeHtml(label)}${metricHint ? ` · ${escapeHtml(metricHint)}` : ''}</span>
      <strong class="remaining-tone remaining-tone-${tone}">${escapeHtml(String(primary))}</strong>
    </div>
    ${showMeter ? `<div class="meter meter-${limitRemainingTone(window.remaining)}"><span style="width:${Math.max(0, Math.min(100, window.remaining))}%"></span></div>` : '<div class="limit-balance-line"></div>'}
    <div class="row-sub" style="margin-top:8px">
      ${window.value && showMeter ? escapeHtml(window.value) : ''}
      ${window.detail ? escapeHtml(window.detail) : ''}
      ${window.resetsAt ? `${tr('limits.reset')} ${escapeHtml(formatReset(window.resetsAt, appState().locale))}` : ''}
    </div>
  </div>`;
}

export function renderLimitCardWindows(card) {
  if (!card.windows || !card.windows.length) {
    return renderSingleLimitWindow({ label: '—', remaining: null, showMeter: false });
  }

  if (card.provider === 'antigravity') {
    const agyGrouped = groupAntigravityWindows(card.windows);
    if (agyGrouped) {
      const groupsHtml = agyGrouped.groups.map((group) => `
        <div class="limit-window-group">
          <div class="limit-window-group-title">${escapeHtml(group.title)}</div>
          <div class="limit-window-group-items">
            ${group.items.map(renderSingleLimitWindow).join('')}
          </div>
        </div>
      `).join('');
      const ungroupedHtml = agyGrouped.ungrouped.length
        ? `<div class="limit-window-group-items" style="margin-top:8px">${agyGrouped.ungrouped.map(renderSingleLimitWindow).join('')}</div>`
        : '';
      return `<div class="limit-windows limit-windows-antigravity-grouped">${groupsHtml}${ungroupedHtml}</div>`;
    }
  }

  return `<div class="limit-windows">${card.windows.map(renderSingleLimitWindow).join('')}</div>`;
}

export function formatLimitBadge(card) {
  if (card.stale) {
    return `<span class="badge stale">${escapeHtml(tr('limits.stale'))}</span>`;
  }
  const status = String(card.status || '').toLowerCase();
  if (status === 'ok') {
    return `<span class="badge ok">${escapeHtml(tr('accounts.statusOk'))}</span>`;
  }
  if (status === 'disabled') {
    return `<span class="badge">${escapeHtml(tr('accounts.statusDisabled'))}</span>`;
  }
  if (status === 'unauthorized') {
    // Distinguish a retired plan from a stale credential: both need user action,
    // but only one is fixed by re-pasting. `region:'retired'` is set by the
    // Gemini adapter when Google reports the tier as no longer served.
    const retired = String(card.region || '').toLowerCase() === 'retired';
    return `<span class="badge warn">${escapeHtml(tr(retired ? 'limits.statusRetired' : 'limits.statusNeedsCredentials'))}</span>`;
  }
  if (status === 'notconfigured') {
    return `<span class="badge">${escapeHtml(tr('limits.statusNotConfigured'))}</span>`;
  }
  return `<span class="badge warn">${escapeHtml(card.status || tr('accounts.statusError'))}</span>`;
}

/**
 * One actionable line under a card that is not producing numbers. The point is
 * to name the fix ("update the credential") rather than echo the status, because
 * a bare "Error" leaves the user unable to tell an expired cookie from an
 * outage.
 */
export function formatLimitHint(card) {
  const status = String(card.status || '').toLowerCase();
  if (card.stale) return tr('limits.hintStale');
  if (status === 'ok' || status === 'disabled') return '';
  if (status === 'unauthorized') {
    return String(card.region || '').toLowerCase() === 'retired'
      ? tr('limits.hintRetired')
      : tr('limits.hintNeedsCredentials');
  }
  if (status === 'notconfigured') return tr('limits.hintNotConfigured');
  if (status === 'sourceratelimited' || status === 'ratelimited') return tr('limits.hintRateLimited');
  if (status === 'unavailable' || status === 'error') return tr('limits.hintUnavailable');
  return '';
}

export function renderLimitCards(cards, { compact = false } = {}) {
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
            ${formatLimitBadge(card)}
          </div>
          ${renderLimitCardWindows(card)}
          ${(() => {
            const hint = formatLimitHint(card);
            return hint ? `<p class="muted tiny limit-card-hint">${escapeHtml(hint)}</p>` : '';
          })()}
          <div class="limit-card-foot" title="${escapeHtml(card.updatedAt ? formatReset(card.updatedAt, appState().locale) : '')}">
            <span>${tr('limits.lastFetched', { time: formatRelative(card.updatedAt, appState().locale) })}</span>
          </div>
        </article>`;
      }).join('')}
    </div>
  `;
}

export function renderLimits() {
  const stats = viewStats();
  const allCards = limitCards(stats, appState().locale);
  const providers = [...new Set(allCards.map((card) => card.provider))].sort();
  const cards = appState().limitProvider
    ? allCards.filter((card) => card.provider === appState().limitProvider)
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
          ${providers.map((provider) => `<option value="${escapeHtml(provider)}"${provider === appState().limitProvider ? ' selected' : ''}>${escapeHtml(clientLabel(provider))}</option>`).join('')}
        </select>
      </label>
      <span class="panel-meta tiny">${tr('limits.accountsCount', { count: cards.length })}</span>
    </div>`;
  const healthPanel = appState().prefs.limitTab === 'health' ? renderStatus() : '';
  return `${healthSummary}${healthPanel}${filter}${renderLimitCards(cards)}`;
}

export function renderStatus() {
  const rows = statusRows(viewStats(), appState().locale);
  if (!rows.length) return emptyHtml('empty.status');
  const summary = `
    <div class="summary-grid" style="margin-bottom:16px">
      <div class="summary-chip"><span class="summary-label">${tr('status.accounts')}</span><strong>${rows.length}</strong></div>
      <div class="summary-chip"><span class="summary-label">${tr('status.okCount')}</span><strong>${rows.filter((r) => r.health === 'ok').length}</strong></div>
      <div class="summary-chip"><span class="summary-label">${tr('status.warnCount')}</span><strong>${rows.filter((r) => r.health !== 'ok').length}</strong></div>
    </div>`;
  return panel(tr('nav.status'), summary + renderLimitCards(rows, { compact: true }));
}
