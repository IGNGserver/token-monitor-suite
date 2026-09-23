// Accounts view: Hub-owned quota accounts, including the OAuth sign-in flow.
//
// Extracted from app.js so a view can be read and tested on its own. Credentials
// live on the Hub; this view never holds one — it posts the user's input and
// renders the normalized result the Hub returns.

import { formatRelative } from '../core/format.js';
import { clientIconPath, clientLabel, HUB_ACCOUNT_PROVIDERS } from '../core/data.js';
import { tr, escapeHtml, appState, viewHelper } from '../core/viewContext.js';

const emptyHtml = (key) => viewHelper('emptyHtml')(key);
const panel = (...args) => viewHelper('panel')(...args);
const uiIcon = (...args) => viewHelper('uiIcon')(...args);
const loadingHtml = (...args) => viewHelper('loadingHtml')(...args);
const managementError = (...args) => viewHelper('managementError')(...args);

export function accountRecords() {
  return Array.isArray(appState().accounts) ? appState().accounts : [];
}

function accountField(record, key, fallback = '') {
  const value = record?.[key];
  return escapeHtml(value === undefined || value === null ? fallback : value);
}

function accountCredentialField(record, key, fallback = '') {
  const value = record?.credentialMetadata?.[key];
  return escapeHtml(value === undefined || value === null ? fallback : value);
}


export function renderAccounts() {
  if (appState().accountsLoading && !appState().accounts) return loadingHtml();
  if (appState().accountsError && !appState().accounts) {
    return managementError(tr('accounts.title'), appState().accountsError, 'accounts-retry');
  }
  const records = accountRecords();
  const editing = records.find((record) => record.id === appState().accountEditId) || null;
  const currentProvider = editing?.provider || appState().accountSelectedProvider || 'deepseek';
  const canManage = appState().authorization?.scopes?.includes('admin');

  const healthyCount = records.filter((r) => r.enabled !== false && r.status === 'ok').length;
  const errorCount = records.filter((r) => r.enabled !== false && r.status && r.status !== 'ok').length;
  const disabledCount = records.filter((r) => r.enabled === false).length;

  const summary = `
    <div class="summary-chip"><span class="summary-label">${escapeHtml(tr('status.accounts'))}</span><strong>${records.length}</strong></div>
    <div class="summary-chip"><span class="summary-label">${escapeHtml(tr('accounts.statusOk'))}</span><strong>${healthyCount}</strong></div>
    ${errorCount ? `<div class="summary-chip"><span class="summary-label">${escapeHtml(tr('accounts.statusError'))}</span><strong style="color:var(--warn, #e06c75)">${errorCount}</strong></div>` : ''}
    ${disabledCount ? `<div class="summary-chip"><span class="summary-label">${escapeHtml(tr('accounts.statusDisabled'))}</span><strong>${disabledCount}</strong></div>` : ''}
  `;

  const list = records.length
    ? `<div class="management-list">${records.map((record) => {
      const providerLabel = clientLabel(record.provider);
      const isOk = record.status === 'ok';
      const isRefreshing = record.status === 'refreshing' || record.status === 'pending';
      const isDisabled = record.enabled === false;
      let badgeTone = 'warn';
      let badgeText = escapeHtml(record.status || 'unknown');
      if (isDisabled) {
        badgeTone = 'stale';
        badgeText = tr('accounts.statusDisabled');
      } else if (isRefreshing) {
        badgeTone = 'warn';
        badgeText = tr('accounts.statusRefreshing');
      } else if (isOk) {
        badgeTone = 'ok';
        badgeText = tr('accounts.statusOk');
      }

      const metaParts = [
        providerLabel,
        record.label ? escapeHtml(record.label) : '',
        record.accountEmail || record.accountKey ? escapeHtml(record.accountEmail || record.accountKey) : '',
        record.lastSuccessAt ? tr('accounts.lastRefresh', { time: escapeHtml(formatRelative(record.lastSuccessAt, appState().locale)) }) : ''
      ].filter(Boolean);

      const errorDetail = record.lastErrorMessage ? `<div class="row-sub row-error" style="color:var(--warn, #e06c75);margin-top:4px;">${escapeHtml(record.lastErrorMessage)}</div>` : '';

      return `<article class="management-row account-management-row ${record.id === appState().accountEditId ? 'is-editing' : ''}">
        <div class="row-main">
          <img class="client-icon" src="${clientIconPath(record.provider)}" alt="" onerror="this.style.display='none'" />
          <div class="row-copy">
            <div class="row-name">
              ${escapeHtml(record.name || providerLabel)}
              <span class="badge ${badgeTone}" style="margin-left:8px;font-size:11px;">${badgeText}</span>
            </div>
            <div class="row-sub">${metaParts.join(' · ')}</div>
            ${errorDetail}
          </div>
        </div>
        ${canManage ? `<div class="management-actions">
          <fluent-button appearance="transparent" type="button" class="ghost-btn" data-account-refresh="${escapeHtml(record.id)}" ${appState().accountsSaving ? 'disabled' : ''}>${tr('accounts.refresh')}</fluent-button>
          <fluent-button appearance="transparent" type="button" class="ghost-btn" data-account-toggle="${escapeHtml(record.id)}" ${appState().accountsSaving ? 'disabled' : ''}>${record.enabled === false ? tr('accounts.enabled') : tr('accounts.statusDisabled')}</fluent-button>
          <fluent-button appearance="transparent" type="button" class="ghost-btn" data-account-edit="${escapeHtml(record.id)}">${tr('actions.edit')}</fluent-button>
          <fluent-button appearance="secondary" type="button" class="danger-btn" data-account-delete="${escapeHtml(record.id)}">${tr('actions.delete')}</fluent-button>
        </div>` : ''}
      </article>`;
    }).join('')}</div>`
    : emptyHtml('accounts.empty');

  const isEditing = Boolean(editing);
  const selectedProvider = HUB_ACCOUNT_PROVIDERS.find((provider) => provider.id === currentProvider)
    || { id: currentProvider, label: clientLabel(currentProvider) };
  const providerOptionsHtml = HUB_ACCOUNT_PROVIDERS.map((provider) => {
    const selected = provider.id === currentProvider;
    const label = provider.label || clientLabel(provider.id);
    return `<fluent-dropdown-option class="account-select-option" value="${escapeHtml(provider.id)}" text="${escapeHtml(label)}"${selected ? ' selected' : ''}>
      <img slot="start" class="account-select-option-icon" src="${escapeHtml(clientIconPath(provider.id))}" alt="" aria-hidden="true" onerror="this.style.display='none'" />
    </fluent-dropdown-option>`;
  }).join('');
  const providerSelectHtml = `
    <div class="field account-provider-field">
      <label id="account-provider-label">${escapeHtml(tr('accounts.provider'))}</label>
      <fluent-dropdown class="account-provider-dropdown" value="${escapeHtml(selectedProvider.id)}" aria-labelledby="account-provider-label" data-account-provider-select${isEditing ? ' disabled' : ''}>
        <fluent-listbox aria-label="${escapeHtml(tr('accounts.provider'))}">${providerOptionsHtml}</fluent-listbox>
      </fluent-dropdown>
      <input type="hidden" name="provider" value="${escapeHtml(currentProvider)}" data-account-provider-input />
    </div>`;
  const formTitle = isEditing ? tr('accounts.edit') : tr('accounts.add');
  const isOAuthCandidate = !isEditing && (currentProvider === 'codex' || currentProvider === 'antigravity');
  // If editing, default to simple; if OAuth candidate and mode not explicitly switched to simple/json, default to oauth
  const effectiveMode = isOAuthCandidate
    ? (appState().accountFormMode === 'simple' || appState().accountFormMode === 'json' ? appState().accountFormMode : 'oauth')
    : (appState().accountFormMode === 'json' ? 'json' : 'simple');
  const oauthModeActive = effectiveMode === 'oauth';
  const simpleModeActive = effectiveMode === 'simple';

  let simpleFieldsHtml;
  switch (currentProvider) {
    case 'claude':
      // OAuth is listed first and is the better path: the usage endpoint accepts
      // the OAuth token and the collector renews it from the refresh token, so the
      // account keeps working. The web cookie is Cloudflare-gated and short-lived.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.claudeAccessTokenPlaceholder'))}">${tr('accounts.accessToken')}</fluent-text-input>
        <fluent-text-input class="field field-wide" name="refreshToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.claudeRefreshTokenPlaceholder'))}">${tr('accounts.claudeRefreshToken')}</fluent-text-input>
        <fluent-text-input class="field field-wide" name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="sessionKey=... / cookie">${tr('accounts.cookie')}</fluent-text-input>
        <p class="muted tiny notice warn" style="margin-top:4px">${escapeHtml(tr('accounts.claudeRiskNotice'))}</p>
      `;
      break;
    // ollama/sakana take a session cookie. Sakana has no usage API at all: its
    // billing console page is scraped, so a cookie is the only credential it
    // accepts.
    case 'ollama':
    case 'sakana':
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="sessionKey=... / cookie" ${isEditing ? '' : 'required'}>${tr('accounts.cookie')}</fluent-text-input>
      `;
      break;
    case 'commandcode':
      // The API key is listed first because it is the better credential: the
      // `cmd` CLI's own, minted by `cmd login` into ~/.commandcode/auth.json, and
      // it does not expire the way a session cookie does. The cookie stays
      // available for accounts configured before the key path existed.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.commandcodeKeyPlaceholder'))}">${tr('accounts.apiKey')}</fluent-text-input>
        <fluent-text-input class="field field-wide" name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="sessionKey=... / cookie">${tr('accounts.cookie')}</fluent-text-input>
        <p class="muted tiny" style="grid-column:1 / -1;margin-top:2px">${escapeHtml(tr('accounts.commandcodeCredentialHelp'))}</p>
      `;
      break;
    case 'gemini':
      // Gemini Code Assist uses an OAuth access/refresh pair (Standard/Enterprise
      // only; the consumer tiers were retired on 2026-06-18).
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.geminiAccessTokenPlaceholder'))}" ${isEditing ? '' : 'required'}>${tr('accounts.accessToken')}</fluent-text-input>
        <fluent-text-input class="field field-wide" name="refreshToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.geminiRefreshTokenPlaceholder'))}">${tr('accounts.claudeRefreshToken')}</fluent-text-input>
        <p class="muted tiny notice warn" style="margin-top:4px">${escapeHtml(tr('accounts.geminiRetiredNotice'))}</p>
      `;
      break;
    case 'kilocode':
      // Kilo Code authenticates with a Bearer API key (or the CLI login token).
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.kiloKeyPlaceholder'))}" ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
      `;
      break;
    case 'cline':
      // ClinePass authenticates with a Bearer API key from app.cline.bot.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.clineKeyPlaceholder'))}" ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
      `;
      break;
    case 'droid':
      // Droid (Factory) takes a WorkOS access token; the refresh token is
      // optional and lets the Hub renew instead of expiring every ~7 days.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.droidTokenPlaceholder'))}" ${isEditing ? '' : 'required'}>${tr('accounts.accessToken')}</fluent-text-input>
        <fluent-text-input class="field field-wide" name="refreshToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.droidRefreshTokenPlaceholder'))}">${tr('accounts.claudeRefreshToken')}</fluent-text-input>
      `;
      break;
    case 'warp':
      // Warp takes a `wk-` API key (Settings → Platform → API keys). A raw Cookie
      // header value is accepted too, so the same field serves both.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.warpKeyPlaceholder'))}" ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
      `;
      break;
    case 'grok':
      // Grok bills through a bearer token; ~/.grok/auth.json stores it under `key`.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.grokTokenPlaceholder'))}" ${isEditing ? '' : 'required'}>${tr('accounts.accessToken')}</fluent-text-input>
      `;
      break;
    case 'cursor':
      // Cursor's quota endpoints take the WorkosCursorSessionToken cookie value.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.cursorTokenPlaceholder'))}" ${isEditing ? '' : 'required'}>WorkosCursorSessionToken</fluent-text-input>
      `;
      break;
    case 'amp':
      // Amp authenticates with the API key its own CLI stores in
      // ~/.local/share/amp/secrets.json under `apiKey@https://ampcode.com/`.
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.ampApiKeyPlaceholder'))}" ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
      `;
      break;
    case 'codex':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.codexAuthJson')}</span><textarea name="authJson" rows="3" spellcheck="false" autocomplete="off" placeholder="${escapeHtml(tr('accounts.codexAuthJsonPlaceholder'))}"></textarea></label>
        <fluent-text-input class="field" name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.codexAccessTokenPlaceholder'))}">${tr('accounts.accessToken')}</fluent-text-input>
        <fluent-text-input class="field" name="accountId" value="${accountCredentialField(editing, 'accountId')}" spellcheck="false" placeholder="chatgpt_account_id">Account ID (optional)</fluent-text-input>
      `;
      break;
    case 'antigravity':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="endpoint" type="url" value="${accountCredentialField(editing, 'endpoint')}" spellcheck="false" placeholder="http://hub-accessible-host:port" ${isEditing ? '' : 'required'}>${tr('accounts.agyEndpoint')}</fluent-text-input>
        <fluent-text-input class="field" name="csrfToken" type="password" autocomplete="off" spellcheck="false" placeholder="csrf token" ${isEditing ? '' : 'required'}>${tr('accounts.agyCsrfToken')}</fluent-text-input>
        <p class="muted tiny" style="grid-column:1 / -1;margin-top:2px">${escapeHtml(tr('accounts.agyEndpointHint'))}</p>
      `;
      break;
    case 'qoder':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="cookie" ${isEditing ? '' : 'required'}>${tr('accounts.cookie')}</fluent-text-input>
        <label class="field"><span>${tr('accounts.site')}</span><select name="site"><option value="global"${accountCredentialField(editing, 'site', 'global') === 'global' ? ' selected' : ''}>Global</option><option value="cn"${accountCredentialField(editing, 'site') === 'cn' ? ' selected' : ''}>China (CN)</option></select></label>
      `;
      break;
    case 'mimo':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="serviceToken" type="password" autocomplete="off" spellcheck="false" placeholder="api-platform_serviceToken">${tr('accounts.mimoServiceToken')}</fluent-text-input>
        <fluent-text-input class="field" name="userId" autocomplete="off" spellcheck="false" placeholder="1000...">${tr('accounts.mimoUserId')}</fluent-text-input>
        <fluent-text-input class="field field-wide" name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="userId=...; api-platform_serviceToken=...">${tr('accounts.cookie')} (Header)</fluent-text-input>
        <p class="muted tiny" style="grid-column:1 / -1;margin-top:2px">${escapeHtml(tr('accounts.mimoHint'))}</p>
      `;
      break;
    case 'copilot':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="ghu_... / token" ${isEditing ? '' : 'required'}>${tr('accounts.accessToken')}</fluent-text-input>
        <fluent-text-input class="field" name="enterpriseHost" value="${accountCredentialField(editing, 'enterpriseHost')}" spellcheck="false" placeholder="github.mycompany.com">Enterprise Host (optional)</fluent-text-input>
      `;
      break;
    case 'volcengine':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="accessKeyId" value="${accountCredentialField(editing, 'accessKeyId')}" spellcheck="false" placeholder="AKLT...">${tr('accounts.accessKeyId')}</fluent-text-input>
        <fluent-text-input class="field" name="secretAccessKey" type="password" autocomplete="off" spellcheck="false" placeholder="Secret Access Key">${tr('accounts.secretAccessKey')}</fluent-text-input>
        <fluent-text-input class="field" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Ark API Key (alternative)">${tr('accounts.apiKey')}</fluent-text-input>
        <fluent-text-input class="field" name="region" value="${accountCredentialField(editing, 'region')}" spellcheck="false" placeholder="cn-beijing">${tr('accounts.region')}</fluent-text-input>
      `;
      break;
    case 'zaiteam':
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
        <fluent-text-input class="field" name="organizationId" value="${accountCredentialField(editing, 'organizationId')}" spellcheck="false" placeholder="org_..." ${isEditing ? '' : 'required'}>Organization ID</fluent-text-input>
        <fluent-text-input class="field" name="projectId" value="${accountCredentialField(editing, 'projectId')}" spellcheck="false" placeholder="proj_..." ${isEditing ? '' : 'required'}>Project ID</fluent-text-input>
      `;
      break;
    case 'thirdparty':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.thirdPartyAdapter')}</span><select name="adapter"><option value="newapi"${accountCredentialField(editing, 'adapter', 'newapi') === 'newapi' ? ' selected' : ''}>New API / OneAPI</option><option value="custom"${accountCredentialField(editing, 'adapter') === 'custom' ? ' selected' : ''}>Custom</option></select></label>
        <fluent-text-input class="field" name="baseUrl" type="url" value="${accountCredentialField(editing, 'baseUrl')}" spellcheck="false" placeholder="https://api.example.com" ${isEditing ? '' : 'required'}>${tr('accounts.thirdPartyBaseUrl')}</fluent-text-input>
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
      `;
      break;
    case 'zai':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
        <label class="field"><span>${tr('accounts.region')}</span><select name="region"><option value="global"${accountCredentialField(editing, 'region', 'global') === 'global' ? ' selected' : ''}>Global</option><option value="cn"${accountCredentialField(editing, 'region') === 'cn' ? ' selected' : ''}>China (BigModel)</option></select></label>
      `;
      break;
    case 'kimi':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-...">${tr('accounts.apiKey')}</fluent-text-input>
        <fluent-text-input class="field" name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="Access token">Web Access Token</fluent-text-input>
        <fluent-text-input class="field field-wide" name="refreshToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.kimiRefreshTokenPlaceholder'))}">${tr('accounts.claudeRefreshToken')}</fluent-text-input>
        <p class="muted tiny" style="grid-column:1 / -1;margin-top:2px">${escapeHtml(tr('accounts.kimiKeyHelp'))}</p>
      `;
      break;
    case 'opencode':
      simpleFieldsHtml = `
        <fluent-text-input class="field" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key">${tr('accounts.apiKey')}</fluent-text-input>
        <fluent-text-input class="field" name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="Cookie / Token">${tr('accounts.cookie')}</fluent-text-input>
      `;
      break;
    default:
      // deepseek, openrouter, minimax
      simpleFieldsHtml = `
        <fluent-text-input class="field field-wide" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." ${isEditing ? '' : 'required'}>${tr('accounts.apiKey')}</fluent-text-input>
      `;
      break;
  }

  let credentialInputsHtml;
  if (oauthModeActive) {
    const session = appState().oauthSession && appState().oauthSession.provider === currentProvider
      ? appState().oauthSession
      : null;
    credentialInputsHtml = `
      <div class="account-oauth-wizard">
        <div class="account-oauth-step">
          <strong>${escapeHtml(tr('accounts.oauthStep1'))}</strong>
          <p class="muted tiny">${escapeHtml(tr('accounts.oauthStep1Desc'))}</p>
          ${session ? `
            <div class="account-oauth-link-row">
              <input type="text" readonly value="${escapeHtml(session.authUrl)}" class="account-oauth-link-input" />
              <fluent-button appearance="primary" type="button" class="primary-btn" data-account-oauth-open="${escapeHtml(session.authUrl)}">${tr('accounts.oauthOpenLink')}</fluent-button>
              <fluent-button appearance="transparent" type="button" class="ghost-btn" data-account-oauth-copy="${escapeHtml(session.authUrl)}">${tr('accounts.oauthCopyLink')}</fluent-button>
            </div>
          ` : `
            <fluent-button appearance="primary" type="button" class="primary-btn" data-account-oauth-start="${escapeHtml(currentProvider)}" ${appState().oauthLoading ? 'disabled' : ''}>
              ${appState().oauthLoading ? tr('accounts.oauthStarting') : tr('accounts.oauthStart')}
            </fluent-button>
          `}
        </div>
        ${session ? `
          <div class="account-oauth-step account-oauth-step-secondary">
            <strong>${escapeHtml(tr('accounts.oauthStep2'))}</strong>
            <p class="muted tiny">${escapeHtml(tr('accounts.oauthStep2Desc'))}</p>
            ${currentProvider === 'codex' ? `
              <div class="notice warn" style="margin:4px 0 8px">
                <span class="tiny">${escapeHtml(tr('accounts.codexOauthLocalhostNotice'))}</span>
              </div>
            ` : ''}
            <input name="redirectUrl" required placeholder="${escapeHtml(tr('accounts.oauthUrlPlaceholder'))}" class="account-oauth-redirect-input" spellcheck="false" autocomplete="off" autocapitalize="off" />
            <p class="muted tiny">${escapeHtml(tr(currentProvider === 'antigravity' ? 'accounts.oauthCodeHint' : 'accounts.oauthUrlHint'))}</p>
            <input type="hidden" name="oauthSessionId" value="${escapeHtml(session.sessionId)}" />
          </div>
        ` : ''}
      </div>
    `;
  } else if (simpleModeActive) {
    credentialInputsHtml = `<div class="form-grid account-simple-fields">${simpleFieldsHtml}</div>`;
  } else {
    credentialInputsHtml = `<label class="field field-wide"><span>${tr('accounts.modeJson')}</span>
        <textarea name="credentialJson" rows="4" spellcheck="false" autocomplete="off" placeholder='{"apiKey":"sk-..."}'></textarea>
      </label>`;
  }

  const accountDraftKey = `account:${editing?.id || 'new'}`;
  const form = `<form class="management-form account-form" data-account-form data-account-mode="${escapeHtml(effectiveMode)}" data-draft-key="${escapeHtml(accountDraftKey)}">
    <div class="form-section-head">
      <div>
        <h3>${formTitle}</h3>
        <p class="muted tiny">${tr('accounts.hint')}</p>
        ${isEditing ? `<p class="muted tiny">${tr('accounts.credentialKeepHint')}</p>` : ''}
      </div>
      <div class="account-form-head-actions">
        <div class="mode-toggle-group">
          ${isOAuthCandidate ? `<fluent-button appearance="transparent" type="button" class="ghost-btn ${oauthModeActive ? 'active' : ''}" data-account-mode="oauth">${tr('accounts.oauthModeToggle')}</fluent-button>` : ''}
          <fluent-button appearance="transparent" type="button" class="ghost-btn ${!oauthModeActive && simpleModeActive ? 'active' : ''}" data-account-mode="simple">${tr('accounts.modeSimple')}</fluent-button>
          <fluent-button appearance="transparent" type="button" class="ghost-btn ${!oauthModeActive && !simpleModeActive ? 'active' : ''}" data-account-mode="json">${tr('accounts.modeJson')}</fluent-button>
        </div>
        ${isEditing ? `<fluent-button appearance="transparent" type="button" class="ghost-btn" data-account-reset>${tr('actions.cancel')}</fluent-button>` : ''}
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <span>${tr('accounts.provider')}</span>
        ${providerSelectHtml}
      </div>
      <fluent-text-input class="field" name="name" required value="${accountField(editing, 'name')}" placeholder="${currentProvider}-1" maxlength="128">${tr('accounts.name')}</fluent-text-input>
      <fluent-text-input class="field field-wide" name="label" value="${accountField(editing, 'label')}" placeholder="Production / Personal" maxlength="256">${tr('accounts.label')}</fluent-text-input>
      ${isEditing ? `
      <label class="check-row field-wide">
        <input name="enabled" type="checkbox" ${editing?.enabled !== false ? 'checked' : ''} />
        <span>${tr('accounts.enabled')}</span>
      </label>` : ''}
    </div>
    ${credentialInputsHtml}
    ${(currentProvider === 'codex' || currentProvider === 'antigravity') ? `
    <div class="account-disclaimer-box">
      <div class="account-disclaimer-head">
        <span class="account-disclaimer-icon">${uiIcon('warning')}</span>
        <strong>${escapeHtml(tr('accounts.disclaimerTitle'))}</strong>
      </div>
      <p class="account-disclaimer-text">${escapeHtml(tr('accounts.disclaimerText'))}</p>
      ${!isEditing ? `
      <label class="check-row account-disclaimer-check">
        <input name="disclaimerAgree" type="checkbox" required />
        <span>${escapeHtml(tr('accounts.disclaimerAgree'))}</span>
      </label>` : ''}
    </div>` : ''}
    ${appState().accountFormError ? `<p class="form-error account-form-error" role="alert">${escapeHtml(appState().accountFormError)}</p>` : ''}
    <div class="drawer-actions">
      <fluent-button appearance="primary" type="submit" class="primary-btn" ${appState().accountsSaving ? 'disabled' : ''}>
        ${appState().accountsSaving ? tr('actions.saving') : tr('actions.save')}
      </fluent-button>
    </div>
  </form>`;

  const management = appState().authorization?.scopes?.includes('admin')
    ? panel(tr('accounts.add'), form)
    : '';

  return `${panel(tr('accounts.title'), `<div class="summary-grid account-summary">${summary}</div>${list}`)}${management}`;
}

export function renderAccountsPage() {
  return `${renderAccounts()}`;
}
