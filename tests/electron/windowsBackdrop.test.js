'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const main = fs.readFileSync(path.join(root, 'src/electron/main.js'), 'utf8');
const rendererDir = path.join(root, 'src/electron/renderer');
const app = fs.readFileSync(path.join(rendererDir, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(rendererDir, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(rendererDir, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(rendererDir, 'i18n.js'), 'utf8');
const {
  DEFAULT_ACCENT_ARGB,
  applyWindowsAccentBlur,
  createAccentApi
} = require('../../src/electron/windowsBackdrop');
const {
  normalizeWindowsBackdropMode,
  windowsNativeBackdropSupported,
  windowsSurfaceProfile
} = require('../../src/electron/windowsBackdropMode');
const {
  appearanceState,
  nativePopoverAlpha,
  nativePopoverBlur,
  normalizeWindowsBackdropMode: normalizeRendererMode
} = require('../../src/electron/renderer/windowsGlass');

test('Windows backdrop modes fail closed to documented Acrylic', () => {
  assert.equal(normalizeRendererMode, normalizeWindowsBackdropMode);
  for (const value of [undefined, null, '', 'nope', 'ACRYLIC', 'tabbed', 'accent']) {
    assert.equal(normalizeWindowsBackdropMode(value), 'acrylic');
    assert.equal(normalizeRendererMode(value), 'acrylic');
  }
  assert.equal(normalizeWindowsBackdropMode('mica'), 'mica');
  assert.equal(normalizeRendererMode('mica'), 'mica');
});

test('Windows glass appearance state covers platform boundaries', () => {
  assert.deepEqual(appearanceState({}, { isWindows: false }), {
    surface: 'none',
    nativeBackdrop: false,
    useLegacyAccent: false,
    showBackdropControl: false,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'acrylic'
  });
  assert.deepEqual(appearanceState({}, { isWindows: true }), {
    surface: 'win10-fallback',
    nativeBackdrop: false,
    useLegacyAccent: true,
    showBackdropControl: false,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'acrylic'
  });
  assert.deepEqual(appearanceState({ windowsSurface: 'mica' }, { isWindows: true }), {
    surface: 'mica',
    nativeBackdrop: true,
    useLegacyAccent: false,
    showBackdropControl: false,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'acrylic'
  });
  assert.deepEqual(appearanceState({ windowsSurface: 'win10-fallback' }, { isWindows: true }), {
    surface: 'win10-fallback',
    nativeBackdrop: false,
    useLegacyAccent: true,
    showBackdropControl: false,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'acrylic'
  });
  assert.deepEqual(appearanceState({ systemGlass: false, windowsSurface: 'mica' }, { isWindows: true }), {
    surface: 'none',
    nativeBackdrop: false,
    useLegacyAccent: false,
    showBackdropControl: false,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'acrylic'
  });
});

test('Windows native material leaves the whole-window surface to DWM', () => {
  assert.equal(nativePopoverAlpha({ lightTheme: false, surface: 'mica' }), 0.78);
  assert.equal(nativePopoverAlpha({ lightTheme: true, surface: 'mica' }), 0.9);
  assert.equal(nativePopoverAlpha({ lightTheme: false, surface: 'win10-fallback' }), 0.78);
  assert.equal(nativePopoverAlpha({ lightTheme: true, surface: 'win10-fallback' }), 0.88);
  assert.equal(nativePopoverBlur({ surface: 'mica' }), 28);
  assert.equal(nativePopoverBlur({ surface: 'win10-fallback' }), 30);
});

test('Windows surface profile selects Mica only for Windows 11 22H2+', () => {
  assert.equal(windowsNativeBackdropSupported({ platform: 'win32', osRelease: '10.0.22000' }), false);
  assert.equal(windowsNativeBackdropSupported({ platform: 'win32', osRelease: '10.0.22621' }), true);
  assert.equal(windowsNativeBackdropSupported({ platform: 'linux', osRelease: '10.0.22621' }), false);
  assert.deepEqual(windowsSurfaceProfile({ platform: 'win32', osRelease: '10.0.22621', systemGlass: true }), {
    kind: 'mica',
    nativeBackdrop: true,
    nativeMaterial: 'mica',
    useLegacyAccent: false
  });
  assert.deepEqual(windowsSurfaceProfile({ platform: 'win32', osRelease: '10.0.19045', systemGlass: true }), {
    kind: 'win10-fallback',
    nativeBackdrop: false,
    nativeMaterial: null,
    useLegacyAccent: true
  });
  assert.deepEqual(windowsSurfaceProfile({ platform: 'win32', osRelease: '10.0.22621', systemGlass: false }), {
    kind: 'none',
    nativeBackdrop: false,
    nativeMaterial: null,
    useLegacyAccent: false
  });
});

test('Accent blur passes the native HWND and configured tint to the native adapter', () => {
  const calls = [];
  const handle = Buffer.alloc(8);
  handle.writeBigUInt64LE(0x12345678n);
  const win = {
    getNativeWindowHandle: () => handle,
    isDestroyed: () => false
  };
  const api = {
    apply(hwnd, argb) {
      calls.push({ hwnd, argb });
      return true;
    }
  };

  assert.equal(applyWindowsAccentBlur(win, { platform: 'win32', api }), true);
  assert.deepEqual(calls, [{ hwnd: 0x12345678n, argb: DEFAULT_ACCENT_ARGB }]);
  assert.equal(applyWindowsAccentBlur(win, { platform: 'darwin', api }), false);
  assert.equal(applyWindowsAccentBlur({ ...win, isDestroyed: () => true }, { platform: 'win32', api }), false);
});

test('native Accent adapter enables a full blur region before applying policy and extending the frame', () => {
  const calls = [];
  const region = { pointer: 'region' };
  const fakeFunctions = {
    CreateRectRgn: (...args) => { calls.push(['region', ...args]); return region; },
    DwmEnableBlurBehindWindow: (_hwnd, value) => { calls.push(['blur', value]); return 0; },
    SetWindowCompositionAttribute: (_hwnd, value) => { calls.push(['accent', value]); return true; },
    DwmExtendFrameIntoClientArea: (_hwnd, value) => { calls.push(['frame', value]); return 0; },
    DeleteObject: (value) => { calls.push(['delete', value]); return true; }
  };
  const koffi = {
    load: () => ({
      func(signature) {
        const name = signature.match(/([A-Za-z0-9_]+)\(/)?.[1];
        return fakeFunctions[name];
      }
    }),
    struct: (name, fields) => ({ name, fields }),
    as: (value, type) => ({ value, type }),
    sizeof: () => 16
  };
  const api = createAccentApi(koffi);

  assert.equal(api.apply(7n, DEFAULT_ACCENT_ARGB), true);
  assert.deepEqual(calls.map(([name]) => name), ['region', 'blur', 'frame', 'accent', 'delete']);
  assert.equal(calls[1][1].dwFlags, 7);
  assert.equal(calls[1][1].hRgnBlur, region);
  assert.deepEqual(calls[2][1], {
    cxLeftWidth: -1,
    cxRightWidth: -1,
    cyTopHeight: -1,
    cyBottomHeight: -1
  });
  assert.equal(calls[3][1].Attrib, 19);
  assert.deepEqual(calls[3][1].pvData.value, {
    AccentState: 4,
    AccentFlags: 0,
    GradientColor: DEFAULT_ACCENT_ARGB,
    AnimationId: 0
  });
});

test('native Accent adapter rejects failed DWM setup before applying the Accent policy', () => {
  function run({ blurResult = 0, frameResult = 0 }) {
    const calls = [];
    const fakeFunctions = {
      CreateRectRgn: () => { calls.push('region'); return {}; },
      DwmEnableBlurBehindWindow: () => { calls.push('blur'); return blurResult; },
      DwmExtendFrameIntoClientArea: () => { calls.push('frame'); return frameResult; },
      SetWindowCompositionAttribute: () => { calls.push('accent'); return true; },
      DeleteObject: () => { calls.push('delete'); return true; }
    };
    const koffi = {
      load: () => ({
        func(signature) {
          return fakeFunctions[signature.match(/([A-Za-z0-9_]+)\(/)?.[1]];
        }
      }),
      struct: (name, fields) => ({ name, fields }),
      as: (value, type) => ({ value, type }),
      sizeof: () => 16
    };
    return { result: createAccentApi(koffi).apply(7n, DEFAULT_ACCENT_ARGB), calls };
  }

  assert.deepEqual(run({ blurResult: -1 }), {
    result: false,
    calls: ['region', 'blur', 'delete']
  });
  assert.deepEqual(run({ frameResult: -1 }), {
    result: false,
    calls: ['region', 'blur', 'frame', 'delete']
  });
  assert.deepEqual(run({ blurResult: 1, frameResult: 1 }), {
    result: true,
    calls: ['region', 'blur', 'frame', 'accent', 'delete']
  });
});

test('main process configures an automatic Windows surface profile', () => {
  assert.match(main, /windowsBackdrop: 'acrylic',/);
  assert.match(main, /windowsBackdrop: normalizeWindowsBackdropMode\(patch\.windowsBackdrop \?\? settings\.windowsBackdrop\)/);
  assert.match(main, /windowsSurfaceProfile\(/);
  assert.match(main, /backgroundMaterial: windowsSurface\.nativeMaterial/);
  assert.match(main, /if \(windowsSurface\.useLegacyAccent\) applyWindowsAccentBlur\(win\)/);
  assert.match(main, /windowsSurface: windowsSurface\.kind/);
});

test('Windows exposes automatic glass without a material selector', () => {
  assert.match(html, /name="systemGlassOption"/);
  assert.match(html, /id="glassInput"/);
  assert.match(html, /id="blurInput"/);
  assert.doesNotMatch(html, /windowsBackdropRow|windowsBackdropInput|windowsBackdropNote/);
  assert.match(html, /<script src="\.\.\/windowsBackdropMode\.js"><\/script>[\s\S]*<script src="windowsGlass\.js"><\/script>[\s\S]*<script src="app\.js"><\/script>/);
  assert.doesNotMatch(app, /windowsBackdropRow|windowsBackdropInput|windowsBackdropNote/);
  assert.match(app, /windowsGlass\.nativeBackdrop/);
  assert.match(app, /windowsGlass\.surface/);
  assert.doesNotMatch(app, /windowsBackdropUnsupported/);
  assert.doesNotMatch(i18n, /settings\.appearance\.windowsBackdrop/);
  assert.doesNotMatch(css, /windows-native-blur-only/);
  assert.match(css, /--windows-popover-alpha/);
  assert.match(css, /--windows-popover-blur/);
  assert.match(css, /html\.is-windows\[data-windows-surface="mica"\] \.shell[\s\S]*background:\s*transparent/);
  assert.match(css, /html\.is-windows\[data-windows-surface="win10-fallback"\] \.shell[\s\S]*windows-fallback-alpha/);
  assert.match(css, /html\.is-windows\[data-windows-surface\] \.floating-bubble-tab[\s\S]*windows-popover-alpha/);
  assert.match(app, /nativePopoverAlpha/);
  assert.match(app, /nativePopoverBlur/);
  assert.match(app, /const themeColors = settings && 'themeColors' in settings/);
  assert.match(app, /applyThemeColors\(themeColors, \{ nativeBackdrop: nativeWindowsBackdropEnabled \}\)/);
  assert.doesNotMatch(app, /nativeSurfaceAlphas/);
  assert.doesNotMatch(css, /background:\s*rgba\(var\(--glass-rgb\),\s*0\.35\)/);
  assert.doesNotMatch(css, /background:\s*rgba\(var\(--glass-rgb\),\s*0\.45\)/);
  assert.match(main, /windowsSurfaceProfile\([\s\S]*systemGlass: glass/);
  assert.match(main, /windowsSurfaceProfile\([\s\S]*osRelease: os\.release\(\)/);
});

test('Win10 Accent enhancement remains best effort behind the CSS fallback', () => {
  assert.match(main, /applyWindowsAccentBlur\(win\)/);
  assert.match(css, /data-windows-surface="win10-fallback"/);
  assert.doesNotMatch(css, /windowsBackdropNote/);
});

test('normalizeWindowsBackdropMode accepts mica and acrylic', () => {
  const {
    normalizeWindowsBackdropMode,
    windowsElectronBackgroundMaterial,
    WINDOWS_BACKDROP_MICA,
    WINDOWS_BACKDROP_ACRYLIC
  } = require('../../src/electron/windowsBackdropMode');
  assert.equal(normalizeWindowsBackdropMode('mica'), WINDOWS_BACKDROP_MICA);
  assert.equal(normalizeWindowsBackdropMode('acrylic'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(normalizeWindowsBackdropMode('tabbed'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(normalizeWindowsBackdropMode('accent'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(normalizeWindowsBackdropMode('nope'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(windowsElectronBackgroundMaterial('mica'), 'mica');
  assert.equal(windowsElectronBackgroundMaterial('acrylic'), 'acrylic');
  assert.equal(windowsElectronBackgroundMaterial('tabbed'), 'acrylic');
});
