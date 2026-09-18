// Desktop client boot module.
//
// Installs the IPC transport, points the client-icon resolver at the packaged
// asset tree, and then loads the shared UI. The app import is dynamic for the
// same reason as the Hub's: ES module imports evaluate before this module's
// body, and the shared UI reads prefs and credentials while it initialises, so
// the transport must be installed first.

import { createIpcTransport } from '../shared-ui/transport/ipcTransport.js';
import { configureTransport } from '../shared-ui/transport/index.js';
import { configureIconBase } from '../shared-ui/core/data.js';

const bridge = window.tokenMonitor;
if (!bridge) {
  throw new Error('preload bridge is unavailable; the renderer cannot reach the main process');
}

// Icons ship in the packaged asset tree next to the app resources. A relative
// path keeps `file://` resolution working from both the dev checkout and an
// asar-packed build.
configureIconBase('../../assets/icons');
configureTransport(createIpcTransport(bridge));

await import('../shared-ui/app.js');
