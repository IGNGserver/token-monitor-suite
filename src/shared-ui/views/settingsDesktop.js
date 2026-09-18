// Desktop-only settings.
//
// The Hub dashboard offers browser preferences; a desktop install additionally
// owns the collector, the window and the update channel. Those controls live
// here rather than in the Hub's settings view, and the whole module is inert
// unless the host reports `capabilities.desktopSettings` — so the same shared
// settings page renders correctly in both hosts.
//
// Every key written here is an existing settings.json key. Renaming one would
// silently drop a user's configuration on upgrade, so the field `name`
// attributes are the compatibility surface.

import { tr, escapeHtml, settingsOptionList } from '../core/viewContext.js';

const SOFTWARE_GLASS = [['system', 'settings.appearance.glassEffectSystem'], ['off', 'settings.appearance.glassEffectTransparent']];
const REDUCE_MOTION = [
  ['system', 'settings.appearance.motionSystem'],
  ['on', 'settings.appearance.motionOn'],
  ['off', 'settings.appearance.motionOff']
];

function optionLabels(pairs) {
  return pairs.map(([value, key]) => [value, tr(key)]);
}

function checkbox(name, labelKey, checked, { description = '', id = '' } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  return `<label class="check-row">
    <input type="checkbox" name="${name}"${idAttr}${checked ? ' checked' : ''} />
    <span><span class="row-name">${escapeHtml(tr(labelKey))}</span>${description ? `<span class="row-sub">${escapeHtml(description)}</span>` : ''}</span>
  </label>`;
}

function numberField(name, labelKey, value, { min = 0, max = 100000, step = 1, id = '' } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  return `<label class="field"><span>${escapeHtml(tr(labelKey))}</span>
    <input type="number" name="${name}"${idAttr} value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="${step}" />
  </label>`;
}

function selectField(name, labelKey, options, value, { id = '' } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  return `<label class="field"><span>${escapeHtml(tr(labelKey))}</span>
    <select name="${name}"${idAttr}>${settingsOptionList(options, value)}</select>
  </label>`;
}

function textField(name, labelKey, value, { id = '', placeholder = '' } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  return `<label class="field"><span>${escapeHtml(tr(labelKey))}</span>
    <input type="text" name="${name}"${idAttr} value="${escapeHtml(String(value ?? ''))}" spellcheck="false"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''} />
  </label>`;
}

function tokenListField(name, ids, selected, labelKey) {
  const selectedSet = new Set(String(selected || '').split(',').map((v) => v.trim()).filter(Boolean));
  const rows = ids.map((id) => `<label class="check-row">
      <input type="checkbox" data-token-list="${name}" value="${escapeHtml(id)}"${selectedSet.has(id) ? ' checked' : ''} />
      <span class="row-name">${escapeHtml(id)}</span>
    </label>`).join('');
  return `<div class="desktop-setting-block">
    <span class="summary-label">${escapeHtml(tr(labelKey))}</span>
    <div class="desktop-token-list">${rows}</div>
  </div>`;
}

/**
 * @param {object} settings  Current settings (redacted) from the main process.
 * @param {object} catalog   Lists owned by the shared modules.
 * @param {object} info      Platform facts, e.g. whether a login item exists.
 */
export function renderDesktopSettings(settings = {}, catalog = {}, info = {}) {
  const isWindows = info.platform === 'win32';
  const isMac = info.platform === 'darwin';
  const clients = catalog.clients || [];

  const groups = [];

  // --- Collection ---------------------------------------------------------
  const collectionRows = [];
  collectionRows.push(tokenListField('clients', clients, settings.clients, 'desktop.settings.trackedClients'));
  collectionRows.push(selectField('collectionMode', 'desktop.settings.collectionMode',
    [['live', tr('desktop.settings.modeLive')], ['smart', tr('desktop.settings.modeSmart')], ['interval', tr('desktop.settings.modeInterval')]],
    settings.collectionMode || 'live', { id: 'collectionModeInput' }));
  collectionRows.push(selectField('collectionIntervalMs', 'desktop.settings.collectionInterval',
    (catalog.collectionModeIntervals || [5 * 60 * 1000, 10 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000])
      .map((ms) => [String(ms), `${Math.round(ms / 60000)} min`]),
    String(settings.collectionIntervalMs ?? 300000), { id: 'collectionIntervalInput' }));
  collectionRows.push(checkbox('projectsEnabled', 'desktop.settings.projectsEnabled', settings.projectsEnabled === true));
  collectionRows.push(checkbox('historyEnabled', 'desktop.settings.historyEnabled', settings.historyEnabled !== false));
  collectionRows.push(selectField('historyIntervalMs', 'desktop.settings.historyInterval',
    (catalog.historyIntervals || []).map((ms) => [String(ms), `${Math.round(ms / 60000)} min`]),
    String(settings.historyIntervalMs ?? 900000)));
  collectionRows.push(checkbox('sessionUsageArchiveEnabled', 'desktop.settings.sessionArchive', settings.sessionUsageArchiveEnabled !== false));
  if (isWindows) {
    collectionRows.push(checkbox('wslScanEnabled', 'desktop.settings.wslScan', settings.wslScanEnabled !== false));
  }
  collectionRows.push(textField('allTimeSince', 'desktop.settings.allTimeSince', settings.allTimeSince || '2024-01-01', { placeholder: '2024-01-01' }));
  groups.push(group('collection', 'desktop.settings.groupCollection', collectionRows.join('')));

  // --- Data export --------------------------------------------------------
  groups.push(group('export', 'desktop.settings.groupExport', [
    checkbox('exportAutoEnabled', 'desktop.settings.exportAuto', settings.exportAutoEnabled === true),
    `<div class="desktop-setting-row">
      <span class="row-sub" data-export-dir>${escapeHtml(settings.exportDir || tr('desktop.settings.exportDirNone'))}</span>
      <button type="button" class="ghost-btn" data-desktop-action="pick-export-dir">${escapeHtml(tr('desktop.settings.chooseFolder'))}</button>
    </div>`,
    selectField('exportIntervalMs', 'desktop.settings.exportInterval',
      (catalog.exportIntervals || []).map((ms) => [String(ms), `${Math.round(ms / 60000)} min`]),
      String(settings.exportIntervalMs ?? 60000)),
    `<div class="drawer-actions"><button type="button" class="ghost-btn" data-desktop-action="export-now">${escapeHtml(tr('desktop.settings.exportNow'))}</button></div>`
  ].join('')));

  // --- Window & appearance ------------------------------------------------
  const appearanceRows = [];
  appearanceRows.push(selectField('systemGlass', 'desktop.settings.systemGlass', optionLabels(SOFTWARE_GLASS), settings.systemGlass === false ? 'off' : 'system'));
  if (isMac) {
    appearanceRows.push(selectField('macosGlassStyle', 'desktop.settings.macosGlassStyle',
      [['vibrancy', tr('desktop.settings.glassVibrancy')], ['liquid-glass', tr('desktop.settings.glassLiquid')]],
      settings.macosGlassStyle || 'vibrancy'));
  }
  appearanceRows.push(selectField('reduceMotion', 'desktop.settings.reduceMotion', optionLabels(REDUCE_MOTION), settings.reduceMotion || 'system'));
  appearanceRows.push(checkbox('showToolIcons', 'desktop.settings.showToolIcons', settings.showToolIcons !== false));
  appearanceRows.push(checkbox('showLiveDot', 'desktop.settings.showLiveDot', settings.showLiveDot !== false));
  appearanceRows.push(checkbox('showCompactTotalTokens', 'desktop.settings.showCompactTotalTokens', settings.showCompactTotalTokens === true));
  appearanceRows.push(numberField('zoomFactor', 'desktop.settings.zoom', settings.zoomFactor ?? 1, { min: 0.7, max: 1.6, step: 0.05 }));
  groups.push(group('appearance', 'desktop.settings.groupAppearance', appearanceRows.join('')));

  // --- Startup, updates, integrations -------------------------------------
  const generalRows = [];
  if (info.loginItemSupported) {
    generalRows.push(checkbox('startAtLogin', 'desktop.settings.startAtLogin', settings.startAtLogin === true));
  }
  generalRows.push(checkbox('automaticAppUpdates', 'desktop.settings.automaticAppUpdates', settings.automaticAppUpdates === true));
  generalRows.push(checkbox('discordRpcEnabled', 'desktop.settings.discordRpc', settings.discordRpcEnabled === true));
  generalRows.push(`<div class="desktop-setting-row">
      <span class="row-sub">${escapeHtml(tr('desktop.settings.appVersion'))}: <strong data-app-version>—</strong></span>
      <button type="button" class="ghost-btn" data-desktop-action="check-updates">${escapeHtml(tr('desktop.settings.checkUpdates'))}</button>
    </div>`);
  generalRows.push(`<div class="desktop-setting-row">
      <span class="row-sub">${escapeHtml(tr('desktop.settings.openConfigHint'))}</span>
      <button type="button" class="ghost-btn" data-desktop-action="open-user-data">${escapeHtml(tr('desktop.settings.openConfig'))}</button>
    </div>`);
  groups.push(group('general', 'desktop.settings.groupGeneral', generalRows.join('')));

  // --- Device identity ----------------------------------------------------
  groups.push(group('device', 'desktop.settings.groupDevice', [
    textField('deviceId', 'desktop.settings.deviceId', settings.deviceId || '', { placeholder: tr('desktop.settings.deviceIdHint') })
  ].join('')));

  // --- Hub connection -----------------------------------------------------
  const hubRows = [];
  hubRows.push(`<div class="mode-toggle-group" role="radiogroup">
      <label class="mode-toggle"><input type="radio" name="hubMode" value="local"${(settings.hubMode || 'local') === 'local' ? ' checked' : ''} /><span>${escapeHtml(tr('desktop.settings.hubLocal'))}</span></label>
      <label class="mode-toggle"><input type="radio" name="hubMode" value="client"${settings.hubMode === 'client' ? ' checked' : ''} /><span>${escapeHtml(tr('desktop.settings.hubClient'))}</span></label>
    </div>`);
  hubRows.push(textField('hubUrl', 'desktop.settings.hubUrl', settings.hubUrl || '', { placeholder: 'http://hub-host:17321' }));
  hubRows.push(selectField('syncUploadIntervalMs', 'desktop.settings.syncUploadInterval',
    (catalog.syncUploadIntervals || []).map((ms) => [String(ms), ms === 0 ? tr('desktop.settings.syncLive') : `${Math.round(ms / 60000)} min`]),
    String(settings.syncUploadIntervalMs ?? 600000)));
  hubRows.push(checkbox('allowInsecureHubHttp', 'desktop.settings.allowInsecureHttp', settings.allowInsecureHubHttp === true,
    { description: tr('desktop.settings.allowInsecureHttpDesc') }));
  groups.push(group('sync', 'desktop.settings.groupSync', hubRows.join('')));

  return groups.join('');
}

function group(id, titleKey, body) {
  return `<section class="panel desktop-settings-group" data-desktop-group="${escapeHtml(id)}">
    <div class="panel-head"><h2 class="panel-title">${escapeHtml(tr(titleKey))}</h2></div>
    <div class="desktop-settings-body">${body}</div>
  </section>`;
}

// Which settings are numeric, so a form read does not store "300000" as a
// string and confuse the collector's normalizers.
const NUMERIC_FIELDS = new Set(['collectionIntervalMs', 'historyIntervalMs', 'exportIntervalMs', 'syncUploadIntervalMs', 'zoomFactor']);
const CHECKBOX_FIELDS = new Set([
  'projectsEnabled', 'historyEnabled', 'sessionUsageArchiveEnabled', 'wslScanEnabled',
  'exportAutoEnabled', 'showToolIcons', 'showLiveDot', 'showCompactTotalTokens',
  'startAtLogin', 'automaticAppUpdates', 'discordRpcEnabled', 'allowInsecureHubHttp'
]);

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
  for (const name of ['allTimeSince', 'deviceId', 'hubUrl']) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) patch[name] = String(input.value || '').trim();
  }
  for (const name of ['collectionMode', 'systemGlass', 'macosGlassStyle', 'reduceMotion']) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) patch[name] = String(input.value || '');
  }
  const hubMode = form.querySelector('[name="hubMode"]:checked');
  if (hubMode) patch.hubMode = hubMode.value;

  const clients = [...form.querySelectorAll('[data-token-list="clients"]:checked')].map((input) => input.value);
  if (form.querySelector('[data-token-list="clients"]')) patch.clients = clients.join(',');

  return patch;
}
