'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');

const rootPackage = require('../../package.json');

test('shared app version matches the root package version', () => {
  const { appVersion } = require('../../src/shared/appVersion');
  assert.equal(appVersion(), rootPackage.version);
});

test('headless agent dry-run reports the package version', async () => {
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join(__dirname, '..', '..', 'src', 'agent', 'agent.js'),
      '--once',
      '--dry-run',
      '--clients=',
      '--limits=0'
    ], {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, TOKEN_MONITOR_HUB_URL: 'http://127.0.0.1:17321' },
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`agent exited ${code}: ${stderr || stdout}`));
      resolve(stdout);
    });
  });
  const jsonStart = output.indexOf('{');
  assert.notEqual(jsonStart, -1);
  const summary = JSON.parse(output.slice(jsonStart));
  assert.equal(summary.agentVersion, rootPackage.version);
  assert.equal(summary.agentRuntime, 'headless-agent');
});
