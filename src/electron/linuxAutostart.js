'use strict';

// Linux "start at login". Electron's app.setLoginItemSettings is a no-op on
// Linux, so we manage an XDG autostart entry ourselves. AppImage builds use
// $APPIMAGE; native packages such as .deb pass their installed executable path.

const fs = require('fs');
const os = require('os');
const path = require('path');

const DESKTOP_FILE_NAME = 'token-monitor.desktop';
// Written by builds that could start hidden in the tray. Nothing starts hidden
// now, but `isAutostartEnabled` still recognises the marker so an existing
// autostart entry is not silently reported as off after an update.
const STARTED_AT_LOGIN_ARG = '--started-at-login';

function launchPath({ env = process.env, appPath = '' } = {}) {
  return String(appPath || env.APPIMAGE || '').trim();
}

function autostartSupported({ platform = process.platform, env = process.env, appPath = '' } = {}) {
  return platform === 'linux' && Boolean(launchPath({ env, appPath }));
}

// posix join on purpose: XDG paths are POSIX paths, and this keeps the module's
// output identical when the test suite runs on Windows CI.
function desktopFilePath({ env = process.env } = {}) {
  const configHome = env.XDG_CONFIG_HOME || path.posix.join(env.HOME || os.homedir(), '.config');
  return path.posix.join(configHome, 'autostart', DESKTOP_FILE_NAME);
}

// Desktop Entry spec quoting: the Exec argument is double-quoted with `"`, `` ` ``,
// `$` and `\` backslash-escaped, literal `%` doubled for field-code expansion,
// then the string-value layer doubles every backslash.
function quoteExecArgument(value) {
  const quoted = String(value).replace(/%/g, '%%').replace(/[\\"`$]/g, (char) => `\\${char}`);
  return `"${quoted.replace(/\\/g, '\\\\')}"`;
}

function desktopFileContents(executablePath) {
  const exec = quoteExecArgument(executablePath);
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Token Monitor',
    `Exec=${exec}`,
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n');
}

function isAutostartEnabled(options = {}) {
  const env = options?.env || process.env;
  const appPath = launchPath({ env, appPath: options?.appPath });
  if (!appPath) return false;
  try {
    const contents = fs.readFileSync(desktopFilePath({ env }), 'utf8');
    const execLine = contents.split(/\r?\n/).find((line) => line.startsWith('Exec='));
    const expected = `Exec=${quoteExecArgument(appPath)}`;
    return execLine === expected || execLine === `${expected} ${STARTED_AT_LOGIN_ARG}`;
  }
  catch (_) { return false; }
}

function setAutostartEnabled(enabled, options = {}) {
  const env = options.env || process.env;
  const appPath = launchPath({ env, appPath: options.appPath });
  const filePath = desktopFilePath({ env });
  try {
    if (enabled) {
      if (!appPath) return false;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, desktopFileContents(appPath), 'utf8');
    } else {
      fs.rmSync(filePath, { force: true });
    }
  } catch (_) { /* fall through to report the actual on-disk state */ }
  return isAutostartEnabled({ env, appPath });
}

module.exports = {
  autostartSupported,
  desktopFilePath,
  desktopFileContents,
  isAutostartEnabled,
  setAutostartEnabled,
  STARTED_AT_LOGIN_ARG
};
