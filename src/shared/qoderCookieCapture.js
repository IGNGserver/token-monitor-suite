'use strict';

const { execFile } = require('node:child_process');
const { createDecipheriv, pbkdf2Sync } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const QODER_COOKIE_CAPTURE_ERROR = 'QODER_COOKIE_CAPTURE_INVALID';
const QODER_COOKIE_ALLOWED_HOSTS = Object.freeze([
  'qoder.com',
  'www.qoder.com',
  'qoder.com.cn',
  'www.qoder.com.cn'
]);
// Chrome stores cookies scoped to a parent domain with a leading dot (for
// example `.qoder.com`). Keep the allowlist exact after normalization rather
// than accepting arbitrary Qoder subdomains.
const QODER_COOKIE_ALLOWED_HOST_VARIANTS = Object.freeze(
  QODER_COOKIE_ALLOWED_HOSTS.flatMap((host) => [host, `.${host}`])
);
const QODER_COOKIE_MAX_BYTES = 64 * 1024;
const COOKIE_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const SAFE_CURL_FLAGS = new Set([
  '--compressed', '--include', '--location', '-i', '-L', '-s', '-S', '--silent', '--show-error'
]);

function captureError(reason = 'invalid_input') {
  const error = new Error(`Qoder cookie capture rejected (${reason})`);
  error.code = QODER_COOKIE_CAPTURE_ERROR;
  error.reason = reason;
  return error;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureInputSize(value) {
  if (Buffer.byteLength(String(value || ''), 'utf8') > QODER_COOKIE_MAX_BYTES) {
    throw captureError('input_too_large');
  }
}

function siteFromHost(host) {
  const normalized = String(host || '').trim().toLowerCase()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
  if (!QODER_COOKIE_ALLOWED_HOSTS.includes(normalized)) throw captureError('untrusted_host');
  return normalized.endsWith('.com.cn') ? 'cn' : 'global';
}

function hostFromUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(String(rawUrl || '')); } catch (_) { throw captureError('invalid_url'); }
  if (parsed.protocol !== 'https:') throw captureError('insecure_url');
  if (parsed.username || parsed.password || parsed.port) throw captureError('invalid_url');
  return { host: parsed.hostname.toLowerCase(), site: siteFromHost(parsed.hostname) };
}

function parseCookieHeader(value) {
  let raw = cleanText(value);
  if (/^cookie\s*:/i.test(raw)) raw = raw.replace(/^cookie\s*:/i, '').trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) throw captureError('invalid_cookie');
  const pairs = raw.split(';').map((part) => part.trim()).filter(Boolean);
  if (pairs.length === 0) throw captureError('invalid_cookie');
  const seen = new Set();
  const normalized = [];
  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    if (separator <= 0) throw captureError('invalid_cookie');
    const name = pair.slice(0, separator).trim();
    const cookieValue = pair.slice(separator + 1).trim();
    if (!COOKIE_NAME_RE.test(name) || !cookieValue || /[\u0000-\u001f\u007f;]/.test(cookieValue)) {
      throw captureError('invalid_cookie');
    }
    if (seen.has(name)) continue;
    seen.add(name);
    normalized.push(`${name}=${cookieValue}`);
  }
  if (normalized.length === 0) throw captureError('invalid_cookie');
  return normalized.join('; ');
}

function siteResult(cookie, site, source, extra = {}) {
  return {
    cookie: parseCookieHeader(cookie),
    site: site === 'cn' ? 'cn' : 'global',
    source: String(source || 'manual').trim() || 'manual',
    ...extra
  };
}

function assertExplicitSite(site, inferredSite) {
  if (site === undefined || site === null || site === '') return inferredSite;
  const normalized = String(site).trim().toLowerCase();
  let explicit = normalized === 'cn' || normalized === 'china'
    ? 'cn'
    : normalized === 'global' || normalized === 'en'
      ? 'global'
      : '';
  if (!explicit && /^https?:\/\//i.test(normalized)) explicit = hostFromUrl(normalized).site;
  if (!explicit) {
    try { explicit = siteFromHost(normalized); } catch (_) {}
  }
  if (!explicit || (inferredSite && explicit !== inferredSite)) throw captureError('site_conflict');
  return explicit;
}

function parseQoderCookieHeader(value, options = {}) {
  return siteResult(value, assertExplicitSite(options.site, null), options.source || 'manual');
}

function rejectShellSyntax(value) {
  if (/[\u0000-\u001f\u007f;&|$`()<>]/.test(value)) throw captureError('shell_syntax');
}

function shellWords(input) {
  const words = [];
  let word = '';
  let quote = '';
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) { quote = ''; continue; }
      if (char === '\\') throw captureError('shell_syntax');
      word += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (/\s/.test(char)) {
      if (word) { words.push(word); word = ''; }
      continue;
    }
    if (char === '\\') throw captureError('shell_syntax');
    word += char;
  }
  if (quote) throw captureError('shell_syntax');
  if (word) words.push(word);
  return words;
}

function parseQoderCurlCommand(input, options = {}) {
  const raw = cleanText(input);
  ensureInputSize(raw);
  rejectShellSyntax(raw);
  const words = shellWords(raw);
  if (words.length === 0 || words[0].toLowerCase() !== 'curl') throw captureError('not_curl');
  let cookie = '';
  let url = '';
  let host = '';
  for (let index = 1; index < words.length; index += 1) {
    const flag = words[index];
    if (flag === '-H' || flag === '--header') {
      const header = words[++index];
      if (!header) throw captureError('missing_header');
      const separator = header.indexOf(':');
      if (separator <= 0) throw captureError('invalid_header');
      const name = header.slice(0, separator).trim().toLowerCase();
      const value = header.slice(separator + 1).trim();
      if (name === 'cookie') {
        if (cookie) throw captureError('duplicate_cookie');
        cookie = value;
      } else if (name === 'host') {
        if (host && host !== value.toLowerCase()) throw captureError('conflicting_host');
        host = value.toLowerCase();
      } else if (name !== 'accept' && name !== 'accept-language' && name !== 'user-agent'
        && name !== 'origin' && name !== 'referer' && name !== 'content-type'
        && name !== 'x-requested-with') {
        throw captureError('unsupported_header');
      }
      continue;
    }
    if (flag === '-b' || flag === '--cookie') {
      const value = words[++index];
      if (!value || cookie) throw captureError(cookie ? 'duplicate_cookie' : 'missing_cookie');
      cookie = value;
      continue;
    }
    if (flag === '--url') {
      const value = words[++index];
      if (!value || url) throw captureError(url ? 'multiple_urls' : 'missing_url');
      url = value;
      continue;
    }
    if (flag === '-X' || flag === '--request') {
      if (String(words[++index] || '').toUpperCase() !== 'GET') throw captureError('unsupported_method');
      continue;
    }
    if (SAFE_CURL_FLAGS.has(flag)) continue;
    if (/^https?:\/\//i.test(flag)) {
      if (url) throw captureError('multiple_urls');
      url = flag;
      continue;
    }
    if (flag.startsWith('-')) throw captureError('unsupported_option');
    throw captureError('unexpected_argument');
  }
  if (!url || !cookie) throw captureError('missing_capture_field');
  const parsed = hostFromUrl(url);
  if (host && siteFromHost(host) !== parsed.site) throw captureError('host_url_conflict');
  const site = assertExplicitSite(options.site, parsed.site);
  return siteResult(cookie, site, options.source || 'manual-curl', { host: parsed.host });
}

function parseQoderHttpRequest(input, options = {}) {
  const raw = String(input || '').replace(/\r\n/g, '\n');
  ensureInputSize(raw);
  if (!raw.trim() || /[\u0000]/.test(raw)) throw captureError('invalid_request');
  const lines = raw.split('\n');
  const first = lines.shift().trim();
  const request = first.match(/^(GET)\s+(\S+)\s+HTTP\/\d(?:\.\d+)?$/i);
  if (!request) throw captureError('unsupported_request');
  let cookie = '';
  let host = '';
  for (const line of lines) {
    if (!line.trim()) break;
    const separator = line.indexOf(':');
    if (separator <= 0) throw captureError('invalid_header');
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === 'cookie') {
      if (cookie) throw captureError('duplicate_cookie');
      cookie = value;
    } else if (name === 'host') {
      if (host && host !== value.toLowerCase()) throw captureError('conflicting_host');
      host = value.toLowerCase();
    }
  }
  if (!host || !cookie) throw captureError('missing_capture_field');
  const normalizedHost = host.replace(/^\.+/, '');
  const url = /^https?:\/\//i.test(request[2]) ? request[2] : `https://${normalizedHost}${request[2]}`;
  const parsed = hostFromUrl(url);
  if (parsed.host !== normalizedHost && !(normalizedHost.startsWith('www.') && parsed.host === normalizedHost.slice(4))) {
    throw captureError('host_url_conflict');
  }
  const site = assertExplicitSite(options.site, parsed.site);
  return siteResult(cookie, site, options.source || 'manual-http', { host: parsed.host });
}

function parseQoderCookieInput(input, options = {}) {
  const raw = cleanText(input);
  ensureInputSize(raw);
  if (!raw) throw captureError('empty_input');
  if (/^cookie\s*:/i.test(raw)) return parseQoderCookieHeader(raw, options);
  if (/^curl(?:\s|$)/i.test(raw)) return parseQoderCurlCommand(raw, options);
  if (/^(?:GET)\s+\S+\s+HTTP\//i.test(raw)) return parseQoderHttpRequest(raw, options);
  if (/[\r\n]/.test(raw) && /(?:^|\n)\s*(?:cookie|host)\s*:/im.test(raw)) {
    return parseQoderHttpRequest(raw, options);
  }
  return siteResult(raw, assertExplicitSite(options.site, null), options.source || 'manual');
}

function qoderCookieCaptureCapabilities(platform = process.platform) {
  return {
    manual: true,
    auto: platform === 'darwin',
    browser: platform === 'darwin' ? 'chrome' : null
  };
}

function chromeProfileDirs(homeDir) {
  if (!homeDir) return [];
  const root = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome');
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (_) { return []; }
  return entries
    .filter((entry) => entry.isDirectory() && (entry.name === 'Default' || /^Profile \d+$/.test(entry.name)))
    .map((entry) => ({ name: entry.name, dir: path.join(root, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function decryptChromeCookie(encrypted, key) {
  const buffer = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted || '');
  if (buffer.length < 4) return '';
  const version = buffer.subarray(0, 3).toString('ascii');
  if (version !== 'v10' && version !== 'v11') return '';
  const payload = buffer.subarray(3);
  // Chromium has used both AES-GCM and AES-CBC in macOS cookie stores. Try GCM
  // first for current profiles, then the legacy CBC form. No plaintext is ever
  // logged or returned on a failed decrypt.
  if (payload.length > 12 + 16) {
    try {
      const decipher = createDecipheriv('aes-128-gcm', key, payload.subarray(0, 12));
      decipher.setAuthTag(payload.subarray(-16));
      return Buffer.concat([decipher.update(payload.subarray(12, -16)), decipher.final()]).toString('utf8');
    } catch (_) {}
  }
  try {
    const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
  } catch (_) {
    return '';
  }
}

async function chromeSafeStorageKey(_options = {}, deps = {}) {
  const run = deps.execFile || execFileAsync;
  try {
    const result = await run('security', ['find-generic-password', '-w', '-s', 'Chrome Safe Storage'], {
      encoding: 'utf8', timeout: 5000, windowsHide: true
    });
    const password = String(result?.stdout || '').trim();
    if (!password) return null;
    return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  } catch (_) {
    return null;
  }
}

async function importQoderChromeCookies(options = {}, deps = {}) {
  if ((options.platform || process.platform) !== 'darwin') return [];
  const key = await chromeSafeStorageKey(options, deps);
  if (!key) return [];
  const requireFn = deps.requireFn || require;
  let DatabaseSync;
  try { ({ DatabaseSync } = requireFn('node:sqlite')); } catch (_) { return []; }
  const homeDir = options.homeDir || os.homedir();
  const candidates = [];
  for (const profile of chromeProfileDirs(homeDir)) {
    const source = path.join(profile.dir, 'Cookies');
    if (!fs.existsSync(source)) continue;
    let tempDir;
    try {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-qoder-cookie-'));
      const copy = path.join(tempDir, 'Cookies');
      fs.copyFileSync(source, copy);
      const database = new DatabaseSync(copy, { readOnly: true });
      try {
        const rows = database.prepare(
          `SELECT host_key, name, value, encrypted_value FROM cookies
           WHERE host_key IN (${QODER_COOKIE_ALLOWED_HOST_VARIANTS.map((host) => `'${host}'`).join(', ')})
           ORDER BY host_key, name`
        ).all();
        const bySite = new Map();
        for (const row of rows) {
          let value = String(row.value || '');
          if (!value && row.encrypted_value) value = decryptChromeCookie(row.encrypted_value, key);
          if (!value) continue;
          const site = siteFromHost(row.host_key);
          const list = bySite.get(site) || [];
          list.push(`${row.name}=${value}`);
          bySite.set(site, list);
        }
        for (const [site, values] of bySite) {
          try {
            candidates.push(siteResult(values.join('; '), site, 'chrome', { profile: profile.name }));
          } catch (_) {}
        }
      } finally {
        database.close();
      }
    } catch (_) {
      // A locked, old, or unsupported Chrome profile is just one candidate
      // source failing; the Qoder provider can still use another profile/cache.
    } finally {
      if (tempDir) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
      }
    }
  }
  return candidates;
}

module.exports = {
  QODER_COOKIE_ALLOWED_HOSTS,
  QODER_COOKIE_CAPTURE_ERROR,
  importQoderChromeCookies,
  parseQoderCookieHeader,
  parseQoderCookieInput,
  parseQoderCurlCommand,
  parseQoderHttpRequest,
  qoderCookieCaptureCapabilities
};
