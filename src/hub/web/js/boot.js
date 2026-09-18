// Hub dashboard boot module.
//
// The Hub serves the shared UI from /ui/ (see src/hub/static.js) and this file
// is the only dashboard-specific glue: it installs the HTTP/SSE transport,
// points the client-icon resolver at the Hub's own icon route, and hands
// control to the shared application.
//
// The app is imported dynamically on purpose. ES module imports are evaluated
// before the importing module's body, so a static `import '/ui/app.js'` would
// run the shared UI's top-level state initialisation (which reads prefs and
// flags through the transport) before configureTransport() below had a chance
// to install one.

import { createHttpTransport } from '/ui/transport/httpTransport.js';
import { configureTransport } from '/ui/transport/index.js';
import { configureIconBase } from '/ui/core/data.js';

// Client icons stay a Hub-served asset at /icons/clients so existing
// deployments keep working; only the SVG files themselves moved into the
// shared package.
configureIconBase('/icons/clients');
configureTransport(createHttpTransport({ baseUrl: '', getSecret: () => '' }));

await import('/ui/app.js');
