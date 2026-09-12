'use strict';

const { LIMIT_PROVIDER_IDS } = require('./limitProviders');

// Device-side quota collection is intentionally disabled. This table remains
// the source of truth for the central Hub account UI and for compatibility
// with provider adapters that are also used by the Hub.
const HUB_MANUAL_PROVIDER_IDS = Object.freeze(new Set([
  'claude', 'codex', 'antigravity', 'opencode', 'openrouter', 'deepseek', 'minimax', 'mimo',
  'copilot', 'zai', 'zaiteam', 'volcengine', 'qoder', 'commandcode',
  'ollama', 'kimi', 'thirdparty'
]));

const MANUAL_PROVIDER_KEYS = Object.freeze({
  claude: ['claudeWebCookie'],
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
  commandcode: ['commandcodeCookie'],
  ollama: ['ollamaCookie'],
  kimi: ['kimiApiKey', 'kimiWebAccessToken'],
  thirdparty: ['thirdPartyProfiles']
});

const LIMIT_PROVIDER_SOURCE_CAPABILITIES = Object.freeze({
  claude: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.claude },
  codex: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.codex },
  cursor: { manual: false, automatic: false, authority: 'unsupported', manualKeys: [] },
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
  ollama: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.ollama },
  kimi: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.kimi },
  thirdparty: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.thirdparty },
  antigravity: { manual: true, automatic: false, authority: 'hub', manualKeys: MANUAL_PROVIDER_KEYS.antigravity },
  grok: { manual: false, automatic: false, authority: 'unsupported', manualKeys: [] },
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
