'use strict';

async function runManualDeviceRefresh(runtime, options = {}) {
  if (!runtime) return { ok: false, code: 'runtime_unavailable' };
  const tickResult = await runtime.tick('manual', { forceHistory: options.forceHistory === true });
  // The collector deliberately converts handled tick failures into `false`
  // rather than rejecting, so the main-process recovery result must preserve
  // that signal instead of treating every resolved promise as success.
  return tickResult === false
    ? { ok: false, code: 'collection_failed' }
    : { ok: true };
}

module.exports = {
  runManualDeviceRefresh
};
