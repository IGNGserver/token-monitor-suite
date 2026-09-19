'use strict';

const GLOBAL_SHORTCUTS_PORTAL = 'GlobalShortcutsPortal';

function switchValue(argv, name) {
  const args = Array.isArray(argv) ? argv : [];
  const prefix = `--${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] || '');
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) {
      const next = args[index + 1];
      return next && !String(next).startsWith('--') ? String(next) : '';
    }
  }
  return null;
}

function hasSwitch(argv, name, commandLine) {
  return switchValue(argv, name) !== null || Boolean(commandLine?.hasSwitch?.(name));
}

function isWaylandSession({ platform = process.platform, env = process.env } = {}) {
  if (platform !== 'linux') return false;
  return String(env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland' || Boolean(env.WAYLAND_DISPLAY);
}

function chooseLinuxOzonePlatform({ platform = process.platform, env = process.env, argv = process.argv, commandLine } = {}) {
  if (!isWaylandSession({ platform, env })) return null;
  // Respect an explicit choice. Users may need native Wayland on systems where
  // XWayland is unavailable, or X11 for Electron features that need coordinates.
  if (hasSwitch(argv, 'ozone-platform', commandLine)) return null;
  // This window restores saved bounds, so it needs positioning APIs. XWayland is the compatible
  // backend when a Wayland session exposes an X display; native Wayland cannot
  // provide the positioning APIs this app relies on.
  return env.DISPLAY ? 'x11' : null;
}

function mergeEnableFeatures(existing, feature = GLOBAL_SHORTCUTS_PORTAL) {
  const features = String(existing || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!features.includes(feature)) features.push(feature);
  return features.join(',');
}

function configureLinuxDisplayBackend({ app, platform = process.platform, env = process.env, argv = process.argv } = {}) {
  const wayland = isWaylandSession({ platform, env });
  const commandLine = app?.commandLine;
  if (!wayland) return { wayland: false, ozonePlatform: null, globalShortcutsPortal: false };

  const existingFeatures = switchValue(argv, 'enable-features')
    ?? commandLine?.getSwitchValue?.('enable-features')
    ?? '';
  const globalShortcutsPortal = Boolean(commandLine?.appendSwitch);
  if (globalShortcutsPortal && !String(existingFeatures).split(',').map((item) => item.trim()).includes(GLOBAL_SHORTCUTS_PORTAL)) {
    commandLine.appendSwitch('enable-features', mergeEnableFeatures(existingFeatures));
  }

  const ozonePlatform = chooseLinuxOzonePlatform({ platform, env, argv, commandLine });
  if (ozonePlatform && typeof commandLine?.appendSwitch === 'function') {
    commandLine.appendSwitch('ozone-platform', ozonePlatform);
  }

  return { wayland: true, ozonePlatform, globalShortcutsPortal };
}

module.exports = {
  GLOBAL_SHORTCUTS_PORTAL,
  chooseLinuxOzonePlatform,
  configureLinuxDisplayBackend,
  isWaylandSession,
  mergeEnableFeatures,
  switchValue
};
