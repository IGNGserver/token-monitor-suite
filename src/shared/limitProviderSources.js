'use strict';

const { LIMIT_PROVIDER_IDS } = require('./limitProviders');

// Device-side quota collection is intentionally disabled. This table remains
// the source of truth for the central Hub account UI and for compatibility
// with provider adapters that are also used by the Hub.
const HUB_MANUAL_PROVIDER_IDS = Object.freeze(new Set([
  'claude', 'codex', 'antigravity', 'opencode', 'openrouter', 'deepseek', 'minimax', 'mimo',
  'copilot', 'zai', 'zaiteam', 'volcengine', 'qoder', 'commandcode', 'amp', 'sakana', 'cursor', 'grok', 'warp', 'droid', 'cline', 'kilocode', 'gemini',
  'ollama', 'kimi', 'thirdparty'
]));

const MANUAL_PROVIDER_KEYS = Object.freeze({
  // OAuth (access + optional refresh) is the preferred Claude credential: the
  // usage endpoint accepts the OAuth token and the collector renews it, whereas
  // the web cookie is Cloudflare-gated and short-lived.
  claude: ['claudeAccessToken', 'claudeRefreshToken', 'claudeWebCookie'],
  cursor: ['cursorSessionToken'],
  // Gemini Code Assist uses an OAuth access/refresh pair (Standard/Enterprise
  // only: the consumer tiers were retired on 2026-06-18, including Gemini CLI).
  // Kilo Code bills through the app's tRPC endpoint with a Bearer API key.
  // ClinePass bills against a plan; a Bearer API key from app.cline.bot.
  // Droid (Factory) uses a WorkOS access token, optionally with a refresh token.
  // Warp bills over GraphQL with a `wk-` API key (or a raw Cookie header).
  // Grok bills through a bearer token; the CLI stores it in ~/.grok/auth.json.
  codex: ['codexAuthJson', 'codexAccessToken', 'codexManagedAccounts'],
  antigravity: ['antigravityAccessToken', 'antigravityRefreshToken', 'antigravityIdToken', 'antigravityProjectId', 'antigravityEndpoint', 'antigravityCsrfToken'],
  opencode: ['opencodeCookie', 'opencodeProfiles'],
  openrouter: ['openrouterProfiles'],
  deepseek: ['deepseekApiKey'],
  minimax: ['minimaxApiKey'],
  mimo: ['mimoManagedAccounts'],
  copilot: ['copilotApiToken'],
  zai: ['zaiApiKey'],
  zaiteam: ['zaiTeamApiKey'],
  volcengine: ['volcengineAccessKeyId', 'volcengineSecretAccessKey'],
  qoder: ['qoderCookie'],
  commandcode: ['commandcodeApiKey', 'commandcodeCookie'],
  // Amp authenticates with the API key from its own secrets.json locally, but the
  // Hub has no such file and is the credential authority, so the key is pastable.
  amp: ['ampApiKey'],
  // Sakana is a cookie-authenticated HTML scrape of the billing console.
  sakana: ['sakanaSessionCookie'],
  ollama: ['ollamaCookie'],
  kimi: ['kimiApiKey', 'kimiWebAccessToken', 'kimiRefreshToken'],
  thirdparty: ['thirdPartyProfiles']
});

const LIMIT_PROVIDER_SOURCE_CAPABILITIES = Object.freeze({
  claude: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.claude },
  codex: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.codex },
  // Cursor's quota comes from plain HTTP (cursor.com/api/usage-summary) with a
  // WorkosCursorSessionToken, so a Hub account is just that pasted token. It was
  // marked 'unsupported' historically because the desktop path reads a local
  // credentials file, but the probe itself has no local dependency.
  cursor: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.cursor },
  gemini: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.gemini },
  kilocode: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.kilocode },
  cline: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.cline },
  droid: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.droid },
  warp: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.warp },
  grok: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.grok },
  opencode: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.opencode },
  openrouter: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.openrouter },
  deepseek: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.deepseek },
  minimax: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.minimax },
  mimo: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.mimo },
  copilot: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.copilot },
  zai: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.zai },
  zaiteam: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.zaiteam },
  volcengine: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.volcengine },
  qoder: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.qoder },
  commandcode: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.commandcode },
  amp: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.amp },
  sakana: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.sakana },
  ollama: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.ollama },
  kimi: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.kimi },
  thirdparty: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.thirdparty },
  antigravity: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.antigravity },
  kiro: { manual: false, automatic: false, authority: 'unsupported', manualKeys: [] }
});

function normalizeLimitProviderIds(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    const provider = String(item || '').trim().toLowerCase();
    if (!LIMIT_PROVIDER_IDS.includes(provider) || seen.has(provider)) continue;
    seen.add(provider);
    result.push(provider);
  }
  return result;
}

function parseLimitProviderAutoDetectDisabled(value) {
  return normalizeLimitProviderIds(value);
}

function providerSourceCapability(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  const capability = LIMIT_PROVIDER_SOURCE_CAPABILITIES[normalized];
  if (!capability) return null;
  return {
    provider: normalized,
    manual: capability.manual === true,
    automatic: false,
    authority: capability.authority || 'unsupported',
    supportsToggle: capability.manual === true && capability.automatic === true,
    manualKeys: [...(capability.manualKeys || [])]
  };
}

function limitProviderAutoDetectDisabled(provider, options = {}) {
  const normalized = String(provider || '').trim().toLowerCase();
  return parseLimitProviderAutoDetectDisabled(options.limitProviderAutoDetectDisabled).includes(normalized);
}

function providerSupportsAutoDetectToggle(provider) {
  return providerSourceCapability(provider)?.supportsToggle === true;
}

module.exports = {
  HUB_MANUAL_PROVIDER_IDS,
  LIMIT_PROVIDER_SOURCE_CAPABILITIES,
  limitProviderAutoDetectDisabled,
  normalizeLimitProviderIds,
  parseLimitProviderAutoDetectDisabled,
  providerSourceCapability,
  providerSupportsAutoDetectToggle
};
