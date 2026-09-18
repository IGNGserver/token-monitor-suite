// Shared view context.
//
// View modules need the app's translation and escaping helpers, but importing
// app.js from a view would create a cycle (app.js renders the views). The app
// installs those helpers here once at boot and the views read them through this
// facade.
//
// A view must never assume it can reach browser state directly — anything
// host-specific belongs in transport/. This module only carries pure helpers
// that are identical in both hosts.

let context = null;

export function configureViewContext(next) {
  if (!next || typeof next.tr !== 'function') {
    throw new Error('configureViewContext requires at least a tr() helper');
  }
  context = next;
}

function requireContext() {
  if (!context) {
    throw new Error('View context is not configured; the app must call configureViewContext() before rendering');
  }
  return context;
}

export function tr(key, params) {
  return requireContext().tr(key, params);
}

export function escapeHtml(value) {
  return requireContext().escapeHtml(value);
}

export function settingsOptionList(options, selected) {
  const ctx = requireContext();
  if (typeof ctx.settingsOptionList === 'function') return ctx.settingsOptionList(options, selected);
  return options.map(([value, label]) => `<option value="${ctx.escapeHtml(value)}"${String(value) === String(selected) ? ' selected' : ''}>${ctx.escapeHtml(label)}</option>`).join('');
}

/** Strip the shared settingsOptionList dependency for callers that pass raw pairs. */
export function optionList(pairs, selected) {
  return settingsOptionList(pairs, selected);
}

// --- App services the view modules share -----------------------------------
//
// The views are pure renderers over `state`, so they read the same small set of
// primitives the app already owns rather than duplicating them. Each accessor
// resolves through the installed context on call, not at import time, so a view
// module can be imported before the app has finished wiring itself.

/** The mutable app state. Views read it; only the app writes `prefs`. */
export function appState() {
  return requireContext().state;
}

/** The cached element lookup table built at boot. */
export function appElements() {
  return requireContext().els;
}

/** Call the app's renderer (used by views whose controls trigger a re-render). */
export function rerender() {
  return requireContext().render();
}

/** Persist a preference change. */
export function persistPrefs(patch) {
  return requireContext().savePrefs(patch);
}

/** Navigate to another view, optionally with a sub-tab. */
export function goToView(viewId, options) {
  return requireContext().switchView(viewId, options);
}

export function showToast(message) {
  return requireContext().showToast(message);
}

/** A named helper the app installs, so a view can call it without importing app.js. */
export function viewHelper(name) {
  const helper = requireContext()[name];
  if (typeof helper !== 'function') {
    throw new Error(`View helper "${name}" is not available on the view context`);
  }
  return helper;
}
