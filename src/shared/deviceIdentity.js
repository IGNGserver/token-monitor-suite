'use strict';

const path = require('node:path');
const { fetchBufferedWithTimeout } = require('./http');
const { readJson, sharedDataDir, writeJsonAtomic } = require('./config');

const DEVICE_IDENTITY_VERSION = 1;
const DEFAULT_DEVICE_IDENTITY_TIMEOUT_MS = 15 * 1000;

function normalizeDeviceId(value) {
  const id = String(value || '').trim();
  return id || '';
}

function deviceIdentityPath(options = {}) {
  return options.path || path.join(sharedDataDir(options), 'device-identity.json');
}

function normalizeDeviceIdentity(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: DEVICE_IDENTITY_VERSION,
    lastPostedDeviceId: normalizeDeviceId(source.lastPostedDeviceId || source.deviceId)
  };
}

function readDeviceIdentity(options = {}) {
  const read = options.readJson || readJson;
  return normalizeDeviceIdentity(read(deviceIdentityPath(options), {}));
}

function writeDeviceIdentity(deviceId, options = {}) {
  const write = options.writeJsonAtomic || writeJsonAtomic;
  write(deviceIdentityPath(options), normalizeDeviceIdentity({ lastPostedDeviceId: deviceId }));
}

function statusOf(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  return Number.isInteger(status) && status > 0 ? status : null;
}

function failureCode(error, fallback = 'hub_rename_failed') {
  const status = statusOf(error);
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 408) return 'request_timeout';
  if (status === 429) return 'rate_limited';
  if (status !== null && status >= 500) return 'hub_server_error';
  const code = String(error?.code || error?.cause?.code || '').trim().toLowerCase();
  return code.replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || fallback;
}

/**
 * Move the Hub-side cumulative baseline before the first upload under a new
 * device identity. The same helper is used by Electron and the headless agent.
 */
async function renameDeviceOnHub(fetchFn, hubUrl, secret, previousDeviceId, nextDeviceId, options = {}) {
  const previous = normalizeDeviceId(previousDeviceId);
  const next = normalizeDeviceId(nextDeviceId);
  if (!hubUrl || !previous || !next || previous === next) return false;
  const base = String(hubUrl).replace(/\/$/, '');
  const timeoutMs = Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : DEFAULT_DEVICE_IDENTITY_TIMEOUT_MS;
  const requestOptions = (extra = {}) => ({
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(secret ? { authorization: `Bearer ${secret}` } : {})
    },
    ...(options.signal ? { signal: options.signal } : {})
  });

  const devicesResponse = await fetchBufferedWithTimeout(
    fetchFn,
    `${base}/api/devices`,
    requestOptions(),
    timeoutMs
  );
  if (devicesResponse.ok) {
    const body = await devicesResponse.json();
    const ids = new Set((body?.devices || [])
      .map((device) => normalizeDeviceId(device?.deviceId || device?.id))
      .filter(Boolean));
    // An administrator may have completed the migration from the Hub dashboard
    // already. Treat that state as complete without requiring admin scope here.
    if (!ids.has(previous) && ids.has(next)) return true;
  }

  const response = await fetchBufferedWithTimeout(
    fetchFn,
    `${base}/api/devices/${encodeURIComponent(previous)}/rename`,
    requestOptions({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: next })
    }),
    timeoutMs
  );
  if (response.status === 404) return false;
  if (response.status === 403) {
    const error = new Error('Hub device rename requires an admin credential; provision a token for the new Device ID on the Hub host before changing it here');
    error.status = response.status;
    error.code = 'forbidden';
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Hub device rename failed (${response.status})`);
    error.status = response.status;
    error.code = failureCode(error);
    throw error;
  }
  return true;
}

module.exports = {
  DEFAULT_DEVICE_IDENTITY_TIMEOUT_MS,
  DEVICE_IDENTITY_VERSION,
  deviceIdentityPath,
  normalizeDeviceIdentity,
  normalizeDeviceId,
  readDeviceIdentity,
  renameDeviceOnHub,
  writeDeviceIdentity
};
