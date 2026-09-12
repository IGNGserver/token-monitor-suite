'use strict';

const HUB_API_VERSION = 2;

function hubCapabilities(runtime, options = {}) {
  const hubAccounts = options.hubAccounts === true;
  return Object.freeze({
    stats: true,
    history: true,
    statsStream: true,
    subscriptions: true,
    usageRange: true,
    pricing: true,
    deviceDelete: true,
    deviceRename: true,
    publicStats: Boolean(options.publicStats),
    hubAccounts,
    centralLimits: hubAccounts,
    limitsAuthority: hubAccounts ? 'hub' : 'none'
  });
}

module.exports = { HUB_API_VERSION, hubCapabilities };
