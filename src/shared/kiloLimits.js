'use strict';

/**
 * Kilo Code subscription-usage adapter.
 *
 * The provider id is `kilocode` (the Kilo Code product that sells the KiloPass
 * plan). The same subscription also funds the Kilo CLI (`kilo`), which is a
 * separate tracked client but not a separate quota: one account, one plan.
 *
 * Kilo exposes its quota through the app's own batched tRPC endpoint. Three
 * procedures are queried in ONE request (tRPC batch protocol):
 *
 *   0. user.getCreditBlocks          — prepaid credit blocks (micro-USD)
 *   1. kiloPass.getState             — subscription period usage (USD)
 *   2. user.getAutoTopUpPaymentMethod — optional; a failure here is not fatal
 *
 * Because this is an undocumented in-app endpoint (Kilo publishes no quota API)
 * the parser is intentionally tolerant: it reads the batch by index, accepts
 * camelCase and snake_case, and treats a missing optional procedure as normal.
 *
 * Auth is a Bearer token — either `KILO_API_KEY` or the token the CLI stores at
 * `~/.local/share/kilo/auth.json` under `kilo.access`. Only the pasted form is
 * usable from the Hub.
 */

const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');

const KILO_FETCH_TIMEOUT_MS = 12_000;
const KILO_TRPC_BASE = 'https://app.kilo.ai/api/trpc';
const KILO_WEB_ORIGIN = 'https://app.kilo.ai';

// Query order is part of the contract: the response is a positional batch array.
const KILO_PROCEDURES = Object.freeze([
  'user.getCreditBlocks',
  'kiloPass.getState',
  'user.getAutoTopUpPaymentMethod'
]);
// A failing optional procedure must not fail the whole read.
const KILO_OPTIONAL_PROCEDURES = Object.freeze(new Set(['user.getAutoTopUpPaymentMethod']));

// The plan tiers Kilo reports as opaque ids.
const KILO_TIERS = Object.freeze({
  tier_19: 'Starter',
  tier_49: 'Pro',
  tier_199: 'Expert'
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

function kiloApiKey(options = {}) {
  const raw = cleanSecret(options.kiloApiKey);
  if (!raw || hasControlCharacters(raw)) return '';
  return raw;
}

function hasKiloCredentials(options = {}) {
  return Boolean(kiloApiKey(options));
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function toIso(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * Build the batched tRPC URL. tRPC's httpBatchLink joins procedure names with
 * commas and passes a positional `input` map keyed by batch index.
 */
function kiloTrpcUrl(procedures = KILO_PROCEDURES) {
  const input = {};
  procedures.forEach((_, index) => { input[String(index)] = { json: null }; });
  return `${KILO_TRPC_BASE}/${procedures.join(',')}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
}

/** Extract the JSON payload of batch entry `index`, tolerating both tRPC envelopes. */
function trpcEntry(batch, index) {
  if (!Array.isArray(batch)) return null;
  const entry = batch[index];
  if (!entry || typeof entry !== 'object') return null;
  // Success is either `{result:{data:{json:...}}}` or a bare `{json:...}`.
  const result = entry.result;
  if (result && typeof result === 'object') {
    const data = result.data;
    if (data && typeof data === 'object') {
      if (data.json !== undefined) return data.json;
      return data;
    }
  }
  if (entry.json !== undefined) return entry.json;
  const error = entry.error;
  if (error && typeof error === 'object') {
    const status = numberOrNull(error?.data?.httpStatus);
    const failure = new Error(String(error?.message || 'Kilo tRPC error'));
    failure.status = status === 401 || status === 403 ? 'unauthorized' : 'unavailable';
    throw failure;
  }
  return null;
}

/**
 * Prepaid credit blocks. Kilo reports micro-USD, so amounts are divided by 1e6.
 * A zeroed/empty list is a real state (nothing prepaid), not an error.
 */
function kiloCreditWindows(creditBlocks) {
  const blocks = creditBlocks && typeof creditBlocks === 'object'
    ? (creditBlocks.creditBlocks || creditBlocks.credit_blocks)
    : null;
  if (!Array.isArray(blocks) || !blocks.length) return [];
  let remaining = 0;
  let limit = 0;
  let sawAmount = false;
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const amount = numberOrNull(block.amount_mUsd ?? block.amountMusd);
    const balance = numberOrNull(block.balance_mUsd ?? block.balanceMusd);
    if (amount !== null) { limit += amount / 1_000_000; sawAmount = true; }
    if (balance !== null) { remaining += balance / 1_000_000; sawAmount = true; }
  }
  if (!sawAmount) return [];
  const used = Math.max(0, limit - remaining);
  const hasLimit = limit > 0;
  return [{
    kind: 'billing',
    metric: 'credits',
    label: 'Credits',
    remaining: Number(remaining.toFixed(6)),
    ...(hasLimit ? { limit: Number(limit.toFixed(6)), used: Number(used.toFixed(6)) } : {}),
    currency: 'USD',
    // A prepaid pool with no recorded purchase has no denominator to meter.
    showMeter: hasLimit,
    ...(hasLimit ? { usedPercent: clampPercent((used / limit) * 100) } : {})
  }];
}

/** Subscription period window from `kiloPass.getState`. */
function kiloPassWindow(passState) {
  const subscription = passState && typeof passState === 'object'
    ? (passState.subscription || passState)
    : null;
  if (!subscription || typeof subscription !== 'object') return null;
  const used = numberOrNull(subscription.currentPeriodUsageUsd ?? subscription.current_period_usage_usd);
  const base = numberOrNull(subscription.currentPeriodBaseCreditsUsd ?? subscription.current_period_base_credits_usd);
  const bonus = numberOrNull(subscription.currentPeriodBonusCreditsUsd ?? subscription.current_period_bonus_credits_usd) ?? 0;
  if (used === null && base === null) return null;
  const limit = (base ?? 0) + bonus;
  const resetsAt = toIso(subscription.nextBillingAt ?? subscription.next_billing_at);
  const usedPercent = limit > 0 && used !== null ? clampPercent((used / limit) * 100) : null;
  const tier = typeof subscription.tier === 'string' ? subscription.tier.trim().toLowerCase() : '';
  return {
    window: {
      kind: 'billing',
      label: 'Subscription',
      ...(used !== null ? { used: Number(used.toFixed(6)) } : {}),
      ...(limit > 0 ? { limit: Number(limit.toFixed(6)) } : {}),
      ...(usedPercent !== null ? { usedPercent } : {}),
      currency: 'USD',
      showMeter: usedPercent !== null,
      ...(resetsAt ? { resetsAt } : {})
    },
    plan: KILO_TIERS[tier] || (tier ? subscription.tier : null)
  };
}

/**
 * Parse a batched tRPC response into windows and a plan label. Returns
 * `{windows, plan}`; an unreadable batch yields no windows and the caller
 * reports `unavailable`.
 */
function parseKiloUsage(batch) {
  const windows = [];
  let plan = null;
  try {
    const credits = trpcEntry(batch, 0);
    windows.push(...kiloCreditWindows(credits));
  } catch (error) {
    if (error?.status === 'unauthorized') throw error;
  }
  try {
    const pass = trpcEntry(batch, 1);
    const parsed = kiloPassWindow(pass);
    if (parsed) {
      windows.push(parsed.window);
      plan = parsed.plan;
    }
  } catch (error) {
    if (error?.status === 'unauthorized') throw error;
  }
  return { windows, plan };
}

function mapKiloErrorStatus(error) {
  const status = error && error.status;
  if (['disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error'].includes(status)) return status;
  return 'unavailable';
}

async function fetchKiloLimits(options = {}, deps = {}) {
  const nowMs = (deps.now || Date.now)();
  const updatedAt = new Date(nowMs).toISOString();
  const key = kiloApiKey(options);
  if (!key) {
    return normalizeLimitProvider({
      provider: 'kilocode',
      source: 'api',
      status: 'notConfigured',
      updatedAt,
      windows: []
    });
  }

  try {
    const batch = await runWithProbeDeadline(async ({ signal }) => {
      const response = await (deps.fetch || fetch)(kiloTrpcUrl(), {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          Origin: KILO_WEB_ORIGIN,
          Referer: `${KILO_WEB_ORIGIN}/`
        },
        signal
      });
      if (response.status === 401 || response.status === 403) {
        const error = new Error(`Kilo returned ${response.status}`);
        error.status = 'unauthorized';
        throw error;
      }
      if (response.status === 429) {
        const error = new Error('Kilo returned 429');
        error.status = 'sourceRateLimited';
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`Kilo returned ${response.status}`);
        error.status = 'unavailable';
        throw error;
      }
      return response.json();
    }, { deadlineMs: Number(deps.fetchTimeoutMs || KILO_FETCH_TIMEOUT_MS) });

    const { windows, plan } = parseKiloUsage(batch);
    if (!windows.length) {
      throw Object.assign(
        new Error('Kilo returned no recognizable credit or subscription data'),
        { status: 'unavailable' }
      );
    }
    return normalizeLimitProvider({
      provider: 'kilocode',
      accountKey: hashKey('kilocode', key),
      accountLabel: String(options.kiloAccountLabel || '').trim().slice(0, 128) || 'Kilo',
      source: 'api',
      status: 'ok',
      updatedAt,
      ...(plan ? { planLabel: plan } : {}),
      windows
    });
  } catch (error) {
    return normalizeLimitProvider({
      provider: 'kilocode',
      source: 'api',
      status: mapKiloErrorStatus(error),
      updatedAt,
      windows: []
    });
  }
}

module.exports = {
  KILO_FETCH_TIMEOUT_MS,
  KILO_OPTIONAL_PROCEDURES,
  KILO_PROCEDURES,
  KILO_TIERS,
  KILO_TRPC_BASE,
  fetchKiloLimits,
  hasKiloCredentials,
  kiloApiKey,
  kiloCreditWindows,
  kiloPassWindow,
  kiloTrpcUrl,
  parseKiloUsage
};
