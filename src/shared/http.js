'use strict';

const { MAX_JSON_BODY_BYTES } = require('./wireValidation');
const DEFAULT_HTTP_REQUEST_TIMEOUT_MS = 15 * 1000;

function abortError(reason) {
  if (reason instanceof Error) return reason;
  const error = new Error('The request was aborted');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

// AbortController is the socket-level cancellation mechanism used by fetch, but
// racing the promise as well keeps custom/test fetch implementations from leaving
// callers stuck forever when they ignore the signal.
async function fetchWithTimeout(fetchFn, url, options = {}, timeoutMs = DEFAULT_HTTP_REQUEST_TIMEOUT_MS, { bufferBody = false } = {}) {
  const controller = new AbortController();
  const externalSignal = options?.signal;
  let timeout;
  let removeExternalAbort = null;
  const externalAbort = new Promise((_, reject) => {
    if (!externalSignal) return;
    const onAbort = () => {
      const reason = abortError(externalSignal.reason);
      try { controller.abort(externalSignal.reason); } catch (_) { controller.abort(); }
      reject(reason);
    };
    if (externalSignal.aborted) onAbort();
    else {
      externalSignal.addEventListener('abort', onAbort, { once: true });
      removeExternalAbort = () => externalSignal.removeEventListener('abort', onAbort);
    }
  });
  const parsedTimeout = Number(timeoutMs);
  const deadline = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_HTTP_REQUEST_TIMEOUT_MS;
  const deadlineError = new Error(`Request timed out after ${deadline}ms`);
  deadlineError.code = 'request_timeout';
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      try { controller.abort(deadlineError); } catch (_) { controller.abort(); }
      reject(deadlineError);
    }, deadline);
    timeout.unref?.();
  });
  const requestPromise = Promise.resolve().then(async () => {
    const response = await fetchFn(url, { ...options, signal: controller.signal });
    if (!bufferBody || !response || typeof response.arrayBuffer !== 'function') return response;

    // fetch() resolves when response headers arrive. Ordinary Hub calls need the
    // same deadline to cover the body as well, otherwise a peer can send headers
    // and leave response.json()/text() waiting forever. Buffer under the live
    // AbortController, then return a fresh Response that callers can consume with
    // the normal API after the deadline has been cleared. SSE deliberately uses
    // the unbuffered form and owns its lifetime through an idle watchdog.
    const body = await response.arrayBuffer();
    const status = Number(response.status);
    const bodyForbidden = status === 101 || status === 204 || status === 205 || status === 304;
    const responseHeaders = new Headers(response.headers);
    // fetch exposes decoded bytes. Carrying the original transport framing onto
    // the reconstructed body would describe the buffered payload incorrectly.
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');
    return new Response(bodyForbidden ? null : body, {
      status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  });
  // A timed-out request may still reject after the timeout race has settled. Keep
  // that late rejection from becoming an unhandled promise in the caller.
  requestPromise.catch(() => {});
  try {
    return await Promise.race([requestPromise, timeoutPromise, externalAbort]);
  } finally {
    clearTimeout(timeout);
    removeExternalAbort?.();
  }
}

function fetchBufferedWithTimeout(fetchFn, url, options = {}, timeoutMs = DEFAULT_HTTP_REQUEST_TIMEOUT_MS) {
  return fetchWithTimeout(fetchFn, url, options, timeoutMs, { bufferBody: true });
}

function corsHeaders(extraHeaders = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,prefer,x-token-monitor-secret',
    ...extraHeaders
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, corsHeaders({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders
  }));
  res.end(body);
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, corsHeaders({
    'content-type': contentType,
    'cache-control': 'no-store'
  }));
  res.end(body);
}

function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (tooLarge) return;
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > maxBytes) {
        tooLarge = true;
        body = '';
        const error = new Error('Request body too large');
        error.code = 'payload_too_large';
        reject(error);
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (!body.trim()) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (error) { reject(new Error(`Invalid JSON body: ${error.message}`)); }
    });
    req.on('error', reject);
  });
}

module.exports = {
  DEFAULT_HTTP_REQUEST_TIMEOUT_MS,
  MAX_JSON_BODY_BYTES,
  corsHeaders,
  fetchBufferedWithTimeout,
  fetchWithTimeout,
  readJsonBody,
  sendJson,
  sendText
};
