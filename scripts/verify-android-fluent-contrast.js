#!/usr/bin/env node
'use strict';

/**
 * Guard for the Android client's Fluent 2 colour aliases.
 *
 * Two independent checks, because they fail for different reasons:
 *
 *   1. CONTRAST — every text-bearing alias pair must clear WCAG AA 4.5:1, and
 *      every meaning-bearing non-text alias must clear 1.4.11's 3:1.  Measured
 *      from the hex actually in the source file, not from a table.
 *   2. SPEC DRIFT — where the source names the `@fluentui/tokens` key an alias
 *      came from, the hex must still equal that key's value.  This is what stops
 *      the Android ramp silently wandering away from the web/desktop ramp that
 *      `npm run update:fluent-assets` already vendors.
 *
 * Deliberate, measured departures from the official value are listed in
 * `DOCUMENTED_DEVIATIONS` below with their reason.  Anything not listed fails.
 */

const fs = require('node:fs');
const path = require('node:path');
const { webLightTheme, webDarkTheme } = require('@fluentui/tokens');

const ROOT = path.resolve(__dirname, '..');
const COLOR_KT = path.join(
  ROOT,
  'android/app/src/main/java/com/igng/tokenmonitor/android/ui/theme/Color.kt'
);

const TEXT_MIN = 4.5;
const UI_MIN = 3.0;

/**
 * Alias pairs that carry text at <=16sp, so they owe 4.5:1.
 * Background is the surface the component actually paints behind that text.
 */
const TEXT_PAIRS = [
  ['neutralForeground1', 'neutralBackground1'],
  ['neutralForeground1', 'surfaceCard'],
  ['neutralForeground2', 'surfaceCard'],
  ['neutralForeground2', 'neutralLayerInner'],
  ['neutralForeground2', 'neutralBackground2'],
  ['neutralForeground3', 'surfaceCard'],
  ['neutralForeground3', 'neutralLayerInner'],
  ['neutralForeground3', 'subtleBackgroundHover'],
  ['brandForeground1', 'neutralBackground1'],
  ['brandForeground1', 'surfaceCard'],
  ['foregroundOnAccent', 'brandBackground'],
  ['inverseForeground', 'inverseBackground'],
  ['errorForeground', 'neutralBackground1'],
  ['errorForeground', 'surfaceCard'],
  ['successForeground', 'neutralBackground1'],
  ['warningForeground', 'neutralBackground1'],
  ['errorForegroundOnSubtle', 'errorBackground'],
  ['successForegroundOnSubtle', 'successBackground'],
  ['warningForegroundOnSubtle', 'warningBackground'],
  // The accent containers the M3 bridge feeds `primaryContainer` and friends.
  // They exist so the bridge cannot carry a colour this file has not measured —
  // which is exactly what the `Color(0x…)` literals in Theme.kt used to do.
  ['brandContainerForeground', 'brandContainer'],
  ['brandOnInverse', 'inverseBackground']
];

/**
 * Under `System` on Android 12+ the wallpaper is allowed to move the accent.
 * `Color.kt`'s `recolorToLuminance()` bisects to a fixed *relative luminance*
 * per role, so the contrast between any two accent roles is decided by these
 * constants alone and is independent of the hue the user's wallpaper produced.
 * That is what makes the dynamic path measurable at all from Node, and it holds
 * because contrast is `(Lhi + 0.05) / (Llo + 0.05)`.
 *
 * Keep these in sync with the ACCENT_* constants in `Color.kt`.
 */
const ACCENT_LUMINANCE = {
  lightFg1: 0.128,        // ACCENT_FOREGROUND_LIGHT   -> brandForeground1
  lightFg2: 0.098,        // ACCENT_HOVER_LIGHT        -> brandForeground2 / dark brandBackground
  lightPressed: 0.05,     // ACCENT_PRESSED_LIGHT      -> container foreground (light)
  lightContainer: 0.905,  // ACCENT_CONTAINER_LIGHT    -> brandContainer
  darkFg1: 0.37,          // ACCENT_FOREGROUND_DARK    -> brandForeground1 / light brandOnInverse
  darkFg2: 0.46,          // ACCENT_HOVER_DARK         -> container foreground (dark)
  darkContainer: 0.028    // ACCENT_CONTAINER_DARK     -> brandContainer
};

/**
 * Accent pairs that must hold for *any* hue the wallpaper can produce.  Each end
 * is either a role luminance from `ACCENT_LUMINANCE` (hue-independent) or a
 * static alias resolved from the parsed theme, so a hue change moves one end only.
 */
const DYNAMIC_ACCENT_PAIRS = [
  ['light', ['role', 'lightFg1'], ['hex', 'neutralBackground1'], 'brandForeground1 on page'],
  ['light', ['hex', 'foregroundOnAccent'], ['role', 'lightFg1'], 'accent text on accent fill'],
  ['light', ['role', 'lightPressed'], ['role', 'lightContainer'], 'container fg on container'],
  ['light', ['role', 'darkFg1'], ['hex', 'inverseBackground'], 'brandOnInverse on inverse'],
  ['dark', ['role', 'darkFg1'], ['hex', 'neutralBackground1'], 'brandForeground1 on page'],
  ['dark', ['hex', 'foregroundOnAccent'], ['role', 'lightFg2'], 'accent text on accent fill'],
  ['dark', ['role', 'darkFg2'], ['role', 'darkContainer'], 'container fg on container'],
  ['dark', ['role', 'lightFg1'], ['hex', 'inverseBackground'], 'brandOnInverse on inverse']
];

/** Alias pairs that carry state or affordance but no text: 3:1 per 1.4.11. */
const UI_PAIRS = [
  ['neutralStroke1', 'neutralBackground1'], // focus ring, input border, today marker
  ['neutralStroke1', 'surfaceCard'],
  ['brandStroke', 'neutralBackground1']
];

/**
 * Not covered on purpose:
 *  - neutralStroke2 / neutralStroke3: decorative grouping hairlines.  WCAG
 *    1.4.11 does not require decoration to meet 3:1, and Fluent's own subtle
 *    borders sit far below it.
 *  - neutralForeground4 / neutralForegroundDisabled: placeholder and disabled
 *    text, exempt under WCAG 1.4.3 (inactive).
 *  - neutralLayerInner / progress tracks: they are composited neutral alphas or
 *    non-text fills whose *content* (the label) is what carries the meaning.
 */

/** alias -> official token, where the source hex intentionally is not it. */
const DOCUMENTED_DEVIATIONS = {
  dark: {
    errorForeground: {
      officialToken: 'colorStatusDangerForeground1',
      reason:
        'official #dc626d measures 4.16:1 as small text on the dark page surface; lightened to stay under AA'
    },
    neutralBackground1: {
      officialToken: 'colorNeutralBackground1',
      reason: 'AMOLED dark theme adjustment: #141414 provides a deep pitch dark surface while maintaining Fluent hierarchy'
    },
    surfaceCard: {
      officialToken: 'colorNeutralBackground1',
      reason: 'AMOLED dark theme adjustment: #1F1F1F steps up from the page surface (#141414) for clear card contrast'
    },
    surfaceCardContainer: {
      officialToken: 'colorNeutralBackground2',
      reason: 'AMOLED dark theme adjustment: #141414 aligns with deep recessed elements'
    },
    surfaceFlyout: {
      officialToken: 'colorNeutralBackground1',
      reason: 'AMOLED dark theme adjustment: #242424 provides elevated flyout surface above cards'
    },
    neutralLayerInner: {
      officialToken: 'colorNeutralBackground3',
      reason: 'AMOLED dark theme adjustment: #2A2A2A provides quiet inner wells inside cards'
    },
    neutralStroke2: {
      officialToken: 'colorNeutralStroke1',
      reason: 'AMOLED dark theme adjustment: #4A4A4A keeps subtle borders harmonious with #1F1F1F card background'
    },
    neutralStroke3: {
      officialToken: 'colorNeutralStroke2',
      reason: 'AMOLED dark theme adjustment: #333333 keeps hairline dividers harmonious with #1F1F1F card background'
    }
  },
  light: {}
};

function parseAliases(source, instanceName) {
  const start = source.indexOf(`val ${instanceName} = FluentColorTokens(`);
  if (start === -1) throw new Error(`FluentColorTokens instance "${instanceName}" not found`);
  const end = source.indexOf('\n)', start);
  if (end === -1) throw new Error(`Unterminated instance "${instanceName}"`);
  const body = source.slice(start, end);
  const aliases = {};
  const sources = {};
  const lineRe = /(\w+)\s*=\s*argb\("([0-9A-Fa-f]{6})"\)\s*(?:,\s*)?(?:\/\/\s*(.*))?$/;
  for (const line of body.split('\n')) {
    const m = line.match(lineRe);
    if (!m) continue;
    const [, alias, hex, comment] = m;
    aliases[alias] = `#${hex.toLowerCase()}`;
    const named = comment && comment.match(/\b(color[A-Z]\w*)\b/);
    if (named) sources[alias] = named[1];
  }
  return { aliases, sources };
}

function srgbToLinear(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) throw new Error(`only 6-digit hex is supported, got ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function normaliseTokenHex(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^#([0-9a-f]{6})$/i);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function checkContrast(themeName, tokens, failures) {
  const audit = (pairs, min, kind) => {
    for (const [fgAlias, bgAlias] of pairs) {
      const fg = tokens[fgAlias];
      const bg = tokens[bgAlias];
      if (!fg || !bg) {
        failures.push(`${themeName}: missing alias in ${kind} pair ${fgAlias}/${bgAlias}`);
        continue;
      }
      const ratio = contrast(fg, bg);
      if (ratio < min) {
        failures.push(
          `${themeName} ${kind}: ${fgAlias} on ${bgAlias} = ${ratio.toFixed(2)}:1 (needs ${min}:1) [${fg} on ${bg}]`
        );
      }
    }
  };
  audit(TEXT_PAIRS, TEXT_MIN, 'text');
  audit(UI_PAIRS, UI_MIN, 'non-text');
}

function checkSpecDrift(themeName, parsed, officialTheme, allowedDeviations, failures) {
  for (const [alias, tokenName] of Object.entries(parsed.sources)) {
    if (!(tokenName in officialTheme)) {
      failures.push(`${themeName}: ${alias} cites "${tokenName}" which is not an @fluentui/tokens key`);
      continue;
    }
    if (allowedDeviations[alias]) continue; // recorded + reasoned below
    const official = normaliseTokenHex(officialTheme[tokenName]);
    // rgba()/ms-/px- tokens have no hex equivalent to compare against.
    if (!official) continue;
    if (parsed.aliases[alias] !== official) {
      failures.push(
        `${themeName}: ${alias} is ${parsed.aliases[alias]} but official ${tokenName} is ${official} ` +
          `(update the value, or record a reasoned deviation in DOCUMENTED_DEVIATIONS)`
      );
    }
  }
}

/**
 * Every theme seed may retint the accent, and only the accent.  A seed whose
 * foreground is illegible on a surface would put the theme picker in the position
 * of shipping a failing contrast, so the check runs over each seed rather than
 * just the default blue.
 */
function checkBrandSeeds(source, themes, failures) {
  const blockStart = source.indexOf('val FluentBrandSeeds');
  if (blockStart === -1) {
    failures.push('brand seeds: `val FluentBrandSeeds` not found')
    return;
  }
  const block = source.slice(blockStart, source.indexOf('\n)\n', blockStart));
  const seedBlocks = block.split('FluentBrandSeed(').slice(1);
  if (seedBlocks.length === 0) {
    failures.push('brand seeds: none parsed — the extractor needs updating');
    return;
  }
  for (const chunk of seedBlocks) {
    const id = (chunk.match(/id = "(\w+)"/) || [])[1];
    if (!id) continue;
    const grab = (key) => (chunk.match(new RegExp(`${key} = argb\\("([0-9A-Fa-f]{6})"\\)`)) || [])[1];
    const read = (prefix) => ({
      foreground: grab(`${prefix}Foreground`),
      foregroundHover: grab(`${prefix}ForegroundHover`),
      background: grab(`${prefix}Background`),
      backgroundHover: grab(`${prefix}BackgroundHover`)
    });
    const light = read('light');
    const dark = read('dark');
    const cases = [
      ['light', id, light, themes.light],
      ['dark', id, dark, themes.dark]
    ];
    for (const [themeName, seedId, seed, tokens] of cases) {
      if (!seed.foreground || !seed.background) {
        failures.push(`${themeName} seed ${seedId}: could not parse accent ramp`);
        continue;
      }
      const checks = [
        [`seed ${seedId} brandForeground1 on page`, `#${seed.foreground}`, tokens.neutralBackground1],
        [`seed ${seedId} brandForeground1 on card`, `#${seed.foreground}`, tokens.surfaceCard],
        [`seed ${seedId} brandForeground2 on page`, `#${seed.foregroundHover}`, tokens.neutralBackground1],
        [
          `seed ${seedId} accent text on brandBackground`,
          tokens.foregroundOnAccent,
          `#${seed.background}`
        ]
      ];
      for (const [label, fg, bg] of checks) {
        if (!fg || !bg) continue;
        const ratio = contrast(fg, bg);
        if (ratio < TEXT_MIN) {
          failures.push(`${themeName} ${label}: ${ratio.toFixed(2)}:1 (needs ${TEXT_MIN}:1)`);
        }
      }
    }
  }
}

/**
 * The dynamic-accent invariant.  Unlike everything above, this cannot be measured
 * from hex — under `System` on Android 12+ there is no fixed hex until the
 * wallpaper has been sampled.  It is proved instead from the luminance targets
 * `Color.kt`'s `recolorToLuminance()` bisects to, which are the same constants on
 * both sides of this file.  If a role's target moves here, the ratio moves, and
 * that is exactly the failure that would otherwise only appear on one device.
 */
function checkDynamicAccent(themes, failures) {
  const resolve = (theme, ref) => {
    if (ref[0] === 'role') {
      const v = ACCENT_LUMINANCE[ref[1]];
      if (typeof v !== 'number') throw new Error(`unknown accent role "${ref[1]}"`);
      return v;
    }
    const hex = theme[ref[1]];
    if (!hex) throw new Error(`missing alias "${ref[1]}"`);
    return luminance(hex);
  };
  for (const [themeName, a, b, label] of DYNAMIC_ACCENT_PAIRS) {
    const tokens = themes[themeName];
    if (!tokens) {
      failures.push(`dynamic accent: unknown theme "${themeName}"`);
      continue;
    }
    let la;
    let lb;
    try {
      la = resolve(tokens, a);
      lb = resolve(tokens, b);
    } catch (e) {
      failures.push(`dynamic accent ${themeName} ${label}: ${e.message}`);
      continue;
    }
    const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    if (ratio < TEXT_MIN) {
      failures.push(
        `${themeName} dynamic accent: ${label} = ${ratio.toFixed(2)}:1 at the fixed ` +
          `luminance targets (needs ${TEXT_MIN}:1) — adjust the ACCENT_* targets, in ` +
          `both this file and Color.kt, together`
      );
    }
  }
}

function verifyAndroidFluentContrast() {
  const source = fs.readFileSync(COLOR_KT, 'utf8');
  const light = parseAliases(source, 'FluentLightColors');
  const dark = parseAliases(source, 'FluentDarkColors');

  const failures = [];
  const required = ['neutralForeground1', 'neutralBackground1', 'surfaceCard', 'neutralLayerInner'];
  for (const [name, parsed] of [['light', light], ['dark', dark]]) {
    for (const alias of required) {
      if (!parsed.aliases[alias]) failures.push(`${name}: required alias ${alias} not parsed`);
    }
    checkContrast(name, parsed.aliases, failures);
    checkSpecDrift(
      name,
      parsed,
      name === 'light' ? webLightTheme : webDarkTheme,
      DOCUMENTED_DEVIATIONS[name],
      failures
    );
  }
  const themes = { light: light.aliases, dark: dark.aliases };
  checkBrandSeeds(source, themes, failures);
  checkDynamicAccent(themes, failures);

  const lightCount = Object.keys(light.aliases).length;
  const darkCount = Object.keys(dark.aliases).length;
  const cited = Object.keys(light.sources).length + Object.keys(dark.sources).length;
  console.log(
    `Fluent 2 Android colour guard: ${lightCount}+${darkCount} aliases, ` +
      `${cited} citing an official token, ` +
      `${TEXT_PAIRS.length * 2} text pairs + ${UI_PAIRS.length * 2} non-text pairs + ` +
      `${DYNAMIC_ACCENT_PAIRS.length} hue-independent accent pairs checked.`
  );
  for (const [theme, deviations] of Object.entries(DOCUMENTED_DEVIATIONS)) {
    for (const [alias, info] of Object.entries(deviations)) {
      console.log(`  deviation (measured): ${theme}.${alias} <- ${info.officialToken}: ${info.reason}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nFluent 2 colour guard failed with ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log('Fluent 2 colour guard passed: contrast contract + spec conformance hold.');
}

verifyAndroidFluentContrast();
