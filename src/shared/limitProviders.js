'use strict';

// UMD on purpose: the Electron renderer loads this file directly with a
// <script> tag (see renderer/index.html), while the Hub and the agent require()
// it. Exposing the single canonical provider list to the renderer is what stops
// its hand-maintained copy from drifting again — that copy had silently dropped
// `commandcode` and `thirdparty`, so a configured provider could not be
// displayed, reordered, or saved (the renderer rewrote the stored 20-id list
// down to 18 on every settings save).
(function exposeLimitProviders(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorLimitProviders = api;
})(typeof window !== 'undefined' ? window : null, function createLimitProvidersApi() {
  // Keep provider order stable: it is also the default order for a new install.
  // Saved user ordering is parsed separately and must not be overwritten.
  const LIMIT_PROVIDER_IDS = Object.freeze([
    'claude', 'codex', 'opencode', 'cursor', 'antigravity', 'kimi', 'grok',
    'copilot', 'commandcode', 'mimo', 'zai', 'zaiteam', 'kiro', 'qoder',
    'deepseek', 'openrouter', 'minimax', 'volcengine', 'ollama', 'thirdparty'
  ]);

  // These are the only window metrics that cross the shared limits schema.
  const LIMIT_WINDOW_METRICS = Object.freeze(['credits', 'spend']);
  const VALID_LIMIT_WINDOW_METRICS = new Set(LIMIT_WINDOW_METRICS);

  return {
    LIMIT_PROVIDER_IDS,
    LIMIT_WINDOW_METRICS,
    VALID_LIMIT_WINDOW_METRICS
  };
});
