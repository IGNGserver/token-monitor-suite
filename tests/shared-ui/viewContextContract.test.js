'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sharedRoot = path.join(__dirname, '../../src/shared-ui');
const viewsRoot = path.join(sharedRoot, 'views');
const appSource = fs.readFileSync(path.join(sharedRoot, 'app.js'), 'utf8');
const { configureViewContext, VIEW_HELPER_NAMES } = require('../../src/shared-ui/core/viewContext.js');

function viewHelperNames() {
  const names = new Set();
  for (const file of fs.readdirSync(viewsRoot).filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(viewsRoot, file), 'utf8');
    for (const match of source.matchAll(/viewHelper\('([^']+)'\)/g)) names.add(match[1]);
  }
  return [...names].sort();
}

test('all extracted view helpers are declared in the shared context contract', () => {
  assert.deepEqual(viewHelperNames(), [...VIEW_HELPER_NAMES].sort());
});

test('the app installs every helper before it renders a view', () => {
  const block = appSource.match(/configureViewContext\(\{([\s\S]*?)\n\s*\}, \{ requiredHelpers:/)?.[1];
  assert.ok(block, 'app.js should validate its view context during boot');
  for (const name of VIEW_HELPER_NAMES) {
    assert.match(block, new RegExp(`\\b${name}\\b`), `missing ${name} from app view context`);
  }
});

test('strict view-context validation reports a missing helper', () => {
  assert.throws(
    () => configureViewContext({ tr() {} }, { requiredHelpers: ['renderTokenMix'] }),
    /missing view helpers: renderTokenMix/
  );
});
