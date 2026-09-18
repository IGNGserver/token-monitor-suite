'use strict';

// The packaged app ships every Chromium locale pack (~42 MB of a 139 MB AppImage)
// even though the UI offers six languages. Chromium falls back to en-US.pak for
// anything removed, so pruning is safe; this pins the behaviour so a config
// refactor cannot silently reintroduce the waste.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const config = require('../../scripts/electron-builder.config');

const KEPT = ['en-US', 'en-GB', 'zh-CN', 'zh-TW', 'ko', 'ja'];
const DROPPED = ['de', 'fr', 'ru', 'ar', 'th', 'vi', 'pt-BR', 'ja-JP'];

test('afterPack prunes Chromium locales the UI cannot select', async () => {
  const appOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locale-prune-'));
  const localesDir = path.join(appOutDir, 'locales');
  fs.mkdirSync(localesDir);
  for (const name of [...KEPT, ...DROPPED]) {
    fs.writeFileSync(path.join(localesDir, `${name}.pak`), 'pak');
  }
  // A non-.pak file must be left alone.
  fs.writeFileSync(path.join(localesDir, 'README.txt'), 'keep');

  assert.equal(typeof config.afterPack, 'function');
  await config.afterPack({ appOutDir });

  const remaining = fs.readdirSync(localesDir).sort();
  for (const name of KEPT) {
    assert.ok(remaining.includes(`${name}.pak`), `${name}.pak should be kept`);
  }
  for (const name of DROPPED) {
    assert.ok(!remaining.includes(`${name}.pak`), `${name}.pak should be pruned`);
  }
  assert.ok(remaining.includes('README.txt'), 'non-locale files must not be touched');
});

test('afterPack tolerates a platform layout with no locales directory', async () => {
  const appOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locale-prune-empty-'));
  await assert.doesNotReject(() => config.afterPack({ appOutDir }));
});
