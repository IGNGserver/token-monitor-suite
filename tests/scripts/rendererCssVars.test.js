'use strict';

// Guards the CSS custom-property contract: a `var(--undefined)` with no fallback
// makes the declaration invalid at computed-value time, so the property silently
// inherits. Three such references existed (--fg) and one made a hover rule a no-op
// because both sides resolved to the same inherited colour.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { verifyRendererCssVars } = require('../../scripts/verify-renderer-css-vars');

const rootDir = path.join(__dirname, '..', '..');

test('every CSS custom property reference resolves', () => {
  assert.doesNotThrow(() => verifyRendererCssVars());
});

test('the checker rejects an undefined property', () => {
  // Prove the checker can actually fail, so a green result means something.
  const stylesPath = path.join(rootDir, 'src', 'shared-ui', 'styles', 'app.css');
  const original = fs.readFileSync(stylesPath, 'utf8');
  try {
    fs.writeFileSync(stylesPath, `${original}\n.__css_var_probe { color: var(--definitely-undefined-token); }\n`);
    assert.throws(() => verifyRendererCssVars(), /definitely-undefined-token/);
  } finally {
    fs.writeFileSync(stylesPath, original);
  }
});

test('a var() with a fallback is tolerated', () => {
  const stylesPath = path.join(rootDir, 'src', 'shared-ui', 'styles', 'app.css');
  const original = fs.readFileSync(stylesPath, 'utf8');
  try {
    fs.writeFileSync(stylesPath, `${original}\n.__css_var_probe { color: var(--nope, #fff); }\n`);
    assert.doesNotThrow(() => verifyRendererCssVars());
  } finally {
    fs.writeFileSync(stylesPath, original);
  }
});
