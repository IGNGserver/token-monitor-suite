'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..', '..');
const { DEFAULT_CLIENTS } = require('../../src/shared/clientTracking');

// Client id -> icon name mappings when they differ
const CLIENT_TO_ICON = {
  'hermes': 'hermes-agent',
  'deepseek-harness': 'deepseek-harness',
  'grok': 'xai',
  'devin-cli': 'devin',
  'devin-desktop': 'devin',
  'codebuff': 'codebuff',
  'freebuff': 'codebuff',
  'pi': 'pi',
  'omp': 'pi'
};

test('README supported-tools table covers every default tracked client', () => {
  const readmeText = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
  const rows = readmeText.split('\n').filter((line) => line.startsWith('| <img'));

  const tableIconIds = new Set(
    rows.map((row) => {
      const match = row.match(/tools-icon\/([^".]+)\.[a-z]+"/i);
      return match ? match[1] : null;
    }).filter(Boolean)
  );

  const defaultClients = DEFAULT_CLIENTS.split(',').map((c) => c.trim()).filter(Boolean);

  const missing = [];
  for (const client of defaultClients) {
    const expectedIcon = CLIENT_TO_ICON[client] || client;
    if (!tableIconIds.has(expectedIcon)) {
      missing.push(client);
    }
  }

  assert.deepEqual(missing, [], `Default clients missing from README table: ${missing.join(', ')}`);
});
