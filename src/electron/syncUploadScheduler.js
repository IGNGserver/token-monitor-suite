'use strict';

// Kept as a compatibility import for existing Electron-side tests and callers.
// The implementation is shared with the headless agent so upload retry, flush,
// timeout, and latest-snapshot semantics cannot drift between runtimes.
module.exports = require('../shared/syncUploadScheduler');
