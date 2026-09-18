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
          <button type="button" class="ghost-btn" data-account-refresh="${escapeHtml(record.id)}" ${appState().accountsSaving ? 'disabled' : ''}>${tr('accounts.refresh')}</button>
          <button type="button" class="ghost-btn" data-account-toggle="${escapeHtml(record.id)}" ${appState().accountsSaving ? 'disabled' : ''}>${record.enabled === false ? tr('accounts.enabled') : tr('accounts.statusDisabled')}</button>
          <button type="button" class="ghost-btn" data-account-edit="${escapeHtml(record.id)}">${tr('actions.edit')}</button>
          <button type="button" class="danger-btn" data-account-delete="${escapeHtml(record.id)}">${tr('actions.delete')}</button>
        </div>` : ''}
      </article>`;
    }).join('')}</div>`
    : emptyHtml('accounts.empty');

  const isEditing = Boolean(editing);
  const selectedProvider = HUB_ACCOUNT_PROVIDERS.find((provider) => provider.id === currentProvider)
    || { id: currentProvider, label: clientLabel(currentProvider) };
  const providerMenuOpen = !isEditing && appState().accountProviderMenuOpen;
  const providerOptionsHtml = HUB_ACCOUNT_PROVIDERS.map((provider) => {
    const selected = provider.id === currentProvider;
    return `<button type="button" class="account-select-option${selected ? ' selected' : ''}" role="option" aria-selected="${selected ? 'true' : 'false'}" data-account-provider-option="${escapeHtml(provider.id)}">
      <img class="account-select-option-icon" src="${escapeHtml(clientIconPath(provider.id))}" alt="" aria-hidden="true" onerror="this.style.display='none'" />
      <span>${escapeHtml(provider.label || clientLabel(provider.id))}</span>
      ${selected ? `<span class="account-select-option-check">${uiIcon('check')}</span>` : ''}
    </button>`;
  }).join('');
  const providerSelectHtml = `
    <div class="account-provider-select${providerMenuOpen ? ' is-open' : ''}" data-account-provider-select data-value="${escapeHtml(currentProvider)}">
      <input type="hidden" name="provider" value="${escapeHtml(currentProvider)}" data-account-provider-input />
      <button type="button" class="account-select-trigger" data-account-provider-trigger aria-haspopup="listbox" aria-expanded="${providerMenuOpen ? 'true' : 'false'}" aria-controls="account-provider-menu" ${isEditing ? 'disabled' : ''}>
        <span class="account-select-current">
          <img class="account-select-current-icon" src="${escapeHtml(clientIconPath(selectedProvider.id))}" alt="" aria-hidden="true" onerror="this.style.display='none'" />
          <span>${escapeHtml(selectedProvider.label || clientLabel(selectedProvider.id))}</span>
        </span>
        <span class="account-select-chevron">${uiIcon('chevronDown')}</span>
      </button>
      <div id="account-provider-menu" class="account-select-menu" data-account-provider-menu role="listbox" aria-label="${escapeHtml(tr('accounts.provider'))}"${providerMenuOpen ? '' : ' hidden'}>
        ${providerOptionsHtml}
      </div>
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
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="sessionKey=... / cookie" ${isEditing ? '' : 'required'} /></label>
        <p class="muted tiny notice warn" style="margin-top:4px">${escapeHtml(tr('accounts.claudeRiskNotice'))}</p>
      `;
      break;
    case 'commandcode':
    case 'ollama':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="sessionKey=... / cookie" ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'codex':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.codexAuthJson')}</span><textarea name="authJson" rows="3" spellcheck="false" autocomplete="off" placeholder="${escapeHtml(tr('accounts.codexAuthJsonPlaceholder'))}"></textarea></label>
        <label class="field"><span>${tr('accounts.accessToken')}</span><input name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('accounts.codexAccessTokenPlaceholder'))}" /></label>
        <label class="field"><span>Account ID (optional)</span><input name="accountId" value="${accountCredentialField(editing, 'accountId')}" spellcheck="false" placeholder="chatgpt_account_id" /></label>
      `;
      break;
    case 'antigravity':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.agyEndpoint')}</span><input name="endpoint" type="url" value="${accountCredentialField(editing, 'endpoint')}" spellcheck="false" placeholder="http://hub-accessible-host:port" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>${tr('accounts.agyCsrfToken')}</span><input name="csrfToken" type="password" autocomplete="off" spellcheck="false" placeholder="csrf token" ${isEditing ? '' : 'required'} /></label>
        <p class="muted tiny" style="grid-column:1 / -1;margin-top:2px">${escapeHtml(tr('accounts.agyEndpointHint'))}</p>
      `;
      break;
    case 'qoder':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="cookie" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>${tr('accounts.site')}</span><select name="site"><option value="global"${accountCredentialField(editing, 'site', 'global') === 'global' ? ' selected' : ''}>Global</option><option value="cn"${accountCredentialField(editing, 'site') === 'cn' ? ' selected' : ''}>China (CN)</option></select></label>
      `;
      break;
    case 'mimo':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.mimoServiceToken')}</span><input name="serviceToken" type="password" autocomplete="off" spellcheck="false" placeholder="api-platform_serviceToken" /></label>
        <label class="field"><span>${tr('accounts.mimoUserId')}</span><input name="userId" autocomplete="off" spellcheck="false" placeholder="1000..." /></label>
        <label class="field field-wide"><span>${tr('accounts.cookie')} (Header)</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="userId=...; api-platform_serviceToken=..." /></label>
        <p class="muted tiny" style="grid-column:1 / -1;margin-top:2px">${escapeHtml(tr('accounts.mimoHint'))}</p>
      `;
      break;
    case 'copilot':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.accessToken')}</span><input name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="ghu_... / token" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>Enterprise Host (optional)</span><input name="enterpriseHost" value="${accountCredentialField(editing, 'enterpriseHost')}" spellcheck="false" placeholder="github.mycompany.com" /></label>
      `;
      break;
    case 'volcengine':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.accessKeyId')}</span><input name="accessKeyId" value="${accountCredentialField(editing, 'accessKeyId')}" spellcheck="false" placeholder="AKLT..." /></label>
        <label class="field"><span>${tr('accounts.secretAccessKey')}</span><input name="secretAccessKey" type="password" autocomplete="off" spellcheck="false" placeholder="Secret Access Key" /></label>
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Ark API Key (alternative)" /></label>
        <label class="field"><span>${tr('accounts.region')}</span><input name="region" value="${accountCredentialField(editing, 'region')}" spellcheck="false" placeholder="cn-beijing" /></label>
      `;
      break;
    case 'zaiteam':
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>Organization ID</span><input name="organizationId" value="${accountCredentialField(editing, 'organizationId')}" spellcheck="false" placeholder="org_..." ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>Project ID</span><input name="projectId" value="${accountCredentialField(editing, 'projectId')}" spellcheck="false" placeholder="proj_..." ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'thirdparty':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.thirdPartyAdapter')}</span><select name="adapter"><option value="newapi"${accountCredentialField(editing, 'adapter', 'newapi') === 'newapi' ? ' selected' : ''}>New API / OneAPI</option><option value="custom"${accountCredentialField(editing, 'adapter') === 'custom' ? ' selected' : ''}>Custom</option></select></label>
        <label class="field"><span>${tr('accounts.thirdPartyBaseUrl')}</span><input name="baseUrl" type="url" value="${accountCredentialField(editing, 'baseUrl')}" spellcheck="false" placeholder="https://api.example.com" ${isEditing ? '' : 'required'} /></label>
        <label class="field field-wide"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." ${isEditing ? '' : 'required'} /></label>
      `;
      break;
    case 'zai':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" ${isEditing ? '' : 'required'} /></label>
        <label class="field"><span>${tr('accounts.region')}</span><select name="region"><option value="global"${accountCredentialField(editing, 'region', 'global') === 'global' ? ' selected' : ''}>Global</option><option value="cn"${accountCredentialField(editing, 'region') === 'cn' ? ' selected' : ''}>China (BigModel)</option></select></label>
      `;
      break;
    case 'kimi':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." /></label>
        <label class="field"><span>Web Access Token</span><input name="accessToken" type="password" autocomplete="off" spellcheck="false" placeholder="Access token" /></label>
        <p class="muted tiny" style="grid-column:1 / -1;margin-top:2px">${escapeHtml(tr('accounts.kimiKeyHelp'))}</p>
      `;
      break;
    case 'opencode':
      simpleFieldsHtml = `
        <label class="field"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="API Key" /></label>
        <label class="field"><span>${tr('accounts.cookie')}</span><input name="cookie" type="password" autocomplete="off" spellcheck="false" placeholder="Cookie / Token" /></label>
      `;
      break;
    default:
      // deepseek, openrouter, minimax
      simpleFieldsHtml = `
        <label class="field field-wide"><span>${tr('accounts.apiKey')}</span><input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." ${isEditing ? '' : 'required'} /></label>
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
              <button type="button" class="primary-btn" data-account-oauth-open="${escapeHtml(session.authUrl)}">${tr('accounts.oauthOpenLink')}</button>
              <button type="button" class="ghost-btn" data-account-oauth-copy="${escapeHtml(session.authUrl)}">${tr('accounts.oauthCopyLink')}</button>
            </div>
          ` : `
            <button type="button" class="primary-btn" data-account-oauth-start="${escapeHtml(currentProvider)}" ${appState().oauthLoading ? 'disabled' : ''}>
              ${appState().oauthLoading ? tr('accounts.oauthStarting') : tr('accounts.oauthStart')}
            </button>
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
    credentialInputsHtml = `<label class="field field-wide">
        <span>${tr('accounts.modeJson')}</span>
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
          ${isOAuthCandidate ? `<button type="button" class="ghost-btn ${oauthModeActive ? 'active' : ''}" data-account-mode="oauth">${tr('accounts.oauthModeToggle')}</button>` : ''}
          <button type="button" class="ghost-btn ${!oauthModeActive && simpleModeActive ? 'active' : ''}" data-account-mode="simple">${tr('accounts.modeSimple')}</button>
          <button type="button" class="ghost-btn ${!oauthModeActive && !simpleModeActive ? 'active' : ''}" data-account-mode="json">${tr('accounts.modeJson')}</button>
        </div>
        ${isEditing ? `<button type="button" class="ghost-btn" data-account-reset>${tr('actions.cancel')}</button>` : ''}
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <span>${tr('accounts.provider')}</span>
        ${providerSelectHtml}
      </div>
      <label class="field">
        <span>${tr('accounts.name')}</span>
        <input name="name" required value="${accountField(editing, 'name')}" placeholder="${currentProvider}-1" maxlength="128" />
      </label>
      <label class="field field-wide">
        <span>${tr('accounts.label')}</span>
        <input name="label" value="${accountField(editing, 'label')}" placeholder="Production / Personal" maxlength="256" />
      </label>
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
      <button type="submit" class="primary-btn" ${appState().accountsSaving ? 'disabled' : ''}>
        ${appState().accountsSaving ? tr('actions.saving') : tr('actions.save')}
      </button>
    </div>
  </form>`;

  const management = appState().authorization?.scopes?.includes('admin')
    ? panel(tr('accounts.add'), form)
    : '';

  return `${panel(tr('accounts.title'), `<div class="summary-grid account-summary">${summary}</div>${list}`)}${management}`;
}

export function renderAccountsPage() {
  return `<section class="page-intro"><div><div class="eyebrow">${escapeHtml(tr('page.overview.kicker'))}</div><h2>${escapeHtml(tr('nav.accounts'))}</h2><p>${escapeHtml(tr('page.accounts.description'))}</p></div></section>${renderAccounts()}`;
}
