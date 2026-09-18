'use strict';

/**
 * Sakana (Fugu) subscription-usage adapter.
 *
 * Sakana publishes no usage API. The only surface is the authenticated billing
 * console at https://console.sakana.ai/billing, so this adapter fetches that page
 * with the user's session cookie and scrapes the quota windows out of the HTML —
 * the same approach tokscale takes (crates/tokscale-cli/src/commands/usage/
 * sakana.rs).
 *
 * This is knowingly a LAYOUT-COUPLED, best-effort scraper. Two consequences are
 * designed in rather than papered over:
 *
 *  1. The page embeds each usage figure more than once (rendered card markup plus
 *     serialized RSC data), so a global "collect every percent, pair by index"
 *     scan invents phantom windows. Windows are therefore anchored on the visible
 *     window labels (`>5-hour<` / `>Weekly<`) and each percentage is bound to the
 *     section between its own label and the next one.
 *  2. A parse that finds no window is reported as `unauthorized` rather than an
 *     empty success, because the realistic causes are an expired cookie or a
 *     logged-out shell. That keeps a stale session visible in the UI instead of
 *     rendering a silently blank card.
 *
 * Credentials: an explicit cookie option/env var wins; otherwise read
 * `<config dir>/sakana-session` (a raw cookie string), matching upstream's order.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');
const { BROWSER_USER_AGENT } = require('./browserUserAgent');

const SAKANA_FETCH_TIMEOUT_MS = 15_000;
const SAKANA_BILLING_URL = 'https://console.sakana.ai/billing';
const SAKANA_WEB_ORIGIN = 'https://console.sakana.ai';
const SAKANA_WINDOW_MINUTES = { '5-hour': 5 * 60, Weekly: 7 * 24 * 60 };
// Upstream pins a desktop Chrome UA for this console; the shared browser UA is
// the same shape and keeps one definition for every cookie-authenticated probe.
const SAKANA_USER_AGENT = BROWSER_USER_AGENT;

function sakanaSessionPath(options = {}) {
  const home = options.homeDir || os.homedir();
  const configDir = String(options.configDir || process.env.TOKSCALE_CONFIG_DIR || '').trim()
    || path.join(home, '.config', 'tokscale');
  return path.join(configDir, 'sakana-session');
}

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

/**
 * Resolve the Sakana session cookie. A cookie header is forwarded verbatim (the
 * console expects the same `name=value; name=value` string a browser sends), so
 * control characters mark a mangled paste rather than a session.
 */
function sakanaSessionCookie(options = {}, deps = {}) {
  const env = deps.env || process.env;
  const explicit = cleanSecret(options.sakanaSessionCookie || env.SAKANA_SESSION_COOKIE);
  const candidate = explicit || (() => {
    const readFileSync = deps.readFileSync || fs.readFileSync;
    try {
      return cleanSecret(readFileSync(sakanaSessionPath(options), 'utf8'));
    } catch (_) {
      return '';
    }
  })();
  if (!candidate || hasControlCharacters(candidate)) return '';
  // Require at least one `name=value` pair so a stray word is not sent as a cookie.
  return candidate.includes('=') ? candidate : '';
}

function hasSakanaCredentials(options = {}, deps = {}) {
  return Boolean(sakanaSessionCookie(options, deps));
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function findWindowLabelPositions(html) {
  const labels = ['5-hour', 'Weekly'];
  const found = [];
  for (const label of labels) {
    const needle = `>${label}<`;
    let from = 0;
    for (;;) {
      const rel = html.indexOf(needle, from);
      if (rel < 0) break;
      found.push({ index: rel, label });
      from = rel + needle.length;
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

// `NN.N% used` -> percentages in document order, one per occurrence.
function findUsedPercents(html) {
  const needle = '% used';
  const out = [];
  let from = 0;
  for (;;) {
    const rel = html.indexOf(needle, from);
    if (rel < 0) break;
    // Walk backwards over the numeric run that precedes the needle.
    let cursor = rel - 1;
    while (cursor >= 0 && /[0-9.]/.test(html[cursor])) cursor -= 1;
    const token = html.slice(cursor + 1, rel);
    const value = Number(token);
    if (token && Number.isFinite(value)) out.push(clampPercent(value));
    from = rel + needle.length;
  }
  return out;
}

// `Resets on <Month D, YYYY at H:MM AM>` -> ISO strings.
function findResetTimes(html) {
  const out = [];
  let from = 0;
  for (;;) {
    const rel = html.indexOf('Resets on', from);
    if (rel < 0) break;
    const after = html.slice(rel + 'Resets on'.length).replace(/^[\s\u00a0]+/, '');
    const match = after.match(/^([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)/);
    if (match) {
      const parsed = Date.parse(`${match[1]} ${match[2]}, ${match[3]} ${match[4]}:${match[5]} ${match[6]}`);
      if (!Number.isNaN(parsed)) out.push(new Date(parsed).toISOString());
    }
    from = rel + 'Resets on'.length;
  }
  return out;
}

function normalizeSakanaLabel(label) {
  return label === 'Weekly' ? 'Weekly' : '5-hour';
}

// The shared limits schema accepts only session | weekly | billing | named |
// credits, so Sakana's two quota windows map onto the rolling cadences — the
// same way Command Code and MiniMax express their 5-hour and weekly caps.
function sakanaWindowKind(label) {
  return label === 'Weekly' ? 'weekly' : 'session';
}

/**
 * Parse the billing page into windows. Mirrors upstream's structure: anchor on
 * the visible window labels and bind each percentage to its own section, with a
 * bounded label-less fallback so a markup change still surfaces something.
 */
function parseSakanaBillingHtml(html) {
  const source = typeof html === 'string' ? html : '';
  const labels = findWindowLabelPositions(source);
  if (labels.length > 0) {
    const windows = [];
    for (let index = 0; index < labels.length; index += 1) {
      const { index: start, label } = labels[index];
      const end = index + 1 < labels.length ? labels[index + 1].index : source.length;
      const segment = source.slice(start, end);
      const percents = findUsedPercents(segment);
      if (!percents.length) continue;
      const used = percents[0];
      const resetsAt = findResetTimes(segment)[0] || null;
      const normalized = normalizeSakanaLabel(label);
      const windowMinutes = SAKANA_WINDOW_MINUTES[normalized];
      windows.push({
        kind: sakanaWindowKind(normalized),
        label: normalized,
        usedPercent: used,
        ...(windowMinutes ? { windowMinutes } : {}),
        ...(resetsAt ? { resetsAt } : {}),
        showMeter: true
      });
    }
    return windows;
  }

  // Degraded fallback: no labels, so pair the leading percentages with the known
  // window names in order rather than inventing extra windows.
  const fallback = ['5-hour', 'Weekly'];
  return findUsedPercents(source).slice(0, fallback.length).map((used, index) => ({
    kind: sakanaWindowKind(fallback[index]),
    label: fallback[index],
    usedPercent: used,
    windowMinutes: SAKANA_WINDOW_MINUTES[fallback[index]],
    showMeter: true
  }));
}

function findMonthlyPrice(html) {
  const match = html.match(/\$(\d+)\s*\/?\s*mo\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function findPlan(html) {
  // The active tier is a Standard|Pro|Max token near a price marker.
  const tokens = ['Standard', 'Pro', 'Max'];
  for (const token of tokens) {
    if (new RegExp(`>${token}<`).test(html)) return token === 'Max' ? 'Max' : token;
  }
  return null;
}

function looksLoggedOut(html) {
  // Keyed on marker ABSENCE: a logged-in page legitimately mentions "Sign in".
  // A windowless shell is caught by the caller, which reports unauthorized.
  return !html.includes('Billing') || findWindowLabelPositions(html).length === 0;
}

function mapSakanaErrorStatus(error) {
  const status = error && error.status;
  if (['disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error'].includes(status)) return status;
  return 'unavailable';
}

async function fetchSakanaLimits(options = {}, deps = {}) {
  const now = (deps.now || Date.now)();
  const updatedAt = new Date(now).toISOString();
  const cookie = sakanaSessionCookie(options, deps);
  if (!cookie) {
    return normalizeLimitProvider({
      provider: 'sakana',
      source: 'web',
      status: 'notConfigured',
      updatedAt,
      windows: []
    });
  }

  try {
    const html = await runWithProbeDeadline(async ({ signal }) => {
      const response = await (deps.fetch || fetch)(SAKANA_BILLING_URL, {
        headers: {
          Cookie: cookie,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': SAKANA_USER_AGENT,
          Referer: `${SAKANA_WEB_ORIGIN}/`
        },
        signal
      });
      if (response.status === 401 || response.status === 403) {
        const error = new Error(`Sakana returned ${response.status}`);
        error.status = 'unauthorized';
        throw error;
      }
      if (response.status === 429) {
        const error = new Error('Sakana returned 429');
        error.status = 'sourceRateLimited';
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`Sakana returned ${response.status}`);
        error.status = 'unavailable';
        throw error;
      }
      return response.text();
    }, { deadlineMs: Number(deps.fetchTimeoutMs || SAKANA_FETCH_TIMEOUT_MS) });

    const body = typeof html === 'string' ? html : '';
    if (!body) {
      throw Object.assign(new Error('Sakana returned an empty page'), { status: 'unavailable' });
    }

    const windows = parseSakanaBillingHtml(body);
    if (!windows.length) {
      // Logged-out shell, expired cookie, or a moved layout: all three mean the
      // user must refresh the cookie, and none should render as a blank success.
      const error = new Error(
        looksLoggedOut(body)
          ? 'Sakana session expired or invalid. Refresh SAKANA_SESSION_COOKIE.'
          : 'Sakana billing page had no parseable quota windows (layout may have changed)'
      );
      error.status = 'unauthorized';
      throw error;
    }

    const plan = findPlan(body);
    const monthlyPrice = findMonthlyPrice(body);
    return normalizeLimitProvider({
      provider: 'sakana',
      accountKey: hashKey('sakana', cookie),
      accountLabel: 'Fugu',
      source: 'web',
      status: 'ok',
      updatedAt,
      // The monthly price is metadata only — surfaced in the plan label, since
      // the shared limits schema has no numeric plan-price field.
      ...(plan || monthlyPrice !== null
        ? { planLabel: [plan, monthlyPrice !== null ? `$${monthlyPrice}/mo` : ''].filter(Boolean).join(' ') }
        : {}),
      windows
    });
  } catch (error) {
    return normalizeLimitProvider({
      provider: 'sakana',
      source: 'web',
      status: mapSakanaErrorStatus(error),
      updatedAt,
      windows: []
    });
  }
}

module.exports = {
  SAKANA_BILLING_URL,
  SAKANA_FETCH_TIMEOUT_MS,
  SAKANA_WEB_ORIGIN,
  fetchSakanaLimits,
  findMonthlyPrice,
  findPlan,
  hasSakanaCredentials,
  looksLoggedOut,
  parseSakanaBillingHtml,
  sakanaSessionCookie,
  sakanaSessionPath
};
