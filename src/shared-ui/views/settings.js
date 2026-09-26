// Settings view: web preferences plus, on the desktop host, the device groups.
//
// Extracted from app.js. The web side configures the browser only; the desktop
// side additionally renders the device-owned groups from settingsDesktop.js.
// Device data redistribution lives in the transfer page, not here.

import { isCapable } from '../transport/index.js';
import { tr, escapeHtml, appState, settingsOptionList } from '../core/viewContext.js';
import { clampHomeLimitAccountCount } from '../core/data.js';
import { renderDesktopSettings } from './settingsDesktop.js';

export function renderSettingsPage() {
  const desktopHost = isCapable('desktopSettings');
  const settingsLabel = desktopHost ? tr('settings.desktopTitle') : tr('settings.webOnly');
  const settingsDescription = desktopHost ? tr('settings.desktopDescription') : tr('settings.pageDescription');
  return `<section class="page-intro settings-page-intro"><div><div class="eyebrow">${escapeHtml(settingsLabel)}</div><h2>${escapeHtml(desktopHost ? tr('settings.desktopTitle') : tr('settings.pageTitle'))}</h2><p>${escapeHtml(settingsDescription)}</p></div></section>
    <div class="settings-layout">
      <form class="panel settings-form" data-web-settings-form data-draft-key="preferences">
        <div class="panel-head"><h2 class="panel-title">${escapeHtml(settingsLabel)}</h2><span class="panel-meta tiny">${escapeHtml(settingsDescription)}</span></div>
        <div class="form-grid">
          <label class="field"><span>${tr('settings.language')}</span><fluent-dropdown name="language">${settingsOptionList([['auto', 'Auto'], ['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['ja', '日本語'], ['ko', '한국어']], appState().prefs.language || 'auto')}</fluent-dropdown></label>
          <label class="field"><span>${tr('settings.theme')}</span><fluent-dropdown name="theme">${settingsOptionList([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], appState().prefs.theme || 'system')}</fluent-dropdown></label>
          ${desktopHost ? '' : `<label class="field"><span>${tr('desktop.settings.reduceMotion')}</span><fluent-dropdown name="reduceMotion">${settingsOptionList([['system', tr('desktop.settings.motionSystem')], ['on', tr('desktop.settings.motionOn')], ['off', tr('desktop.settings.motionOff')]], appState().prefs.reduceMotion || 'system')}</fluent-dropdown></label>`}
          <label class="field"><span>${tr('settings.currency')}</span><fluent-dropdown name="currency">${settingsOptionList([['USD', 'USD'], ['CNY', 'CNY'], ['TWD', 'TWD'], ['HKD', 'HKD']], appState().prefs.currency || 'USD')}</fluent-dropdown></label>
          ${desktopHost ? '' : `<label class="field"><span>${tr('settings.homeLimitAccountCount')}</span><input name="homeLimitAccountCount" type="number" min="1" max="12" step="1" value="${clampHomeLimitAccountCount(appState().prefs.homeLimitAccountCount, 3)}" /></label>`}
          ${desktopHost ? '' : `<fluent-text-input class="field field-wide" name="secret" type="password" autocomplete="off" spellcheck="false" value="${escapeHtml(appState().secret || '')}">${tr('settings.secret')}</fluent-text-input>`}
        </div>
        <p class="muted tiny settings-form-hint">${escapeHtml(desktopHost ? tr('settings.desktopLocalHint') : tr('settings.authHint'))}</p>
        <div class="drawer-actions settings-actions"><fluent-button appearance="primary" type="submit" class="primary-btn" data-settings-submit disabled>${escapeHtml(tr('settings.savePage'))}</fluent-button>${desktopHost ? '' : `<fluent-button appearance="transparent" type="button" class="ghost-btn" data-web-signout>${escapeHtml(tr('settings.signOut'))}</fluent-button>`}</div>
      </form>
      ${desktopHost
        ? `<div class="settings-desktop-stack" data-desktop-settings>${renderDesktopSettings(appState().desktopSettings || {}, appState().desktopCatalog || {}, appState().desktopInfo || {})}</div>`
        : ''}
    </div>`;
}
