'use strict';

// The desktop client is a normal application, not an always-on-top widget.
// These assertions are static so they cost nothing, and they pin the properties
// that made it a widget in the first place — each one is easy to reintroduce by
// copying a window option from the old code.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const main = fs.readFileSync(path.join(root, 'src', 'electron', 'main.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('the main window is framed, resizable and present in the taskbar', () => {
  const start = main.indexOf('function createWindow(');
  const end = main.indexOf('mainWindow = win;', start);
  assert.ok(start >= 0 && end > start, 'createWindow should be present');
  // Strip comments: the block explains which widget options were removed, and
  // that prose must not satisfy or trip the assertions.
  const body = main.slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  assert.doesNotMatch(body, /frame:\s*false/, 'a normal window keeps its frame');
  assert.doesNotMatch(body, /transparent:\s*true/, 'a normal window is not transparent');
  assert.doesNotMatch(body, /skipTaskbar/, 'a normal window appears in the taskbar/Dock');
  assert.doesNotMatch(body, /alwaysOnTop/, 'the window must not float above other apps');
  assert.doesNotMatch(body, /resizable:\s*false/, 'a normal window is resizable');
});

test('the window has a usable minimum size for the sidebar layout', () => {
  const limits = main.match(/const WINDOW_LIMITS = \{([^}]+)\}/);
  assert.ok(limits, 'WINDOW_LIMITS should exist');
  const minWidth = Number((limits[1].match(/minWidth:\s*(\d+)/) || [])[1]);
  const minHeight = Number((limits[1].match(/minHeight:\s*(\d+)/) || [])[1]);
  // The shared UI's narrowest breakpoint is 860px; a smaller floor would clip it.
  assert.ok(minWidth >= 860, `minimum width ${minWidth} is below the UI's narrowest layout`);
  assert.ok(minHeight >= 500, `minimum height ${minHeight} is too small for the content`);
});

test('the app no longer declares itself as a macOS accessory', () => {
  assert.equal(pkg.build.mac.extendInfo, undefined, 'LSUIElement must be gone or the app cannot be focused or Cmd-Tabbed to');
});

test('closing the window quits instead of hiding to a tray or popover', () => {
  const start = main.indexOf("win.on('close'");
  assert.ok(start >= 0, 'a close handler should exist');
  const body = main.slice(start, start + 500);
  assert.doesNotMatch(body, /hidePopover\(\)/, 'close must not collapse into a tray popover');
  assert.doesNotMatch(body, /win\.hide\(\)/, 'close must not hide the window');
});

test('the packaged app ships the shared UI', () => {
  assert.ok(
    pkg.build.files.includes('src/shared-ui/**/*'),
    'the renderer loads src/shared-ui, so it must be packaged'
  );
});

test('the CSP admits the shared UI styling without loosening scripts', () => {
  const csp = main.slice(main.indexOf('const CSP_HEADER'), main.indexOf('const TRAY_CONTENT_VALUES'));
  // View templates set per-row colours and bar widths inline.
  assert.match(csp, /style-src 'self' 'unsafe-inline'/, 'inline styles are required by the shared view templates');
  assert.match(csp, /script-src 'self'"(?!.*unsafe-inline)/, 'script-src must stay strict');
  assert.doesNotMatch(csp, /script-src[^"]*unsafe-inline/, 'inline script must remain blocked');
});

test('the app installs a menu with the standard roles', () => {
  const menu = fs.readFileSync(path.join(root, 'src', 'electron', 'appMenu.js'), 'utf8');
  for (const role of ['undo', 'copy', 'paste', 'reload', 'zoomIn', 'minimize', 'togglefullscreen']) {
    assert.ok(menu.includes(`role: '${role}'`), `the menu should provide the ${role} role`);
  }
  assert.ok(main.includes('createAppMenu('), 'the menu must be installed at startup');
});
