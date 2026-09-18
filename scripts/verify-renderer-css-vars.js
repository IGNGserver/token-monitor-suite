#!/usr/bin/env node
'use strict';

// Catch `var(--x)` references that no rule ever defines.
//
// A var() with no fallback makes the declaration invalid at computed-value time,
// so `color: var(--undefined)` silently inherits instead of applying the intended
// theme colour. Three such references existed (--fg), and one of them turned a
// hover rule into a no-op because both sides resolved to the same inherited value.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const STYLESHEETS = [
  'src/electron/renderer/styles.css',
  'src/electron/renderer/dashboard.css',
  'src/hub/web/css/app.css'
];

// Tokens the runtime sets from JS (themePresets.js / the web theme script) or on
// :root in a stylesheet we do not scan. Kept explicit so a typo cannot hide.
const RUNTIME_DEFINED = new Set([
  '--focus-ring',
  '--accent',
  '--accent-rgb'
]);

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function validateStylesheet(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return { relativePath, skipped: true };
  const css = stripComments(fs.readFileSync(filePath, 'utf8'));

  const defined = new Set(RUNTIME_DEFINED);
  for (const match of css.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) defined.add(match[1]);

  const missing = new Set();
  for (const match of css.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g)) {
    const [, name, next] = match;
    // `var(--x, fallback)` degrades gracefully, so only a bare reference is a bug.
    if (next === ',') continue;
    if (!defined.has(name)) missing.add(name);
  }
  return { relativePath, missing: [...missing].sort() };
}

function verifyRendererCssVars() {
  const results = STYLESHEETS.map(validateStylesheet);
  const failures = results.filter((result) => result.missing && result.missing.length > 0);
  if (failures.length > 0) {
    throw new Error(failures
      .map((failure) => `${failure.relativePath} references undefined custom properties: ${failure.missing.join(', ')}`)
      .join('\n'));
  }
  return results.filter((result) => !result.skipped);
}

if (require.main === module) {
  try {
    const results = verifyRendererCssVars();
    console.log(`Verified CSS custom properties in ${results.map((r) => r.relativePath).join(', ')}`);
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = { verifyRendererCssVars, RUNTIME_DEFINED };
