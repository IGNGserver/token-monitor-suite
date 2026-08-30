'use strict';

/**
 * DeepSeek Harness (dsh) session usage parser.
 *
 * Harness keeps one append-only session log under DSH_HOME/sessions. The
 * default backend stores the header and each append batch in independent
 * Zstandard frames, so a log is not one ordinary compressed JSONL stream.
 * Usage is recorded on `assistant/message` events; streamed and packed chunk
 * records are deliberately ignored because they do not carry accounting and
 * would otherwise double-count a completed message.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const CLIENT_ID = 'deepseek-harness';
const SESSION_FORMAT_VERSION = 0;
const SESSION_FILE_NAMES = new Set(['session.jsonl', 'session.jsonl.zstd']);

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalNumber(object, keys) {
  if (!object || typeof object !== 'object') return undefined;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
    const value = Number(object[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function timestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 0 && numeric < 1e12 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function envOf(options = {}) {
  return options.env || process.env;
}

function homeOf(options = {}) {
  return options.homeDir || os.homedir();
}

function expandHomePath(value, home) {
  const raw = String(value || '').trim();
  if (raw === '~') return home;
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(home, raw.slice(2));
  return raw;
}

/** Resolve DSH_HOME with the same precedence as the upstream Harness. */
function resolveDeepSeekHarnessHome(options = {}) {
  const home = homeOf(options);
  const env = envOf(options);
  const configured = String(options.dshHome || env.DSH_HOME || '').trim();
  return path.resolve(expandHomePath(configured || path.join(home, '.dsh'), home));
}

function deepseekHarnessSessionsDir(options = {}) {
  return path.join(resolveDeepSeekHarnessHome(options), 'sessions');
}

function directoryExists(directory) {
  try { return fs.statSync(directory).isDirectory(); } catch (_) { return false; }
}

function sessionLogFiles(root) {
  const files = [];
  if (!directoryExists(root)) return files;
  const stack = [root];
  while (stack.length > 0) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && SESSION_FILE_NAMES.has(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

/**
 * Decode all complete Zstandard frames in a Harness log.
 *
 * Node's zstd convenience API intentionally stops after the first frame. The
 * `info` result exposes the number of compressed bytes consumed, which lets us
 * advance frame by frame. A concurrently appended final frame is allowed to be
 * incomplete; all earlier committed frames remain usable.
 */
function decodeZstdFrames(buffer) {
  if (typeof zlib.zstdDecompressSync !== 'function') {
    const error = new Error('DeepSeek Harness zstd logs require a Node runtime with zstdDecompressSync');
    error.code = 'DSH_ZSTD_UNAVAILABLE';
    throw error;
  }

  const chunks = [];
  let offset = 0;
  while (offset < buffer.length) {
    let decoded;
    try {
      decoded = zlib.zstdDecompressSync(buffer.subarray(offset), { info: true });
    } catch (error) {
      // A torn final frame is normal while Harness is appending. If no frame
      // was readable, this is a genuinely unusable log and the caller can log
      // it as a parse failure.
      if (chunks.length === 0) throw error;
      break;
    }
    const consumed = Number(decoded?.engine?.bytesWritten);
    if (!Number.isSafeInteger(consumed) || consumed <= 0 || consumed > buffer.length - offset) break;
    chunks.push(Buffer.from(decoded.buffer || Buffer.alloc(0)));
    offset += consumed;
  }
  if (chunks.length === 0) {
    const error = new Error('DeepSeek Harness zstd log contains no complete frames');
    error.code = 'DSH_ZSTD_EMPTY';
    throw error;
  }
  return Buffer.concat(chunks);
}

function readSessionText(filePath) {
  const content = fs.readFileSync(filePath);
  return filePath.endsWith('.jsonl.zstd')
    ? decodeZstdFrames(content).toString('utf8')
    : content.toString('utf8');
}

function parseHeader(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.type !== 'session' || value.version !== SESSION_FORMAT_VERSION) return null;
  if (typeof value.id !== 'string' || !value.id.trim()) return null;
  if (!Number.isSafeInteger(value.createdAt) || value.createdAt < 0) return null;
  return {
    id: value.id,
    createdAt: value.createdAt,
    cwd: typeof value.cwd === 'string' ? value.cwd : '',
    seedLength: Number.isSafeInteger(value.seedLength) && value.seedLength >= 0 ? value.seedLength : 0
  };
}

function mapUsage(value) {
  if (!value || typeof value !== 'object') return null;
  const promptDetails = value.prompt_tokens_details || value.promptTokensDetails;
  const completionDetails = value.completion_tokens_details || value.completionTokensDetails;
  const cacheRead = optionalNumber(value, [
    'cacheReadTokens', 'cache_read_tokens', 'cacheReadInputTokens', 'cache_read_input_tokens',
    'cachedTokens', 'cached_tokens', 'prompt_cache_hit_tokens'
  ]) ?? optionalNumber(promptDetails, ['cached_tokens', 'cachedTokens']);
  const cacheWrite = optionalNumber(value, [
    'cacheWriteTokens', 'cache_write_tokens', 'cacheCreationInputTokens',
    'cache_creation_input_tokens'
  ]) ?? optionalNumber(promptDetails, ['cache_write_tokens', 'cacheWriteTokens']);
  const directInput = optionalNumber(value, ['inputTokens', 'input_tokens']);
  const prompt = optionalNumber(value, ['promptTokens', 'prompt_tokens']);
  const input = directInput ?? (prompt === undefined ? undefined : Math.max(0, prompt - (cacheRead || 0)));
  const output = optionalNumber(value, ['outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens']);
  if (input === undefined && output === undefined && cacheRead === undefined && cacheWrite === undefined) return null;

  const reasoning = optionalNumber(value, ['reasoningTokens', 'reasoning_tokens'])
    ?? optionalNumber(completionDetails, ['reasoning_tokens', 'reasoningTokens']);
  return {
    input: Math.max(0, Math.round(input || 0)),
    output: Math.max(0, Math.round(output || 0)),
    cacheRead: Math.max(0, Math.round(cacheRead || 0)),
    cacheWrite: Math.max(0, Math.round(cacheWrite || 0)),
    reasoning: Math.max(0, Math.round(reasoning || 0))
  };
}

function eventModel(data) {
  const message = data?.message;
  const source = message?.source;
  return String(source?.model || message?.model || data?.model || '').trim() || 'unknown';
}

function eventProvider(data) {
  const message = data?.message;
  const source = message?.source;
  return String(source?.provider || message?.provider || data?.provider || '').trim() || 'deepseek-official';
}

/** Parse one raw or compressed session artifact into message-level usage rows. */
function parseSessionFile(filePath) {
  const text = readSessionText(filePath);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let header;
  try { header = parseHeader(JSON.parse(lines[0])); } catch (_) { header = null; }
  if (!header) return [];

  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    let event;
    try { event = JSON.parse(lines[index]); } catch (_) { continue; }
    if (event?.type !== 'assistant/message') continue;
    if (Number.isSafeInteger(header.seedLength) && Number(event.seq) < header.seedLength) continue;
    const usage = mapUsage(event.data?.usage);
    if (!usage) continue;
    const total = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
    if (total <= 0) continue;
    const timestamp = timestampMs(event.time) || header.createdAt;
    rows.push({
      client: CLIENT_ID,
      sessionId: header.id,
      model: eventModel(event.data),
      provider: eventProvider(event.data),
      input: usage.input,
      output: usage.output,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
      reasoning: usage.reasoning,
      messageCount: 1,
      startedAt: header.createdAt ? new Date(header.createdAt).toISOString() : '',
      lastUsedAt: timestamp ? new Date(timestamp).toISOString() : '',
      createdAt: timestamp,
      projectLabel: header.cwd
    });
  }
  return rows;
}

function collectDeepSeekHarnessRows(options = {}) {
  const root = options.sessionsDir || deepseekHarnessSessionsDir(options);
  const rows = [];
  for (const filePath of sessionLogFiles(root)) {
    try {
      rows.push(...parseSessionFile(filePath));
    } catch (error) {
      if (typeof options.logger === 'function') options.logger(`deepseek-harness parse failed for ${filePath}: ${error.message}`);
    }
  }
  return rows;
}

function rowCost(row, pricingByModel) {
  if (Object.prototype.hasOwnProperty.call(row || {}, 'cost') && Number.isFinite(Number(row.cost))) return Number(row.cost);
  const pricing = pricingByModel?.[String(row?.model || '').trim().toLowerCase()];
  if (!pricing) return 0;
  const components = [
    [row.input, pricing.inputCostPerToken],
    [row.output, pricing.outputCostPerToken],
    [row.cacheRead, pricing.cacheReadInputTokenCost],
    [row.cacheWrite, pricing.cacheCreationInputTokenCost]
  ];
  let cost = 0;
  for (const [tokens, unitCost] of components) {
    if (!tokens) continue;
    if (!Number.isFinite(Number(unitCost)) || Number(unitCost) < 0) return 0;
    cost += tokens * Number(unitCost);
  }
  return cost;
}

function buildTokscaleJson(window = {}, options = {}) {
  const startMs = Math.max(0, timestampMs(window.startMs ?? window.todayStart ?? window.monthStart ?? window.allTimeSince));
  const untilMs = Math.max(0, timestampMs(window.untilMs));
  const includeUndated = options.includeUndated === true;
  const rows = (Array.isArray(options.rows) ? options.rows : collectDeepSeekHarnessRows(options)).filter((row) => {
    const createdAt = timestampMs(row.createdAt || row.lastUsedAt || row.startedAt);
    if (!createdAt) return includeUndated && !startMs;
    if (startMs && createdAt < startMs) return false;
    if (untilMs && createdAt > untilMs) return false;
    return true;
  });
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.sessionId || 'unknown'}\u0000${row.model || 'unknown'}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        client: CLIENT_ID,
        sessionId: row.sessionId || 'unknown',
        model: row.model || 'unknown',
        provider: row.provider || 'deepseek-official',
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        reasoning: 0,
        messageCount: 0,
        cost: 0,
        startedAt: 0,
        lastUsedAt: 0,
        projectLabel: row.projectLabel || ''
      });
    }
    const target = grouped.get(key);
    target.input += numberValue(row.input);
    target.output += numberValue(row.output);
    target.cacheRead += numberValue(row.cacheRead);
    target.cacheWrite += numberValue(row.cacheWrite);
    target.reasoning += numberValue(row.reasoning);
    target.messageCount += Math.max(0, Math.round(numberValue(row.messageCount || row.messages || 1)));
    target.cost += rowCost(row, options.pricingByModel);
    const startedAt = timestampMs(row.startedAt || row.createdAt);
    const lastUsedAt = timestampMs(row.lastUsedAt || row.createdAt);
    if (startedAt && (!target.startedAt || startedAt < target.startedAt)) target.startedAt = startedAt;
    if (lastUsedAt > target.lastUsedAt) target.lastUsedAt = lastUsedAt;
    if (!target.projectLabel && row.projectLabel) target.projectLabel = row.projectLabel;
  }

  const entries = [...grouped.values()].map((row) => ({
    client: row.client,
    mergedClients: null,
    sessionId: row.sessionId,
    model: row.model,
    provider: row.provider,
    input: row.input,
    output: row.output,
    cacheRead: row.cacheRead,
    cacheWrite: row.cacheWrite,
    reasoning: row.reasoning,
    messageCount: row.messageCount,
    cost: row.cost,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : '',
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : '',
    projectLabel: row.projectLabel || '',
    performance: null
  }));
  const sum = (key) => entries.reduce((total, row) => total + numberValue(row[key]), 0);
  return {
    groupBy: 'client,session,model',
    entries,
    totalInput: sum('input'),
    totalOutput: sum('output'),
    totalCacheRead: sum('cacheRead'),
    totalCacheWrite: sum('cacheWrite'),
    totalMessages: sum('messageCount'),
    totalCost: sum('cost'),
    processingTimeMs: 0
  };
}

function localDateKey(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDeepSeekHarnessHistoryGraph(options = {}) {
  const days = new Map();
  const rows = Array.isArray(options.rows) ? options.rows : collectDeepSeekHarnessRows(options);
  for (const row of rows) {
    const date = localDateKey(row.createdAt || row.lastUsedAt);
    if (!date) continue;
    if (!days.has(date)) days.set(date, { date, clients: [] });
    const day = days.get(date);
    const modelId = String(row.model || 'unknown').trim().toLowerCase() || 'unknown';
    let model = day.clients.find((entry) => entry.modelId === modelId);
    if (!model) {
      model = {
        client: CLIENT_ID,
        modelId,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
        cost: 0,
        messages: 0
      };
      day.clients.push(model);
    }
    model.tokens.input += numberValue(row.input);
    model.tokens.output += numberValue(row.output);
    model.tokens.cacheRead += numberValue(row.cacheRead);
    model.tokens.cacheWrite += numberValue(row.cacheWrite);
    model.tokens.reasoning += numberValue(row.reasoning);
    model.cost += rowCost(row, options.pricingByModel);
    model.messages += Math.max(0, Math.round(numberValue(row.messageCount || row.messages || 1)));
  }
  return { contributions: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

function buildDeepSeekHarnessPeriods(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const rows = Array.isArray(options.rows) ? options.rows : collectDeepSeekHarnessRows(options);
  const buildOptions = { ...options, rows };
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return {
    today: buildTokscaleJson({ startMs: todayStart }, buildOptions),
    month: buildTokscaleJson({ startMs: monthStart }, buildOptions),
    allTime: buildTokscaleJson({ startMs: options.allTimeSince }, { ...buildOptions, includeUndated: true })
  };
}

function buildDeepSeekHarnessRangeJson(range, options = {}) {
  return buildTokscaleJson({ startMs: range?.startMs || 0, untilMs: range?.endMs || 0 }, {
    ...options,
    includeUndated: false
  });
}

module.exports = {
  CLIENT_ID,
  SESSION_FORMAT_VERSION,
  deepseekHarnessSessionsDir,
  resolveDeepSeekHarnessHome,
  sessionLogFiles,
  decodeZstdFrames,
  parseSessionFile,
  collectDeepSeekHarnessRows,
  buildTokscaleJson,
  buildDeepSeekHarnessHistoryGraph,
  buildDeepSeekHarnessPeriods,
  buildDeepSeekHarnessRangeJson
};
