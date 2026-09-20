// Settings view: the shell that hosts the shared and desktop-only groups.
//
// Extracted from app.js. The device-local controls live in settingsDesktop.js;
// this module owns the surrounding page and the connection/capability summary.

import { isCapable } from '../transport/index.js';
import { tr, escapeHtml, appState, settingsOptionList, viewHelper } from '../core/viewContext.js';
import { clampHomeLimitAccountCount } from '../core/data.js';
import { renderDesktopSettings } from './settingsDesktop.js';

const pwaStatusText = (...args) => viewHelper('pwaStatusText')(...args);

export function renderSettingsPage() {
  const desktopHost = isCapable('desktopSettings');
  const scopes = appState().authorization?.scopes || [];
  const capabilities = appState().authorization?.capabilities || appState().health?.capabilities || {};
  const capabilityEntries = Object.entries(capabilities).filter(([, value]) => value !== undefined);
  const capabilityHtml = capabilityEntries.length
    ? `<div class="settings-capability-list">${capabilityEntries.map(([key, value]) => `<span class="badge ${value === false ? 'stale' : 'ok'}">${escapeHtml(key)} · ${value === false ? 'off' : 'on'}</span>`).join('')}</div>`
    : `<span class="muted tiny">—</span>`;
  const origin = window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : window.location.host || 'current page';
  const streamLabel = tr(`status.${appState().stream === 'live' ? 'live' : appState().stream === 'connecting' || appState().stream === 'retrying' ? 'connecting' : appState().stream === 'unauthorized' ? 'unauthorized' : 'offline'}`);
  const settingsLabel = desktopHost ? tr('settings.desktopTitle') : tr('settings.webOnly');
  const settingsDescription = desktopHost ? tr('settings.desktopDescription') : tr('settings.pageDescription');
  return `<section class="page-intro settings-page-intro"><div><div class="eyebrow">${escapeHtml(settingsLabel)}</div><h2>${escapeHtml(desktopHost ? tr('settings.desktopTitle') : tr('settings.pageTitle'))}</h2><p>${escapeHtml(settingsDescription)}</p></div></section>
    <div class="settings-layout">
      <form class="panel settings-form" data-web-settings-form>
        <div class="panel-head"><h2 class="panel-title">${escapeHtml(settingsLabel)}</h2><span class="panel-meta tiny">${escapeHtml(settingsDescription)}</span></div>
        <div class="form-grid">
          <label class="field"><span>${tr('settings.language')}</span><select name="language">${settingsOptionList([['auto', 'Auto'], ['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['ja', '日本語'], ['ko', '한국어']], appState().prefs.language || 'auto')}</select></label>
          <label class="field"><span>${tr('settings.theme')}</span><select name="theme">${settingsOptionList([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], appState().prefs.theme || 'system')}</select></label>
          <label class="field"><span>${tr('settings.currency')}</span><select name="currency">${settingsOptionList([['USD', 'USD'], ['CNY', 'CNY'], ['TWD', 'TWD'], ['HKD', 'HKD']], appState().prefs.currency || 'USD')}</select></label>
          <label class="field"><span>${tr('settings.homeLimitAccountCount')}</span><input name="homeLimitAccountCount" type="number" min="1" max="12" step="1" value="${clampHomeLimitAccountCount(appState().prefs.homeLimitAccountCount, 3)}" /></label>
          ${desktopHost ? '' : `<label class="field field-wide"><span>${tr('settings.secret')}</span><input name="secret" type="password" autocomplete="off" spellcheck="false" value="${escapeHtml(appState().secret || '')}" /></label>`}
        </div>
        <p class="muted tiny settings-form-hint">${escapeHtml(desktopHost ? tr('settings.desktopLocalHint') : tr('settings.authHint'))}</p>
        <div class="drawer-actions"><button type="submit" class="primary-btn">${escapeHtml(tr('settings.savePage'))}</button>${desktopHost ? '' : `<button type="button" class="ghost-btn" data-web-signout>${escapeHtml(tr('settings.signOut'))}</button>`}</div>
      </form>
      <div class="settings-side-stack">
        <section class="panel settings-info-panel"><div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('settings.connection'))}</h2></div><p class="muted tiny">${escapeHtml(tr(desktopHost ? 'settings.desktopConnectionHint' : 'settings.connectionHint'))}</p><dl class="settings-definition-list"><div><dt>${escapeHtml(tr('settings.currentOrigin'))}</dt><dd>${escapeHtml(origin)}</dd></div><div><dt>${escapeHtml(tr('settings.role'))}</dt><dd>${escapeHtml(scopes.length ? scopes.join(' · ') : '—')}</dd></div><div><dt>${escapeHtml(tr('settings.stream'))}</dt><dd>${escapeHtml(streamLabel)}</dd></div></dl><div class="settings-capabilities"><span class="summary-label">${escapeHtml(tr('settings.capabilities'))}</span>${capabilityHtml}</div></section>
        <section class="panel settings-info-panel"><div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('settings.pwa'))}</h2></div><p class="muted tiny">${escapeHtml(pwaStatusText())}</p>${appState().deferredInstall ? `<button type="button" class="ghost-btn" data-pwa-install>${escapeHtml(tr('pwa.install'))}</button>` : ''}</section>
        ${isCapable('desktopSettings')
          ? `<div class="settings-desktop-stack" data-desktop-settings>${renderDesktopSettings(appState().desktopSettings || {}, appState().desktopCatalog || {}, appState().desktopInfo || {})}</div>`
          : `<section class="panel settings-boundary-panel"><div class="panel-head"><h2 class="panel-title">${escapeHtml(tr('settings.desktopOnly'))}</h2></div><p class="muted tiny">${escapeHtml(tr('settings.desktopOnlyHint'))}</p></section>`}
      </div>
    </div>`;
}
