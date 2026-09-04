'use strict';

function isLoopbackHostname(hostname) {
  const value = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (value === 'localhost' || value === '::1') return true;
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return Boolean(match && Number(match[1]) === 127);
}

function inspectHubTransport(rawUrl) {
  const url = new URL(String(rawUrl || ''));
  if (url.protocol === 'https:') return { allowedByDefault: true, secure: true, loopback: false, url };
  if (url.protocol === 'http:' && isLoopbackHostname(url.hostname)) {
    return { allowedByDefault: true, secure: false, loopback: true, url };
  }
  if (url.protocol === 'http:') return { allowedByDefault: false, secure: false, loopback: false, url };
  return { allowedByDefault: false, secure: false, loopback: false, url };
}

function requireSafeHubTransport(rawUrl, options = {}) {
  const result = inspectHubTransport(rawUrl);
  if (result.allowedByDefault || options.allowInsecureHttp === true) return result.url.toString().replace(/\/$/, '');
  const error = new Error('Remote Hub URLs must use HTTPS. Set the explicit insecure-HTTP option only on a trusted LAN or VPN.');
  error.code = 'insecure_hub_transport';
  throw error;
}

module.exports = { inspectHubTransport, isLoopbackHostname, requireSafeHubTransport };
