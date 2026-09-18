'use strict';

const { aggregateDevices } = require('../shared/usage');

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function nonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function composeLocalSyncStats(hubStats, localDevice, options = {}) {
  if (!localDevice?.deviceId) return hubStats;
  if (hubStats && !Array.isArray(hubStats.devices)) return hubStats;

  const hubDevices = Array.isArray(hubStats?.devices) ? hubStats.devices : [];
  const localDeviceId = String(localDevice.deviceId);
  const previousDevices = new Map(hubDevices.map((device) => [String(device?.deviceId || ''), device]));
  const devices = hubDevices
    .filter((device) => String(device?.deviceId || '') !== localDeviceId)
    .concat(localDevice);
  const hubStaleAfterMs = nonNegativeNumber(hubStats?.staleAfterMs);
  const hasHubStaleAfterMs = hubStaleAfterMs !== null;
  const aggregate = aggregateDevices(devices, hubStaleAfterMs ?? 0, options.nowMs);

  aggregate.devices = aggregate.devices.map((device) => {
    const previous = previousDevices.get(device.deviceId);
    if (!previous) return device;
    if (device.deviceId === localDeviceId) return { ...previous, ...device };
    if (hasHubStaleAfterMs) return { ...previous, ...device };
    return {
      ...previous,
      ...device,
      stale: previous.stale,
      ageMs: previous.ageMs
    };
  });

  return {
    ...(hubStats || {}),
    updatedAt: aggregate.updatedAt,
    periods: aggregate.periods,
    devices: aggregate.devices,
    projectsIncomplete: aggregate.projectsIncomplete,
    // Reasonix native sessions are deliberately local-only. aggregateDevices()
    // normalizes wire records and therefore drops them, so reattach only the
    // current local collector's renderer view after aggregation. They must never
    // be copied from a remote Hub device or folded into period totals.
    ...(hasOwn(localDevice, 'nativeSessions') ? { nativeSessions: localDevice.nativeSessions } : {}),
    ...(hasOwn(localDevice, 'nativeProjects') ? { nativeProjects: localDevice.nativeProjects } : {}),
    limits: hasHubStaleAfterMs || !hasOwn(hubStats, 'limits') ? aggregate.limits : hubStats.limits
  };
}

/**
 * Reattach the local collector's Reasonix native sessions/projects to an already
 * aggregated local snapshot.
 *
 * `aggregateDevices()` normalizes wire records and is a field whitelist, so it
 * drops `nativeSessions`/`nativeProjects` — the ONLY channel carrying Reasonix
 * session and project detail (Reasonix is excluded from the ordinary session
 * path). Sync mode reattaches them through composeLocalSyncStats(); the default
 * local mode did not, so its session/project views and the tray recency provider
 * were empty for Reasonix while everything else worked.
 *
 * These fields are display-only and local-only: syncPayload.js strips them from
 * uploads, so this must never be applied to a record bound for the Hub.
 */
function reattachLocalNativeView(stats, localDevice) {
  if (!stats || !localDevice) return stats;
  const nativeSessions = hasOwn(localDevice, 'nativeSessions') ? localDevice.nativeSessions : undefined;
  const nativeProjects = hasOwn(localDevice, 'nativeProjects') ? localDevice.nativeProjects : undefined;
  if (nativeSessions === undefined && nativeProjects === undefined) return stats;
  return {
    ...stats,
    ...(nativeSessions === undefined ? {} : { nativeSessions }),
    ...(nativeProjects === undefined ? {} : { nativeProjects })
  };
}

module.exports = { composeLocalSyncStats, reattachLocalNativeView };
