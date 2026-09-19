'use strict';

const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');
const { BROWSER_USER_AGENT } = require('./browserUserAgent');

const COMMANDCODE_FETCH_TIMEOUT_MS = 12_000;
// The plan lookup only enriches the monthly window, so it gets a shorter budget
// than the credits read it runs beside: a stalled subscriptions call must not
// hold back quota numbers that already arrived.
const COMMANDCODE_SUBSCRIPTION_TIMEOUT_MS = 6_000;
const COMMANDCODE_API_BASE = 'https://api.commandcode.ai';

// TWO live routes, TWO different auth schemes. Verified 2026-09-18 by probing
// both without credentials: the 401 BODY is what tells them apart, because a
// wrong path under either prefix returns the same generic 404 shape.
//
//   /internal/billing/*  better-auth Cookie   -> "You're logged out. Please refresh and login."
//   /alpha/billing/*     Authorization Bearer -> "Invalid 'Authorization' header or token."
//
// The response bodies are otherwise the same shape, which is exactly why a
// careless switch between them would look almost right while silently reporting
// every account as unauthorized. So the two channels are kept as separate
// constants and dispatched explicitly on which credential was configured; there
// is no automatic fallback between them.
//
// The cookie channel is the original (and still the only one a pasted browser
// session can use). The Bearer channel is what the `cmd` CLI itself calls, and it
// is the better credential: an API key does not expire like a session cookie and
// does not have to survive Cloudflare. `cmd login` writes one to
// `~/.commandcode/auth.json` (`apiKey`), also readable from COMMAND_CODE_API_KEY.
const COMMANDCODE_CREDITS_URL = `${COMMANDCODE_API_BASE}/internal/billing/credits`;
const COMMANDCODE_SUBSCRIPTIONS_URL = `${COMMANDCODE_API_BASE}/internal/billing/subscriptions`;
// Bearer-authenticated siblings, read with the CLI's own headers below.
const COMMANDCODE_ALPHA_WHOAMI_URL = `${COMMANDCODE_API_BASE}/alpha/whoami`;
const COMMANDCODE_ALPHA_CREDITS_URL = `${COMMANDCODE_API_BASE}/alpha/billing/credits`;
const COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL = `${COMMANDCODE_API_BASE}/alpha/billing/subscriptions`;
const COMMANDCODE_ALPHA_SUMMARY_URL = `${COMMANDCODE_API_BASE}/alpha/usage/summary`;
const COMMANDCODE_WEB_ORIGIN = 'https://commandcode.ai';
const COMMANDCODE_USAGE_URL = `${COMMANDCODE_WEB_ORIGIN}/settings/usage`;

// Command Code namespaces its better-auth cookies under `commandcode_prod_`; the
// `__Secure-`/`__Host-` prefixes are what browsers require over HTTPS. This is
// what identifies a signed-in session — a pasted header without one is not a
// Command Code session.
//
// better-auth's own defaults (`better-auth.session_token` and its prefixed
// spellings) are deliberately NOT here, though other clients accept them as a
// fallback. That name belongs to the library, not to this provider, so any site
// built on better-auth produces a header indistinguishable from a real session —
// and a bare header carries nothing that says where it came from, so one
// mis-paste would post someone else's session to api.commandcode.ai. Production
// has been observed using the namespaced spelling, which is the condition that
// fallback was waiting on. Restore it only with a live deployment that needs it,
// and then only for a capture whose origin has been verified.
const COMMANDCODE_SESSION_COOKIE_NAMES = new Set([
  '__secure-commandcode_prod_.session_token',
  '__host-commandcode_prod_.session_token',
  'commandcode_prod_.session_token'
]);

// What actually gets sent. `session_token` is the identity; `session_data` is
// better-auth's short-lived cookie cache, kept so the API is not made to re-read
// the session on every poll. Everything else — Stripe, analytics, and the rest
// of the same namespace (`dont_remember`, `two_factor`, …) — is a credential the
// billing API has no business receiving, so this is an exact list rather than a
// namespace prefix.
const COMMANDCODE_FORWARDED_COOKIE_NAMES = new Set([
  ...COMMANDCODE_SESSION_COOKIE_NAMES,
  '__secure-commandcode_prod_.session_data',
  '__host-commandcode_prod_.session_data',
  'commandcode_prod_.session_data'
]);

// Hosts a session cookie for this provider can legitimately have been captured
// from. Deliberately the whole host and not just the billing paths: copying the
// cURL of the usage page's own document request is a perfectly good way to get
// the header, and pinning the path would reject it.
const COMMANDCODE_COOKIE_HOSTS = new Set([
  'commandcode.ai',
  'www.commandcode.ai',
  'api.commandcode.ai'
]);

function isCommandcodeAuthCookie(name) {
  return COMMANDCODE_FORWARDED_COOKIE_NAMES.has(String(name).toLowerCase());
}

// `/internal/billing/credits` reports what is *left* of the monthly grant and
// never the plan's allowance, so the denominator has to come from the plan id on
// the subscriptions read matched against the published pricing
// (https://commandcode.ai/docs/plans/*) and cross-checked against the table the
// `cmd` CLI ships (command-code 1.58.0). An unrecognized id is deliberately not
// an error: the monthly window then ships the remaining money with no meter,
// rather than a percentage derived from a guessed total.
//
// Pro exists under TWO ids because Command Code repriced it ($30 -> $80) and
// minted `individual-pro-v1` for the new price rather than migrating the old one.
// Both are live, so both must be catalogued: a single `individual-pro` entry is
// wrong for whichever cohort it was not written for. Note the CLI resolves this
// by prefix-matching (`individual-pro-v1`.startsWith(`individual-pro`)) with the
// SHORTER id first, so it reads every v1 subscriber as a $30 plan — an upstream
// ordering bug we deliberately do NOT copy. Matching stays exact here.
//
// The 5-hour and weekly caps are read off the wire; they are recorded here only
// for plans whose live payload has actually been observed, so a stale entry can
// be detected in the direction the numbers alone cannot show — see
// trustedMonthlyAllowance(). Only Go qualifies today: its $3/$6 caps came from a
// real capture, and no other plan's payload has been seen, so inventing caps for
// them would assert numbers nothing backs.
const COMMANDCODE_PLANS = Object.freeze({
  'individual-go': { label: 'Go', monthlyCreditsUsd: 10, fiveHourCapUsd: 3, weeklyCapUsd: 6 },
  'individual-goat': { label: 'GOAT', monthlyCreditsUsd: 70 },
  'individual-pro': { label: 'Pro', monthlyCreditsUsd: 30 },
  'individual-pro-v1': { label: 'Pro', monthlyCreditsUsd: 80 },
  'individual-provider': { label: 'Provider', monthlyCreditsUsd: 15 },
  'individual-max': { label: 'Max', monthlyCreditsUsd: 150 },
  'individual-ultra': { label: 'Ultra', monthlyCreditsUsd: 300 },
  'teams-pro': { label: 'Teams Pro', monthlyCreditsUsd: 40 }
});

function cleanSecret(value) {
  if (typeof value !== 'string') return '';
  let raw = value.trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}

// A cookie value may not carry control characters; a pasted header that does is
// a mangled copy rather than a session, and forwarding it would build an
// invalid request header.
function hasControlCharacters(text) {
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function cookiePairs(value) {
  let header = cleanSecret(value);
  if (/^cookie\s*:/i.test(header)) header = header.replace(/^cookie\s*:/i, '').trim();
  if (!header) return [];
  return header.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return null;
    const name = part.slice(0, separator).trim();
    const cookieValue = part.slice(separator + 1).trim();
    const validName = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name);
    const validValue = Boolean(cookieValue) && !hasControlCharacters(cookieValue);
    return validName && validValue ? { name, value: cookieValue } : null;
  }).filter(Boolean);
}

function looksLikeCurlCapture(raw) {
  return /^curl(\.exe)?\s/i.test(raw.trimStart());
}

// DevTools' "Copy as cURL" is the only paste that already carries the exact
// header the browser sent, so accept it rather than making someone pick the
// Cookie line out of it by hand. The instructions still ask for the header
// itself; this is here so the shortcut does not fail silently. Values arrive
// single-quoted, double-quoted, ANSI-C quoted ($'...'), or bare.
const CURL_HEADER_ARGUMENT = /(?:^|\s)(-H|--header|-b|--cookie)(?:\s+|=)\$?(?:'([^']*)'|"((?:[^"\\]|\\.)*)"|(\S+))/g;

// The request URL is the first argument whose value *starts* with a scheme —
// header values that mention one (`referer: https://…`) never do, so this picks
// the captured request rather than something quoted inside it.
const CURL_TOKEN = /'([^']*)'|"((?:[^"\\]|\\.)*)"|(\S+)/g;

function curlRequestUrl(raw) {
  for (const match of raw.matchAll(CURL_TOKEN)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (!/^https?:\/\//i.test(value || '')) continue;
    try { return new URL(value); } catch (_) { return null; }
  }
  return null;
}

function cookieHeaderFromCurl(raw) {
  // A capture carries the origin its cookies belong to, so use it: without this
  // a cURL copied from any other site would have its session forwarded here.
  const requestUrl = curlRequestUrl(raw);
  if (!requestUrl || !COMMANDCODE_COOKIE_HOSTS.has(requestUrl.hostname.toLowerCase())) return '';
  for (const match of raw.matchAll(CURL_HEADER_ARGUMENT)) {
    const [, flag, single, double, bare] = match;
    // Only a double-quoted shell word carries escapes; inside single quotes a
    // backslash is literal and must survive into the cookie value.
    const value = single ?? (double === undefined ? bare : double.replace(/\\(.)/g, '$1'));
    if (!value) continue;
    if (flag === '-b' || flag === '--cookie') return value.trim();
    const separator = value.indexOf(':');
    if (separator <= 0) continue;
    if (value.slice(0, separator).trim().toLowerCase() !== 'cookie') continue;
    const header = value.slice(separator + 1).trim();
    if (header) return header;
  }
  // A cURL capture with no Cookie header is a capture of the wrong request.
  // Returning it whole would parse the command line itself as cookie pairs.
  return '';
}

// Keeps the two cookies the billing API needs and drops everything else.
function normalizeCommandcodeCookieHeader(rawCookie) {
  const raw = cleanSecret(rawCookie);
  const pairs = cookiePairs(looksLikeCurlCapture(raw) ? cookieHeaderFromCurl(raw) : raw);
  if (!pairs.some((pair) => COMMANDCODE_SESSION_COOKIE_NAMES.has(pair.name.toLowerCase()))) return '';
  return pairs
    .filter((pair) => isCommandcodeAuthCookie(pair.name))
    .map((pair) => `${pair.name}=${pair.value}`)
    .join('; ');
}

// Identity for the account, in preference order. The subscription carries a
// stable account id, which is what `accountKey` is contractually for — it
// survives a re-pasted cookie and matches across devices. Without it, fall back
// to the session token alone: it is at least the credential's identity half, and
// `session_data` is a short-lived cache that would otherwise churn the key on
// its own schedule. The key can therefore change if the optional subscription
// read fails; that is tolerable because this provider collapses by name during
// aggregation, and subscription binding heals through its own ladder.
function commandcodeAccountSeed(cookieHeader) {
  const session = cookiePairs(cookieHeader)
    .find((pair) => COMMANDCODE_SESSION_COOKIE_NAMES.has(pair.name.toLowerCase()));
  return session ? session.value : cookieHeader;
}

function commandcodeCookie(env = process.env, options = {}) {
  const explicit = normalizeCommandcodeCookieHeader(options.commandcodeCookie);
  if (explicit) return explicit;
  for (const name of ['COMMANDCODE_COOKIE', 'TOKEN_MONITOR_COMMANDCODE_COOKIE']) {
    const header = normalizeCommandcodeCookieHeader(env[name]);
    if (header) return header;
  }
  return '';
}

// The CLI's API key. `cmd login` mints one per terminal into
// `~/.commandcode/auth.json`; the CLI also reads COMMAND_CODE_API_KEY first.
const COMMANDCODE_API_KEY_ENV_NAMES = ['COMMAND_CODE_API_KEY', 'COMMANDCODE_API_KEY'];
// Keys are `cmd_`-prefixed (the CLI validates /^cmd/). Anything else is far more
// likely to be a mis-pasted cookie or token from another provider, and sending it
// as a Bearer to api.commandcode.ai is exactly the kind of leak the cookie
// normalizer above exists to prevent.
const COMMANDCODE_API_KEY_PATTERN = /^cmd_[A-Za-z0-9_-]{8,}$/;

function normalizeCommandcodeApiKey(rawKey) {
  const raw = cleanSecret(rawKey);
  if (!raw) return '';
  return COMMANDCODE_API_KEY_PATTERN.test(raw) ? raw : '';
}

function commandcodeApiKey(env = process.env, options = {}) {
  const explicit = normalizeCommandcodeApiKey(options.commandcodeApiKey);
  if (explicit) return explicit;
  for (const name of COMMANDCODE_API_KEY_ENV_NAMES) {
    const key = normalizeCommandcodeApiKey(env[name]);
    if (key) return key;
  }
  return '';
}

function hasCommandcodeCredentials(options = {}, env = process.env) {
  return Boolean(commandcodeApiKey(env, options) || commandcodeCookie(env, options));
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIso(value) {
  const numeric = numberOrNull(value);
  if (numeric !== null) {
    if (numeric <= 0) return null;
    // The API mixes seconds and milliseconds, and both spellings arrive as
    // strings often enough that sniffing the magnitude is the only safe read.
    const date = new Date(numeric > 20_000_000_000 ? numeric : numeric * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function planFor(planId) {
  const id = String(planId || '').trim().toLowerCase();
  return COMMANDCODE_PLANS[id] || null;
}

function rollingWindow(kind, raw, windowMinutes) {
  if (!raw || typeof raw !== 'object') return null;
  const limit = numberOrNull(raw.cap ?? raw.limit);
  if (limit === null || limit <= 0) return null;
  const used = Math.max(0, numberOrNull(raw.used) ?? 0);
  return {
    kind,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    usedPercent: clampPercent((used / limit) * 100),
    resetsAt: toIso(raw.resetAt ?? raw.reset_at),
    windowMinutes,
    showMeter: true
  };
}

// The rolling limits moved from the response root into `credits` at some point,
// and both shapes are live in the wild, so read either.
function parseCommandcodeCredits(body) {
  const credits = body?.credits;
  if (!credits || typeof credits !== 'object') throw new Error('missing credits object');
  const monthlyRemaining = numberOrNull(credits.monthlyCredits ?? credits.monthly_credits);
  if (monthlyRemaining === null) throw new Error('missing monthlyCredits');
  const windowLimits = (credits.windowLimits ?? credits.window_limits)
    || (body?.windowLimits ?? body?.window_limits)
    || null;
  return {
    monthlyRemaining,
    // `premiumMonthlyCredits` / `opensourceMonthlyCredits` split the same
    // remaining grant into two buckets (they sum to monthlyCredits), so neither
    // is a total and treating one as a denominator inverts the meter.
    purchasedCredits: Math.max(0, numberOrNull(credits.purchasedCredits ?? credits.purchased_credits) ?? 0),
    // `usagePercent` is the VENDOR's own figure for the plan grant. When present
    // it is authoritative: it needs no catalogued denominator, which is what
    // makes the plan table below only a fallback rather than the primary source.
    usagePercent: (() => {
      const raw = numberOrNull(credits.usagePercent ?? credits.usage_percent);
      return raw === null ? null : clampPercent(raw);
    })(),
    // The `*Remaining` spellings are what the dashboard reads; `*Credits` is what
    // the CLI's own view uses. They describe the same two pools.
    purchasedRemaining: Math.max(0, numberOrNull(credits.purchasedRemaining ?? credits.purchased_remaining) ?? 0),
    freeRemaining: Math.max(0, numberOrNull(credits.freeRemaining ?? credits.free_remaining) ?? 0),
    freeCredits: Math.max(0, numberOrNull(credits.freeCredits ?? credits.free_credits) ?? 0),
    hasCreditsInfo: credits.hasCreditsInfo === true || credits.has_credits_info === true,
    planId: String(credits.planId ?? credits.plan_id ?? '').trim(),
    fiveHour: rollingWindow('session', windowLimits?.fiveHour ?? windowLimits?.five_hour, 5 * 60),
    weekly: rollingWindow('weekly', windowLimits?.weekly, 7 * 24 * 60)
  };
}

// Only an explicit `{"success":true,"data":null}` identifies the free tier. A
// failure envelope is transient and must not be read as "no subscription", or a
// paying account loses its plan denominator on a hiccup.
//
// The Bearer channel omits the `success` wrapper entirely: the plan id sits at
// `body.data.planId` with no success flag beside it (the CLI reads it as
// `result.data.data.planId`, where its own `result.data` is this HTTP body). A
// free account there is an absent inner object rather than a `null` under
// `success` — accept that only when no `success` flag at all is present, so a
// FAILED cookie-channel envelope still cannot masquerade as the free tier.
function parseCommandcodeSubscription(body) {
  if (!body || typeof body !== 'object') throw new Error('invalid subscriptions response');
  if (body.success !== true) {
    if ('success' in body) throw new Error('unsuccessful subscriptions response');
    const inner = body.data;
    if (inner && typeof inner === 'object') body = { success: true, data: inner };
    else if (inner === undefined || inner === null) return null;
    else throw new Error('invalid subscriptions data');
  }
  if (!('data' in body)) throw new Error('missing subscriptions data');
  if (body.data === null) return null;
  if (typeof body.data !== 'object') throw new Error('invalid subscriptions data');
  const planId = String(body.data.planId ?? body.data.plan_id ?? '').trim();
  if (!planId) throw new Error('missing planId');
  return {
    planId,
    // Prefer the account over the subscription: a cancel-and-resubscribe issues
    // a new `id` to the same person, so `id` is the last resort before falling
    // back to the credential. A live payload carries the user id twice, under
    // `userId` and again in `metadata`; the rest of the ladder is for shapes
    // that carry only one of them.
    accountId: String(
      body.data.userId
      ?? body.data.user_id
      ?? body.data.metadata?.commandCodeUserId
      ?? body.data.id
      ?? ''
    ).trim(),
    status: String(body.data.status || '').trim().toLowerCase(),
    currentPeriodEnd: toIso(body.data.currentPeriodEnd ?? body.data.current_period_end),
    // The billing period's start is the `since` anchor for the usage summary; the
    // CLI reads it off the subscription rather than the credits payload.
    currentPeriodStart: toIso(body.data.currentPeriodStart ?? body.data.current_period_start)
  };
}

function errorWithStatus(status, message) {
  const error = new Error(message || status);
  error.status = status;
  return error;
}

function requestHeaders(cookie) {
  return {
    Cookie: cookie,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': BROWSER_USER_AGENT,
    Origin: COMMANDCODE_WEB_ORIGIN,
    Referer: `${COMMANDCODE_WEB_ORIGIN}/`
  };
}

// The CLI's own header set, reproduced so the Bearer channel is indistinguishable
// from a real `cmd` call. `x-cli-environment` is normalized from `prod` to
// `production` upstream, and the version header is required by the API's
// freshness gate — a request without it is rejected as an unknown client.
const COMMANDCODE_CLI_VERSION = '1.58.0';
const COMMANDCODE_CLI_ENVIRONMENT = 'production';

function alphaHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'cli',
    'x-cli-environment': COMMANDCODE_CLI_ENVIRONMENT,
    'x-command-code-version': COMMANDCODE_CLI_VERSION
  };
}

async function fetchJson(url, cookie, deadlineMs, deps, parentSignal = deps.signal) {
  return runWithProbeDeadline(
    async ({ signal }) => {
      const response = await (deps.fetch || fetch)(url, { headers: requestHeaders(cookie), signal });
      if (response.status === 401 || response.status === 403) {
        throw errorWithStatus('unauthorized', `Command Code ${url} returned ${response.status}`);
      }
      if (response.status === 429) {
        throw errorWithStatus('sourceRateLimited', `Command Code ${url} returned 429`);
      }
      if (!response.ok) {
        throw errorWithStatus('unavailable', `Command Code ${url} returned ${response.status}`);
      }
      return response.json();
    },
    { signal: parentSignal, deadlineMs }
  );
}

async function fetchAlphaJson(url, apiKey, deadlineMs, deps, parentSignal = deps.signal) {
  return runWithProbeDeadline(
    async ({ signal }) => {
      const response = await (deps.fetch || fetch)(url, { headers: alphaHeaders(apiKey), signal });
      if (response.status === 401 || response.status === 403) {
        throw errorWithStatus('unauthorized', `Command Code ${url} returned ${response.status}`);
      }
      if (response.status === 429) {
        throw errorWithStatus('sourceRateLimited', `Command Code ${url} returned 429`);
      }
      if (!response.ok) {
        throw errorWithStatus('unavailable', `Command Code ${url} returned ${response.status}`);
      }
      return response.json();
    },
    { signal: parentSignal, deadlineMs }
  );
}

/** Append `?orgId=` only when an org is known; the API treats it as optional. */
function withOrgId(url, orgId, extra = {}) {
  const params = new URLSearchParams();
  if (orgId) params.set('orgId', orgId);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

/**
 * The Bearer channel resolves the org first, because credits and subscriptions
 * are both org-scoped. `whoami` also returns `orgLimits` (org-wide spend caps),
 * which the cookie channel cannot see.
 */
function parseCommandcodeWhoami(body) {
  const data = body && typeof body === 'object' ? (body.data ?? body) : null;
  if (!data || typeof data !== 'object') return { orgId: '', orgLogin: '', userName: '', orgLimits: [] };
  return {
    orgId: String(data.org?.id ?? data.org?.orgId ?? '').trim(),
    orgLogin: String(data.org?.login ?? data.org?.name ?? '').trim(),
    userName: String(data.user?.userName ?? data.user?.name ?? '').trim(),
    orgLimits: Array.isArray(data.orgLimits) ? data.orgLimits : []
  };
}

// The plan allowance is the one number here that is not read off the wire, so it
// can go stale silently. The wire has to corroborate it before it becomes a
// denominator: the published 5-hour and weekly caps must be exactly the ones
// this account reports, and the remaining grant must fit inside the allowance.
// Anything else ships the money with no meter.
//
// The caps are only checked for the entries that RECORD them. The `cmd` CLI's own
// table publishes just the monthly amount, so caps exist here only for the plans
// whose live payload has been seen (Go, GOAT); requiring them universally would
// make every other entry unusable. Where they are present they are the only
// signal that catches a catalogued grant which has gone UP — nothing about a
// remaining balance contradicts a total that is too large — so they stay checked
// in exactly the cases with evidence behind them.
//
// What this does not do is establish what `monthlyCredits` MEANS on a plan whose
// payload nobody here has seen. It pins a catalogue entry to the plan it was
// copied from and catches repricing; it cannot detect a plan that reports its
// grant in some other unit while still publishing familiar caps.
//
// This whole path is now the FALLBACK: when the API reports `usagePercent`, the
// vendor's measured figure is used and this function is not consulted at all.
function trustedMonthlyAllowance(plan, { monthlyRemaining, fiveHourCap, weeklyCap }) {
  const allowance = plan?.monthlyCreditsUsd ?? null;
  if (allowance === null || allowance <= 0) return null;
  if (monthlyRemaining > allowance) return null;
  if (plan.fiveHourCapUsd === undefined || plan.weeklyCapUsd === undefined) return allowance;
  if (fiveHourCap === null || weeklyCap === null) return null;
  if (fiveHourCap !== plan.fiveHourCapUsd) return null;
  if (weeklyCap !== plan.weeklyCapUsd) return null;
  return allowance;
}

// Monthly grant and rollover top-ups are separate pools with separate lifetimes:
// the grant resets with the billing cycle, top-ups never expire. They ship as
// two `credits` windows so an exhausted grant cannot read as "out of money"
// while purchased credits are still funding requests.
//
// The meter has TWO possible denominators, in preference order:
//   1. `usagePercent`, the vendor's own figure — authoritative, and needs no
//      catalogue entry, so it works on plans this repo has never seen.
//   2. `limit`, the catalogued allowance, which trustedMonthlyAllowance() has
//      already corroborated against the wire.
// When neither is available the window still ships the remaining money, just
// without a meter — an empty bar would read as an exhausted grant.
function billingWindows({ monthlyRemaining, purchasedCredits, limit, usagePercent, topUpRemaining, periodEnd }) {
  const hasVendorPercent = usagePercent !== null && usagePercent !== undefined;
  const windows = [{
    kind: 'billing',
    metric: 'credits',
    label: 'Monthly',
    remaining: monthlyRemaining,
    ...(limit ? { limit, used: Math.max(0, Math.min(limit, limit - monthlyRemaining)) } : {}),
    ...(hasVendorPercent ? { usedPercent: usagePercent } : {}),
    currency: 'USD',
    resetsAt: periodEnd,
    showMeter: hasVendorPercent || Boolean(limit),
    ...(hasVendorPercent && !limit ? { detail: 'reported by Command Code' } : {})
  }];
  // Prefer the dedicated top-up remaining when the wire carries it; fall back to
  // the purchased-credits total for shapes that only publish that.
  const rollover = Math.max(0, topUpRemaining ?? 0) || purchasedCredits;
  if (rollover > 0) {
    windows.push({
      kind: 'billing',
      metric: 'credits',
      label: 'Top-up',
      remaining: rollover,
      currency: 'USD',
      showMeter: false
    });
  }
  return windows;
}

// Org-wide spend caps from `whoami`'s `orgLimits`. Only the Bearer channel
// reports these, and their shape is undocumented, so each entry is read
// defensively and one unreadable entry is skipped rather than blanking the rest.
function orgLimitWindows(orgLimits) {
  if (!Array.isArray(orgLimits)) return [];
  const windows = [];
  for (const entry of orgLimits) {
    if (!entry || typeof entry !== 'object') continue;
    const limit = numberOrNull(entry.limit ?? entry.cap ?? entry.amount);
    const used = numberOrNull(entry.used ?? entry.spent ?? entry.usage);
    if (limit === null || limit <= 0) continue;
    const usedValue = Math.max(0, used ?? 0);
    windows.push({
      kind: 'billing',
      metric: 'spend',
      label: String(entry.label ?? entry.name ?? entry.period ?? 'Org limit').trim() || 'Org limit',
      limit,
      used: usedValue,
      remaining: Math.max(0, limit - usedValue),
      usedPercent: clampPercent((usedValue / limit) * 100),
      currency: String(entry.currency || 'USD').trim().toUpperCase() || 'USD',
      resetsAt: toIso(entry.resetAt ?? entry.reset_at ?? entry.resetsAt ?? entry.periodEnd),
      showMeter: true
    });
  }
  return windows;
}

// Period spend from `/alpha/usage/summary`. The documented field is `totalCost`;
// it is a dollar figure for the billing period, not a quota, so it ships without
// a meter. One unreadable payload yields no window rather than a zeroed one — a
// `$0.00` row would claim the account has spent nothing.
function spendWindows(summary) {
  const body = summary && typeof summary === 'object' ? (summary.data ?? summary) : null;
  if (!body || typeof body !== 'object') return [];
  const total = numberOrNull(body.totalCost ?? body.total_cost);
  if (total === null || total < 0) return [];
  return [{
    kind: 'billing',
    metric: 'spend',
    label: 'Period spend',
    remaining: total,
    currency: 'USD',
    showMeter: false
  }];
}

// Pick the catalogued denominator, but only when the vendor did not report a
// percentage. Mixing the two would pair a measured `usedPercent` with a
// catalogued `limit` that may describe a different price cohort, so the meter
// and its tooltip could disagree; when `usagePercent` exists the catalogue is
// not consulted at all.
function resolveCommandcodeMonthlyLimit(plan, credits) {
  if (credits.usagePercent !== null && credits.usagePercent !== undefined) return null;
  return trustedMonthlyAllowance(plan, {
    monthlyRemaining: credits.monthlyRemaining,
    fiveHourCap: credits.fiveHour?.limit ?? null,
    weeklyCap: credits.weekly?.limit ?? null
  });
}

function notConfigured(updatedAt) {
  return normalizeLimitProvider({
    provider: 'commandcode',
    source: 'web',
    status: 'notConfigured',
    updatedAt,
    windows: []
  });
}

function commandcodeFailure(error, updatedAt, source) {
  return normalizeLimitProvider({
    provider: 'commandcode',
    source,
    status: error?.status === 'timeout' ? 'unavailable' : (error?.status || 'unavailable'),
    updatedAt,
    windows: []
  });
}

/**
 * Cookie channel: `/internal/billing/*` with the better-auth session.
 *
 * The plan lookup is optional enrichment, so it runs beside the credits read
 * with its own abort and resolves to null on failure: a stalled or 401
 * subscriptions call must not hold back quota numbers that already arrived, nor
 * make a credits failure wait out the enrichment deadline for an answer it is
 * about to discard.
 */
async function fetchCommandcodeViaCookie(cookie, updatedAt, deps) {
  const creditsDeadline = Number(deps.commandcodeFetchTimeoutMs || deps.fetchTimeoutMs || COMMANDCODE_FETCH_TIMEOUT_MS);
  const subscriptionDeadline = Math.min(
    creditsDeadline,
    Number(deps.commandcodeSubscriptionTimeoutMs || COMMANDCODE_SUBSCRIPTION_TIMEOUT_MS)
  );
  const subscriptionAbort = typeof AbortController === 'undefined' ? null : new AbortController();
  const subscriptionSignals = [deps.signal, subscriptionAbort?.signal].filter(Boolean);
  const creditsRequest = fetchJson(COMMANDCODE_CREDITS_URL, cookie, creditsDeadline, deps);
  const subscriptionRequest = fetchJson(
    COMMANDCODE_SUBSCRIPTIONS_URL,
    cookie,
    subscriptionDeadline,
    deps,
    subscriptionSignals.length > 1 ? AbortSignal.any(subscriptionSignals) : subscriptionSignals[0]
  )
    .then(parseCommandcodeSubscription)
    .catch(() => null);

  try {
    const [creditsBody, subscription] = await Promise.all([creditsRequest, subscriptionRequest]);
    const credits = parseCommandcodeCredits(creditsBody);
    const plan = planFor(subscription?.planId);
    const windows = [
      credits.fiveHour,
      credits.weekly,
      ...billingWindows({
        monthlyRemaining: credits.monthlyRemaining,
        purchasedCredits: credits.purchasedCredits,
        topUpRemaining: credits.purchasedRemaining,
        usagePercent: credits.usagePercent,
        limit: resolveCommandcodeMonthlyLimit(plan, credits),
        periodEnd: subscription?.currentPeriodEnd || null
      })
    ].filter(Boolean);
    return normalizeLimitProvider({
      provider: 'commandcode',
      accountKey: hashKey('commandcode', subscription?.accountId || commandcodeAccountSeed(cookie)),
      accountLabel: plan?.label || '',
      source: 'web',
      status: 'ok',
      updatedAt,
      windows
    });
  } catch (error) {
    // Anything landing here came from the credits call or from parsing it — the
    // optional read swallows its own failures. Cancel it rather than awaiting
    // it: its result is unusable now, and it already handles its own rejection.
    subscriptionAbort?.abort();
    return commandcodeFailure(error, updatedAt, 'web');
  }
}

/**
 * API-key channel: exactly what the `cmd` CLI calls.
 *
 * `whoami` runs first because both billing reads are org-scoped and because it
 * also carries the org-wide spend caps the cookie channel cannot see. The two
 * billing reads then run together, and the period summary is enrichment in the
 * same spirit as the cookie channel's plan lookup.
 */
async function fetchCommandcodeViaApiKey(apiKey, updatedAt, deps) {
  const deadline = Number(deps.commandcodeFetchTimeoutMs || deps.fetchTimeoutMs || COMMANDCODE_FETCH_TIMEOUT_MS);
  const enrichmentDeadline = Math.min(
    deadline,
    Number(deps.commandcodeSubscriptionTimeoutMs || COMMANDCODE_SUBSCRIPTION_TIMEOUT_MS)
  );

  const enrichmentAbort = typeof AbortController === 'undefined' ? null : new AbortController();
  const enrichmentSignals = [deps.signal, enrichmentAbort?.signal].filter(Boolean);
  const enrichmentSignal = enrichmentSignals.length > 1
    ? AbortSignal.any(enrichmentSignals)
    : enrichmentSignals[0];

  try {
    // whoami is inside the try because it is the first call that can reject: a
    // bad key must surface as `unauthorized`, not escape as an unhandled
    // rejection. It is required (unlike the enrichment reads below) because both
    // billing paths are org-scoped.
    const identity = parseCommandcodeWhoami(
      // `limits=1` is what asks the API to include `orgLimits`; without it whoami
      // answers without the org spend caps and those silently never appear.
      await fetchAlphaJson(withOrgId(COMMANDCODE_ALPHA_WHOAMI_URL, null, { limits: '1' }), apiKey, deadline, deps)
    );

    const creditsRequest = fetchAlphaJson(
      withOrgId(COMMANDCODE_ALPHA_CREDITS_URL, identity.orgId),
      apiKey,
      deadline,
      deps
    );
    const subscriptionRequest = fetchAlphaJson(
      withOrgId(COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL, identity.orgId),
      apiKey,
      enrichmentDeadline,
      deps,
      enrichmentSignal
    )
      .then(parseCommandcodeSubscription)
      .catch(() => null);

    const [creditsBody, subscription] = await Promise.all([creditsRequest, subscriptionRequest]);
    const credits = parseCommandcodeCredits(creditsBody);
    // The CLI's own view resolves the plan from the credits payload too, so an
    // unreadable subscription still yields a label.
    const plan = planFor(subscription?.planId || credits.planId);
    // Period spend is pure enrichment: it is reported as its own window when it
    // arrives, and its absence costs nothing else. It is anchored on the billing
    // period start, which only the subscription knows.
    const summary = await fetchAlphaJson(
      withOrgId(COMMANDCODE_ALPHA_SUMMARY_URL, identity.orgId, {
        since: subscription?.currentPeriodStart || null
      }),
      apiKey,
      enrichmentDeadline,
      deps,
      enrichmentSignal
    ).catch(() => null);
    const windows = [
      credits.fiveHour,
      credits.weekly,
      ...billingWindows({
        monthlyRemaining: credits.monthlyRemaining,
        purchasedCredits: credits.purchasedCredits,
        topUpRemaining: credits.purchasedRemaining,
        usagePercent: credits.usagePercent,
        limit: resolveCommandcodeMonthlyLimit(plan, credits),
        periodEnd: subscription?.currentPeriodEnd || null
      }),
      ...orgLimitWindows(identity.orgLimits),
      ...spendWindows(summary)
    ].filter(Boolean);
    return normalizeLimitProvider({
      provider: 'commandcode',
      // The org id is stable across key rotation, which is what `accountKey` is
      // for; the key itself is only the last resort.
      accountKey: hashKey('commandcode', identity.orgId || subscription?.accountId || apiKey),
      accountLabel: plan?.label || '',
      accountName: identity.orgLogin || identity.userName || '',
      source: 'api',
      status: 'ok',
      updatedAt,
      windows
    });
  } catch (error) {
    enrichmentAbort?.abort();
    return commandcodeFailure(error, updatedAt, 'api');
  }
}

async function fetchCommandcodeLimits(options = {}, deps = {}) {
  const env = deps.env || process.env;
  const now = (deps.now || Date.now)();
  const updatedAt = new Date(now).toISOString();

  // Explicit dispatch on which credential is configured, with NO automatic
  // fallback: the two channels speak different auth schemes, so retrying the
  // other one would report "key rejected" as "session expired" (or the reverse)
  // and hide the one fact the user needs. A project that somehow has both sends
  // only the key, which is the credential we want people to migrate to.
  const apiKey = commandcodeApiKey(env, options);
  if (apiKey) return fetchCommandcodeViaApiKey(apiKey, updatedAt, deps);

  const cookie = commandcodeCookie(env, options);
  if (cookie) return fetchCommandcodeViaCookie(cookie, updatedAt, deps);

  return notConfigured(updatedAt);
}

module.exports = {
  COMMANDCODE_ALPHA_CREDITS_URL,
  COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL,
  COMMANDCODE_ALPHA_SUMMARY_URL,
  COMMANDCODE_ALPHA_WHOAMI_URL,
  COMMANDCODE_API_KEY_PATTERN,
  COMMANDCODE_CLI_ENVIRONMENT,
  COMMANDCODE_CLI_VERSION,
  COMMANDCODE_CREDITS_URL,
  COMMANDCODE_FORWARDED_COOKIE_NAMES,
  COMMANDCODE_FETCH_TIMEOUT_MS,
  COMMANDCODE_PLANS,
  COMMANDCODE_SESSION_COOKIE_NAMES,
  COMMANDCODE_SUBSCRIPTIONS_URL,
  COMMANDCODE_USAGE_URL,
  alphaHeaders,
  billingWindows,
  commandcodeApiKey,
  commandcodeCookie,
  fetchCommandcodeLimits,
  hasCommandcodeCredentials,
  normalizeCommandcodeApiKey,
  normalizeCommandcodeCookieHeader,
  orgLimitWindows,
  parseCommandcodeCredits,
  parseCommandcodeSubscription,
  parseCommandcodeWhoami,
  planFor,
  spendWindows,
  withOrgId
};
