// Desktop-only settings.
//
// The Hub dashboard offers browser preferences; a desktop install additionally
// owns the window and the update channel. Those controls live here rather than
// in the Hub's settings view, and the whole module is inert unless the host
// reports `capabilities.desktopSettings` — so the same shared settings page
// renders correctly in both hosts.
//
// Three groups only: 显示 (display), 行为 (behaviour), 连接 (connection).
// Collector, export, view-preference and JSON-mapping keys stay configurable
// through env vars and settings.json — they remain part of the settings
// document and its normalizers, they just have no GUI anymore.
//
// Every key written here is an existing settings.json key. Renaming one would
// silently drop a user's configuration on upgrade, so the field `name`
// attributes are the compatibility surface.

import { tr, escapeHtml, appState, settingsOptionList } from '../core/viewContext.js';

// One dropdown for the whole window-material decision. The settings document
// stores it as the two legacy keys (systemGlass boolean + windowsBackdrop
// material), so the UI folds and unfolds them here rather than inventing a new
// storage shape.
const SURFACE_OPTIONS = [
  ['regular', 'settings.surface.regular'],
  ['transparent', 'settings.surface.transparent'],
  ['acrylic', 'settings.surface.acrylic'],
  ['mica', 'settings.surface.mica']
];
const REDUCE_MOTION = [
  ['system', 'desktop.settings.motionSystem'],
  ['on', 'desktop.settings.motionOn'],
  ['off', 'desktop.settings.motionOff']
];

function optionLabels(pairs) {
  return pairs.map(([value, key]) => [value, tr(key)]);
}

// Fold the stored keys into the single dropdown value. Non-Windows hosts cannot
// apply a background material, so acrylic/mica collapse onto transparent there.
export function surfaceValueFromSettings(settings = {}, info = {}) {
  const isWindows = info.platform === 'win32';
  if (settings.systemGlass === false) return 'regular';
  if (isWindows && settings.windowsBackdrop === 'acrylic') return 'acrylic';
  if (isWindows && settings.windowsBackdrop === 'mica') return 'mica';
  return 'transparent';
}

// Unfold the dropdown value into the settings patch the main process already
// normalizes. Acrylic/mica are offered only on Windows; selecting them
// elsewhere stores the plain glass surface.
export function settingsPatchForSurface(surface) {
  const value = String(surface || 'transparent');
  if (value === 'regular') return { systemGlass: false };
  return { systemGlass: true, ...(value === 'acrylic' || value === 'mica' ? { windowsBackdrop: value } : {}) };
}

function checkbox(name, labelKey, checked, { description = '', id = '' } = {}) {
  const controlId = id || `desktop-setting-${name}`;
  const labelId = `${controlId}-label`;
  const descriptionId = description ? `${controlId}-description` : '';
  return `<div class="desktop-setting-switch-row">
    <div class="desktop-setting-switch-copy">
      <span class="desktop-setting-switch-label" id="${escapeHtml(labelId)}">${escapeHtml(tr(labelKey))}</span>
      ${description ? `<span class="desktop-setting-switch-description" id="${escapeHtml(descriptionId)}">${escapeHtml(description)}</span>` : ''}
    </div>
    <fluent-switch id="${escapeHtml(controlId)}" name="${escapeHtml(name)}" role="switch" aria-labelledby="${escapeHtml(labelId)}"${descriptionId ? ` aria-describedby="${escapeHtml(descriptionId)}"` : ''}${checked ? ' checked' : ''}></fluent-switch>
  </div>`;
}

function dropdownField(name, labelKey, options, value, { id = '' } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  return `<label class="field"><span>${escapeHtml(tr(labelKey))}</span>
    <fluent-dropdown name="${name}"${idAttr}>${settingsOptionList(options, value)}</fluent-dropdown>
  </label>`;
}

function textField(name, labelKey, value, { id = '', placeholder = '', type = 'text' } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  return `<fluent-text-input class="field" type="${type}" name="${name}"${idAttr} value="${escapeHtml(String(value ?? ''))}" spellcheck="false"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}>${escapeHtml(tr(labelKey))}</fluent-text-input>`;
}

function actionButton(action, labelKey, appearance = 'transparent') {
  return `<fluent-button appearance="${appearance}" type="button" class="ghost-btn" data-desktop-action="${escapeHtml(action)}">${escapeHtml(tr(labelKey))}</fluent-button>`;
}

/**
 * @param {object} settings  Current settings (redacted) from the main process.
 * @param {object} info      Platform facts, e.g. whether a login item exists.
 */
export function renderDesktopSettings(settings = {}, info = {}) {
  const isWindows = info.platform === 'win32';

  const groups = [];

  // --- Display -------------------------------------------------------------
  const surfaceOptions = SURFACE_OPTIONS
    .filter(([value]) => isWindows || (value !== 'acrylic' && value !== 'mica'));
  const displayRows = [];
  displayRows.push(dropdownField('language', 'settings.language',
    [['auto', 'Auto'], ['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['ja', '日本語'], ['ko', '한국어']],
    settings.language || 'auto', { id: 'desktopLanguageInput' }));
  displayRows.push(dropdownField('windowSurface', 'desktop.settings.windowSurface',
    optionLabels(surfaceOptions), surfaceValueFromSettings(settings, info), { id: 'windowSurfaceInput' }));
  displayRows.push(dropdownField('reduceMotion', 'desktop.settings.reduceMotion',
    optionLabels(REDUCE_MOTION), settings.reduceMotion || 'system'));
  groups.push(group('display', 'desktop.settings.groupDisplay', displayRows.join('')));

  // --- Behaviour -----------------------------------------------------------
  const behaviourRows = [];
  if (info.loginItemSupported) {
    behaviourRows.push(checkbox('startAtLogin', 'desktop.settings.startAtLogin', settings.startAtLogin === true, {
      // Linux autostart points at the AppImage's current path, so moving or
      // renaming the file silently breaks it. Saying so up front is cheaper than
      // debugging "it stopped starting" later.
      description: info.platform === 'linux' ? tr('desktop.settings.startAtLoginNote') : ''
    }));
    behaviourRows.push(checkbox('startHidden', 'desktop.settings.startHidden', settings.startHidden !== false));
  } else {
    behaviourRows.push(`<p class="row-sub">${escapeHtml(tr('desktop.settings.startAtLoginUnavailable'))}</p>`);
  }
  // Closing the window is not quitting the app by default; the collector keeps
  // running and the tray is the way back.
  behaviourRows.push(checkbox('closeToTray', 'desktop.settings.closeToTray', settings.closeToTray !== false));
  // Update controls are always reachable: checking is safe at any time, and the
  // install row only becomes actionable once the pushed updater state offers one.
  const update = appState()?.desktopAppUpdate;
  behaviourRows.push(`<div class="desktop-setting-row">
      <span class="row-sub">${update?.currentVersion ? escapeHtml(`v${update.currentVersion}${update.latest?.version ? ` → ${update.latest.version}` : ''} · ${update.hasUpdate ? tr('desktop.settings.updateAvailable') : tr('desktop.settings.upToDate')}`) : ''}</span>
      <span class="drawer-actions">${actionButton('check-updates', 'desktop.settings.checkUpdates')}${actionButton('download-install-update', 'desktop.settings.installUpdate', 'primary')}</span>
    </div>`);
  if (update?.installPhase === 'downloading') {
    behaviourRows.push(`<p class="row-sub">${escapeHtml(tr('desktop.settings.updateProgress', { pct: Math.round(Number(update.installProgress) || 0) }))}</p>`);
  }
  if (update && !update.installSupported && update.installSupportReason) {
    behaviourRows.push(`<p class="row-sub">${escapeHtml(update.installSupportReason)}</p>`);
  }
  groups.push(group('behaviour', 'desktop.settings.groupBehaviour', behaviourRows.join('')));

  // --- Connection ----------------------------------------------------------
  const hubMode = settings.hubMode === 'client' ? 'client' : 'local';
  const hubOnly = (rows) => (hubMode === 'client' ? rows.join('') : '');
  const connectionRows = [];
  connectionRows.push(`<fluent-radio-group class="mode-toggle-group" name="hubMode" value="${hubMode}" orientation="horizontal" aria-label="${escapeHtml(tr('desktop.settings.groupSync'))}">
      <label class="mode-toggle" for="hub-mode-local"><fluent-radio id="hub-mode-local" value="local" aria-labelledby="hub-mode-local-label"${hubMode === 'local' ? ' checked' : ''}></fluent-radio><span id="hub-mode-local-label">${escapeHtml(tr('desktop.settings.hubLocal'))}</span></label>
      <label class="mode-toggle" for="hub-mode-client"><fluent-radio id="hub-mode-client" value="client" aria-labelledby="hub-mode-client-label"${hubMode === 'client' ? ' checked' : ''}></fluent-radio><span id="hub-mode-client-label">${escapeHtml(tr('desktop.settings.hubClient'))}</span></label>
    </fluent-radio-group>`);
  connectionRows.push(hubOnly([
    textField('hubUrl', 'desktop.settings.hubUrl', settings.hubUrl || '', { placeholder: 'http://hub-host:17321' }),
    `<div class="desktop-setting-block desktop-hub-secret" data-hub-secret>
      <fluent-text-input class="field" type="password" data-hub-secret-input autocomplete="new-password" spellcheck="false" placeholder="${escapeHtml(settings.hubAdminConfigured ? tr('desktop.settings.hubSecretConfigured') : tr('desktop.settings.hubSecretMissing'))}">${escapeHtml(tr('settings.secret'))}</fluent-text-input>
      <div class="desktop-setting-row">
        <span class="row-sub">${escapeHtml(tr('desktop.settings.hubSecretHint'))}</span>
        <span class="drawer-actions">
          <fluent-button appearance="transparent" type="button" class="ghost-btn" data-desktop-action="save-hub-secret">${escapeHtml(tr('desktop.settings.saveHubSecret'))}</fluent-button>
          ${settings.hubAdminConfigured ? `<fluent-button appearance="transparent" type="button" class="ghost-btn" data-desktop-action="clear-hub-secret">${escapeHtml(tr('desktop.settings.clearHubSecret'))}</fluent-button>` : ''}
        </span>
      </div>
    </div>`,
    checkbox('allowInsecureHubHttp', 'desktop.settings.allowInsecureHttp', settings.allowInsecureHubHttp === true,
      { description: tr('desktop.settings.allowInsecureHttpDesc') }),
    textField('deviceId', 'desktop.settings.deviceId', settings.deviceId || '', { placeholder: tr('desktop.settings.deviceIdHint') })
  ]));
  groups.push(group('connection', 'desktop.settings.groupSync', connectionRows.join('')));

  return groups.join('');
}

function group(id, titleKey, body) {
  return `<section class="panel desktop-settings-group" data-desktop-group="${escapeHtml(id)}">
    <div class="panel-head"><h2 class="panel-title">${escapeHtml(tr(titleKey))}</h2></div>
    <div class="desktop-settings-body">${body}</div>
  </section>`;
}

const NUMERIC_FIELDS = new Set([]);
const CHECKBOX_FIELDS = new Set([
  'startAtLogin', 'startHidden', 'closeToTray', 'allowInsecureHubHttp'
]);

/**
 * A field-level problem the main process would otherwise only *silently* correct.
 * Returning the message lets the form refuse the write and say why.
 */
export function desktopSettingsFieldError(form, name) {
  if (!form || !name) return '';
  const input = form.querySelector(`[name="${name}"]`);
  if (!input) return '';
  return '';
}

/** Read a form back into a settings patch. */
export function readDesktopSettingsPatch(form) {
  const patch = {};
  if (!form) return patch;

  for (const name of CHECKBOX_FIELDS) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) patch[name] = input.checked;
  }
  for (const name of NUMERIC_FIELDS) {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) continue;
    const value = Number(input.value);
    if (Number.isFinite(value)) patch[name] = value;
  }
  for (const name of ['deviceId', 'hubUrl']) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) patch[name] = String(input.value || '').trim();
  }
  // The window-material dropdown offers one surface choice; the settings
  // document stores the legacy pair the window code reads.
  const surface = form.querySelector('[name="windowSurface"]');
  if (surface) Object.assign(patch, settingsPatchForSurface(String(surface.value || '')));
  const language = form.querySelector('[name="language"]');
  if (language) patch.language = String(language.value || 'auto');
  const reduceMotion = form.querySelector('[name="reduceMotion"]');
  if (reduceMotion) patch.reduceMotion = String(reduceMotion.value || 'system');
  const hubMode = form.querySelector('fluent-radio-group[name="hubMode"]');
  if (hubMode) patch.hubMode = String(hubMode.value || '');

  return patch;
}
