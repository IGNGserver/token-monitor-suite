'use strict';

// Diagnostics bundle.
//
// The support path for this app is "send us a file", and every setting the user
// might paste into a bug report is either a device name, a Hub URL, or a raw
// credential. So this is an allowlist, not a redaction pass: a key that nobody
// added cannot leak, and a new setting stays private until someone decides it is
// safe to share.

// Nested objects (health, updater, collector status) are owned by other modules and
// could gain a field that reads like a credential, so they are scrubbed by name
// shape. Requires the credential word to open the key or follow a capital: the
// settings allowlist is not scrubbed this way, because the allowlist governs it.
const SECRET_KEY_PATTERN = /(^|[^a-z])(secret|cookie|credential|password|authorization|api[-_]?key|token)/i;

// Settings worth reading when diagnosing "no numbers appear" or "the window looks
// wrong". Everything not listed here is omitted, including every raw credential.
const DIAGNOSTIC_SETTING_KEYS = Object.freeze([
  'hubMode', 'hubUrl', 'allowInsecureHubHttp', 'deviceId', 'lastPostedDeviceId',
  'collectionMode', 'collectionIntervalMs', 'collectionPaused',
  'watchEnabled', 'watchDebounceMs', 'clients', 'projectsEnabled',
  'historyEnabled', 'historyIntervalMs', 'sessionUsageArchiveEnabled', 'wslScanEnabled',
  'allTimeSince', 'trackedClients', 'clientStatus', 'wslStatus', 'periodWindows',
  'language', 'theme', 'currency', 'reduceMotion', 'zoomFactor',
  'systemGlass', 'macosGlassStyle', 'windowsBackdrop', 'windowsSurface',
  'closeToTray', 'startAtLogin', 'startHidden', 'automaticAppUpdates', 'discordRpcEnabled',
  'exportAutoEnabled', 'exportIntervalMs', 'syncUploadIntervalMs',
  'showToolIcons', 'showLiveDot', 'showCompactTotalTokens', 'titleIconOnly',
  'showLimitSource', 'showLimitUsed', 'maskLimitAccountEmails',
  'showHomeLimitBars', 'showHomeLimitProviderNames', 'homeLimitAccountCount',
  'heatmapMetric', 'homeActiveDaysWindow', 'hiddenViews', 'hiddenClients', 'pinnedClients'
]);

function pickSettings(settings) {
  const source = settings || {};
  const out = {};
  for (const key of DIAGNOSTIC_SETTING_KEYS) {
    // The list above is the boundary; a key that reads like a credential here is a
    // review mistake, and the paired test fails the build rather than this loop.
    if (source[key] === undefined) continue;
    out[key] = source[key];
  }
  return out;
}

function withoutSecrets(value) {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    // The nested pass exists because the status objects are owned elsewhere and
    // could gain a field name that reads like a credential.
    if (SECRET_KEY_PATTERN.test(String(key).toLowerCase())) continue;
    out[key] = withoutSecrets(entry);
  }
  return out;
}

/**
 * @param {object} deps
 * @param {() => object} deps.settings          Already-loaded settings snapshot.
 * @param {() => object} deps.appInfo           version/platform/arch/os/packaged/userData
 * @param {() => object} deps.tokscaleStatus    tokscale updater status
 * @param {() => object} deps.syncHealth        four-channel sync health
 * @param {() => object} deps.appUpdate         derived update state
 * @param {() => object} deps.snapshotMeta      where the displayed numbers came from
 * @param {() => object} deps.limitsSummary     provider id + status, no accounts
 * @param {(warning: string) => void} [deps.warn]
 */
function buildDiagnosticsBundle(deps) {
  const read = (fn) => {
    if (typeof fn !== 'function') return null;
    try {
      return fn() || null;
    } catch (error) {
      return { unavailable: String(error?.message || error) };
    }
  };
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    app: withoutSecrets(read(deps.appInfo) || {}),
    settings: withoutSecrets(pickSettings(read(deps.settings))),
    collector: withoutSecrets(read(deps.tokscaleStatus) || {}),
    sync: withoutSecrets(read(deps.syncHealth) || {}),
    appUpdate: withoutSecrets(read(deps.appUpdate) || {}),
    snapshot: withoutSecrets(read(deps.snapshotMeta) || {}),
    limits: withoutSecrets(read(deps.limitsSummary) || {})
  };
}

// The bundle is named after the build and the second it was written: a support
// thread often holds several of them, and a minute-resolution name would overwrite.
function diagnosticsFileName(version) {
  const safeVersion = String(version || 'unknown').replace(/[^0-9A-Za-z.-]/g, '-');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return `token-monitor-diagnostics-${safeVersion}-${stamp}.json`;
}

module.exports = {
  DIAGNOSTIC_SETTING_KEYS,
  buildDiagnosticsBundle,
  diagnosticsFileName,
  pickSettings
};
