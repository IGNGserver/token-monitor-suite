'use strict';

/**
 * Cline / ClinePass subscription-usage adapter.
 *
 * Cline's plan quota is a small, stable JSON API — the simplest provider here.
 * A single Bearer API key (from app.cline.bot → Settings → API Keys) returns the
 * three rolling windows.
 *
 * Two things shape the implementation:
 *
 *  - The response is **percent-only**: it reports `percentUsed` and a reset time,
 *    with no absolute used/limit counts. So the windows carry `usedPercent` and
 *    no `used`/`limit`, and the renderer draws the meter from the percentage.
 *  - `resetsAt` may legitimately be `null` (a window with no scheduled reset), so
 *    a null must not be treated as a parse failure — only a *malformed* value is.
 *
 * The API key is server-side validated, so a 401/403 is a real
 * "re-authenticate" signal rather than a transient error.
 */

const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');

const CLINE_FETCH_TIMEOUT_MS = 12_000;
const CLINE_USAGE_URL = 'https://api.cline.bot/api/v1/users/me/plan/usage-limits';
const CLINE_API_ORIGIN = 'https://api.cline.bot';

// The window names Cline reports, mapped onto the shared window kinds and their
// nominal lengths. Unknown types are skipped rather than guessed at.
const CLINE_WINDOW_TYPES = Object.freeze({
  five_hour: { kind: 'session', label: '5-hour', windowMinutes: 5 * 60 },
  weekly: { kind: 'weekly', label: 'Weekly', windowMinutes: 7 * 24 * 60 },
  monthly: { kind: 'billing', label: 'Monthly', windowMinutes: 30 * 24 * 60 }
});

function cleanSecret(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function hasControlCharacters(text) {
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function clineApiKey(options = {}) {
  const raw = cleanSecret(options.clineApiKey || options.clinepassApiKey);
  if (!raw || hasControlCharacters(raw)) return '';
  return raw;
}

function hasClineCredentials(options = {}) {
  return Boolean(clineApiKey(options));
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

function toIsoOrNull(value) {
  // `null`/`undefined` means "no scheduled reset", which is a valid state and
  // must not be reported as a parse failure.
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) return undefined; // malformed
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

/**
 * Parse the response into windows. Returns `{windows, malformed}`; `malformed`
 * is true when a limit entry existed but carried an unusable `percentUsed`, which
 * the caller reports as `unavailable` rather than silently dropping it.
 */
function parseClineUsage(body) {
  const data = body && typeof body === 'object' ? body.data : null;
  const limits = data && typeof data === 'object' ? data.limits : null;
  if (!Array.isArray(limits)) return { windows: [], malformed: false };

  const windows = [];
  let malformed = false;
  for (const rawLimit of limits) {
    if (!rawLimit || typeof rawLimit !== 'object') continue;
    const spec = CLINE_WINDOW_TYPES[String(rawLimit.type || '').trim().toLowerCase()];
    if (!spec) continue;
    const usedPercent = clampPercent(Number(rawLimit.percentUsed));
    if (usedPercent === null) {
      malformed = true;
      continue;
    }
    const resetsAt = toIsoOrNull(rawLimit.resetsAt);
    if (resetsAt === undefined) {
      malformed = true;
      continue;
    }
    windows.push({
      kind: spec.kind,
      label: spec.label,
      usedPercent,
      windowMinutes: spec.windowMinutes,
      ...(resetsAt ? { resetsAt } : {}),
      showMeter: true
    });
  }
  return { windows, malformed };
}

function mapClineErrorStatus(error) {
  const status = error && error.status;
  if (['disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error'].includes(status)) return status;
  return 'unavailable';
}

async function fetchClineLimits(options = {}, deps = {}) {
  const nowMs = (deps.now || Date.now)();
  const updatedAt = new Date(nowMs).toISOString();
  const key = clineApiKey(options);
  if (!key) {
    return normalizeLimitProvider({
      provider: 'cline',
      source: 'api',
      status: 'notConfigured',
      updatedAt,
      windows: []
    });
  }

  try {
    const body = await runWithProbeDeadline(async ({ signal }) => {
      const response = await (deps.fetch || fetch)(CLINE_USAGE_URL, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          Origin: CLINE_API_ORIGIN,
          Referer: `${CLINE_API_ORIGIN}/`
        },
        signal
      });
      if (response.status === 401 || response.status === 403) {
        const error = new Error(`Cline returned ${response.status}`);
        error.status = 'unauthorized';
        throw error;
      }
      if (response.status === 429) {
        const error = new Error('Cline returned 429');
        error.status = 'sourceRateLimited';
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`Cline returned ${response.status}`);
        error.status = 'unavailable';
        throw error;
      }
      return response.json();
    }, { deadlineMs: Number(deps.fetchTimeoutMs || CLINE_FETCH_TIMEOUT_MS) });

    const { windows, malformed } = parseClineUsage(body);
    if (!windows.length) {
      throw Object.assign(
        new Error(malformed
          ? 'Cline returned an unparseable usage limit'
          : 'Cline returned no usage limits'),
        { status: 'unavailable' }
      );
    }
    return normalizeLimitProvider({
      provider: 'cline',
      accountKey: hashKey('cline', key),
      accountLabel: String(options.clineAccountLabel || '').trim().slice(0, 128) || 'Cline',
      source: 'api',
      status: 'ok',
      updatedAt,
      windows
    });
  } catch (error) {
    return normalizeLimitProvider({
      provider: 'cline',
      source: 'api',
      status: mapClineErrorStatus(error),
      updatedAt,
      windows: []
    });
  }
}

module.exports = {
  CLINE_FETCH_TIMEOUT_MS,
  CLINE_USAGE_URL,
  CLINE_WINDOW_TYPES,
  clineApiKey,
  fetchClineLimits,
  hasClineCredentials,
  parseClineUsage
};
