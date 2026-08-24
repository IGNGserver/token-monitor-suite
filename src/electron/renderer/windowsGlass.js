'use strict';

(function initWindowsGlass(root, factory) {
  const windowsSurfaceApi = typeof module === 'object' && module.exports
    ? require('../windowsBackdropMode')
    : root?.TokenMonitorWindowsBackdropMode;
  const api = factory(windowsSurfaceApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorWindowsGlass = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (windowsSurfaceApi) => {
  const {
    WINDOWS_SURFACE_MICA,
    WINDOWS_SURFACE_NONE,
    WINDOWS_SURFACE_WIN10_FALLBACK,
    normalizeWindowsBackdropMode,
    normalizeWindowsSurface
  } = windowsSurfaceApi;

  function appearanceState(settings = {}, { isWindows = false, surface } = {}) {
    const systemGlassEnabled = settings?.systemGlass !== false;
    const requestedSurface = normalizeWindowsSurface(surface ?? settings?.windowsSurface);
    const resolvedSurface = !isWindows || !systemGlassEnabled
      ? WINDOWS_SURFACE_NONE
      : requestedSurface === WINDOWS_SURFACE_NONE
        ? WINDOWS_SURFACE_WIN10_FALLBACK
        : requestedSurface;
    return {
      surface: resolvedSurface,
      nativeBackdrop: resolvedSurface === WINDOWS_SURFACE_MICA,
      useLegacyAccent: resolvedSurface === WINDOWS_SURFACE_WIN10_FALLBACK,
      // Windows now chooses the surface from the OS build. Keep these fields
      // false so older renderer callers cannot resurrect the removed selector.
      showBackdropControl: false,
      showAccentNote: false,
      showMicaNote: false,
      // Expose the old value for compatibility with extensions that imported
      // this module, but do not use it to choose the actual surface.
      backdropMode: normalizeWindowsBackdropMode(settings?.windowsBackdrop)
    };
  }

  // Native Mica is deliberately quiet and opaque enough for the main content;
  // transient HTML surfaces can be lighter and more transparent so the OS
  // material remains visible around menus, tooltips, and the bubble.
  function nativePopoverAlpha({ lightTheme = false, surface = WINDOWS_SURFACE_MICA } = {}) {
    if (surface === WINDOWS_SURFACE_WIN10_FALLBACK) return lightTheme ? 0.88 : 0.78;
    return lightTheme ? 0.9 : 0.78;
  }

  function nativePopoverBlur({ surface = WINDOWS_SURFACE_MICA } = {}) {
    return surface === WINDOWS_SURFACE_WIN10_FALLBACK ? 30 : 28;
  }

  return {
    appearanceState,
    nativePopoverAlpha,
    nativePopoverBlur,
    normalizeWindowsBackdropMode,
    normalizeWindowsSurface
  };
});
