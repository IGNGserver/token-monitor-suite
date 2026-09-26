#!/usr/bin/env node
'use strict';

/**
 * Guard for the Android client's Fluent 2 component and layout contract.
 *
 * `verify-android-fluent-contrast.js` proves the *palette* is Fluent and legible.
 * This file proves the *code* is Fluent: which widgets get rendered, which tokens
 * they read their colour and spacing from, and that the Material leftovers only
 * ever shrink.
 *
 * Why a ratchet and not a flat ban: the client is mid-migration across ~10k lines
 * of Compose.  A hard ban would be switched off rather than satisfied, and a
 * hand-maintained exception list would quietly become permanent.  Instead every
 * metric records the count that exists today in `BASELINE`, and any single line of
 * new Material usage, unmeasured colour, or off-grid spacing fails.  Migration
 * progress is then visible as a shrinking diff to this file, which is the point.
 *
 * Each metric also carries a `max: 0` intent where the end state is "gone"; those
 * are marked below so nobody reads a non-zero baseline as an approved steady state.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const UI_ROOT = path.join(
  ROOT,
  'android/app/src/main/java/com/igng/tokenmonitor/android/ui'
);
const THEME_DIR = path.join(UI_ROOT, 'theme');

/** Material 3 widgets whose look is Material's own, token bridge or not. */
const FORBIDDEN_WIDGETS = [
  'Switch',
  'Checkbox',
  'RadioButton',
  'Slider',
  'AlertDialog',
  'BasicAlertDialog',
  'TextField',
  'OutlinedTextField',
  'Button',
  'FilledIconButton',
  'FilledTonalButton',
  'ElevatedButton',
  'OutlinedButton',
  'TextButton',
  'IconButton',
  'FloatingActionButton',
  'Chip',
  'AssistChip',
  'InputChip',
  'SuggestionChip',
  'ElevatedFilterChip',
  'FilterChip',
  'Card',
  'ElevatedCard',
  'OutlinedCard',
  'FilledCard',
  'Surface',
  'CardTopAppBar',
  'CenterAlignedTopAppBar',
  'SmallTopAppBar',
  'MediumTopAppBar',
  'LargeTopAppBar',
  'NavigationBar',
  'NavigationBarItem',
  'NavigationDrawerItem',
  'NavigationRail',
  'NavigationRailItem',
  'TabRow',
  'PrimaryTabRow',
  'SecondaryTabRow',
  'ScrollableTabRow',
  'Divider',
  'HorizontalDivider',
  'VerticalDivider',
  'LinearProgressIndicator',
  'CircularProgressIndicator',
  'DropdownMenu',
  'DropdownMenuItem',
  'ExposedDropdownMenuBox',
  'Snackbar',
  'SnackbarHost',
  'Badge',
  'BadgedBox',
  'Scaffold'
];

/**
 * `Scaffold` is deliberately in the list above even though `TokenMonitorApp.kt`
 * uses it: it earns its place there by owning the snackbar slot layout, and the
 * comment at that call site says so.  The ratchet keeps the count at 1 rather
 * than pretending it is zero.
 */
const BASELINE = {
  // Every one of these must reach 0.  They are non-zero only because the
  // migration is unfinished; lowering a number here is progress, raising one is
  // a regression and fails CI.
  forbiddenWidgetCalls: { cap: 2, why: 'Fluent answers every one of these; see the ' +
    'replacement table in docs/design/android-fluent2-audit.md. Scaffold is the single ' +
    'exception that stays (it owns the snackbar/bottomBar slot layout) and is commented at ' +
    'its call site.' },
  material2Imports: { cap: 0, why: 'Material 2 is never acceptable: it reads its own ' +
    'unbridged palette, which is how the pull-to-refresh spinner shipped a white disc with ' +
    'a #6200EE arrow in dark mode.' },
  materialIconImports: { cap: 0, why: 'Material Symbols are a different icon language from ' +
    'Fluent System Icons. `npm run update:fluent-assets` vendors the Fluent set into ' +
    'res/drawable as vectors; reference them through FluentIcons.' },
  colorSchemeReads: { cap: 0, why: 'Screens read LocalFluentColors; the M3 scheme exists only ' +
    'to feed the leftover library widgets above, so reading it in a screen breaks the bridge.' },
  shapeRoleReads: { cap: 0, why: 'Use FluentShapeDefaults; M3 shape slots do not line up with ' +
    'the Fluent corner ladder.' },
  typographyRoleReads: { cap: 0, why: 'M3 type roles are a ceiling, not an equivalence (both ' +
    'bodyLarge and bodyMedium map to 14/20). Use FluentTypeRamp. The 1 remaining read is in ' +
    'there were none left to remove.' },
  hexInTheme: { cap: 0, why: 'Color.kt is the only place hex lives, because that is the file ' +
    'verify-android-fluent-contrast.js measures. A hex in Theme.kt is an unmeasured colour.' },
  offGridSpacing: { cap: 0, why: 'FluentSpacing is a strict 4 dp design unit.' },
  // Floors, not caps: accessibility must not regress either.
  selectionSemantics: { floor: 15, why: 'selected / role state must be announced, not painted.' },
  focusSemantics: { floor: 16, why: 'Fluent treats focus as a first-class state; these rise as ' +
    'the custom clickables adopt FluentFocusRing.' }
};


function listSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSources(full, out);
    else if (entry.name.endsWith('.kt')) out.push(full);
  }
  return out;
}

/** Count non-overlapping matches, ignoring the two comment forms. */
function countInCode(source, re) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
  let n = 0;
  for (const _match of code.matchAll(re)) n += 1;
  return n;
}

const isThemeFile = (file) => file.startsWith(THEME_DIR + path.sep);

/**
 * Spacing must come from `FluentSpacingDefaults`.  A literal is allowed when it
 * is on the 4 dp grid *and* it is not a decoration hairline / icon box / touch
 * floor, which are sizes rather than rhythm — those are matched by name so the
 * rule stays legible instead of turning into a numbers game.
 */
function measureSpacing(file, source) {
  if (isThemeFile(file)) return 0;
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const callRe = /\.(?:padding|paddingFromBaseline|contentPadding)\(|Spacer\(\s*Modifier\.(?:height|width)\(/;
  const literalRe = /([0-9]+(?:\.[0-9]+)?)\.dp/g;
  let bad = 0;
  for (const line of code.split('\n')) {
    if (!callRe.test(line)) continue;
    // Hairline strokes, icon boxes and the touch floor are sizes, not rhythm.
    if (/(hairline|borderStroke|\.size\(|Icon|touch|indicator|thumb|\bdot\b)/i.test(line)) continue;
    for (const m of line.matchAll(literalRe)) {
      const v = Number(m[1]);
      if (v === 0 || v <= 2) continue;
      if (v % 4 !== 0) bad += 1;
    }
  }
  return bad;
}

function measure() {
  const files = listSources(UI_ROOT).sort();
  const totals = {
    forbiddenWidgetCalls: 0,
    material2Imports: 0,
    materialIconImports: 0,
    colorSchemeReads: 0,
    shapeRoleReads: 0,
    typographyRoleReads: 0,
    hexInTheme: 0,
    offGridSpacing: 0,
    selectionSemantics: 0,
    focusSemantics: 0
  };
  const offenders = new Map();
  const note = (file, metric, line) => {
    const key = `${metric} ${path.relative(ROOT, file)}`;
    if (!offenders.has(key)) offenders.set(key, []);
    offenders.get(key).push(line);
  };

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);

    const widgetRe = new RegExp(
      `(?<![A-Za-z0-9_])(${FORBIDDEN_WIDGETS.join('|')})\\s*\\(`,
      'g'
    );
    const widgets = countInCode(source, widgetRe);
    totals.forbiddenWidgetCalls += widgets;
    if (widgets) note(file, 'forbiddenWidgetCalls', rel);

    totals.material2Imports += countInCode(
      source,
      /^import androidx\.compose\.material\.(?!icons)[A-Za-z0-9_.]*$/gm
    );
    totals.materialIconImports += countInCode(
      source,
      /^import androidx\.compose\.material\.icons\.[A-Za-z0-9_.]*$/gm
    );
    totals.colorSchemeReads += countInCode(source, /MaterialTheme\.colorScheme\./g);
    totals.shapeRoleReads += countInCode(source, /MaterialTheme\.shapes\./g);
    totals.typographyRoleReads += countInCode(source, /MaterialTheme\.typography\./g);
    totals.offGridSpacing += measureSpacing(file, source);
    totals.selectionSemantics += countInCode(
      source,
      /(?:\.selectable|\.toggleable)\(|Role\.(?:Tab|Button|Switch|Checkbox|RadioButton)/g
    );
    totals.focusSemantics += countInCode(
      source,
      /fluentFocusRing|fluentClickable|focusRequester|Modifier\.focusable|collectIsFocusedAsState/g
    );

    if (isThemeFile(file) && rel.endsWith('Theme.kt')) {
      const hex = countInCode(source, /Color\(0x[0-9A-Fa-f]+\)/g);
      totals.hexInTheme += hex;
      if (hex) note(file, 'hexInTheme', rel);
    }
  }
  return { totals, offenders };
}

function main() {
  if (!fs.existsSync(UI_ROOT)) {
    console.error(`Android Fluent guard: source tree not found at ${UI_ROOT}`);
    process.exitCode = 1;
    return;
  }
  const { totals, offenders } = measure();
  const failures = [];

  for (const [metric, rule] of Object.entries(BASELINE)) {
    const now = totals[metric];
    if (typeof now !== 'number') {
      failures.push(`${metric}: not measured — the guard needs updating`);
      continue;
    }
    if ('cap' in rule && now > rule.cap) {
      failures.push(
        `${metric}: ${now} occurrences, cap is ${rule.cap}. Reason it is capped at all: ${rule.why}`
      );
    }
    if ('floor' in rule && now < rule.floor) {
      failures.push(
        `${metric}: ${now}, floor is ${rule.floor}. ${rule.why}`
      );
    }
  }

  const width = Math.max(...Object.keys(BASELINE).map((k) => k.length));
  console.log('Android Fluent 2 boundary guard:');
  for (const [metric, rule] of Object.entries(BASELINE)) {
    const now = totals[metric];
    const bound = 'cap' in rule ? `<=${rule.cap}` : `>=${rule.floor}`;
    const violated = ('cap' in rule && now > rule.cap) || ('floor' in rule && now < rule.floor);
    const slack = 'cap' in rule ? now < rule.cap : now > rule.floor;
    const flag = violated ? 'FAIL' : slack ? `headroom (tighten to ${now})` : 'at limit';
    console.log(`  ${metric.padEnd(width)}  ${String(now).padStart(4)} ${bound.padStart(6)}  ${flag}`);
  }

  if (failures.length > 0) {
    console.error(`\nAndroid Fluent 2 boundary guard failed with ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    const failing = new Set(failures.map((f) => f.split(':')[0]));
    for (const [metric, files] of offenders) {
      if (!failing.has(metric)) continue;
      console.error(`  ${metric} seen in:`);
      for (const f of files) console.error(`    - ${f}`);
    }
    console.error(
      '\nIf a number legitimately belongs where it is, say why in the comment next ' +
        'to that metric — a baseline without a reason is how a migration stalls.'
    );
    process.exitCode = 1;
    return;
  }
  console.log('Android Fluent 2 boundary guard passed.');
}

main();
