'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const test = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');

const rootPackage = require('../../package.json');

test('shared app version matches the root package version', () => {
  const { appVersion } = require('../../src/shared/appVersion');
  assert.equal(appVersion(), rootPackage.version);
});

test('headless agent dry-run reports the package version', async () => {
  // Every supported tool is tracked unconditionally now, so the dry run reads
  // whatever the host home holds. Point HOME and the XDG dirs at a scratch
  // directory: the assertion is about the version string, not the machine's
  // client data (and a stale tokscale sync lock in the real home would fail the
  // tick by design).
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-agent-home-'));
  try {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        path.join(__dirname, '..', '..', 'src', 'agent', 'agent.js'),
        '--once',
        '--dry-run',
        '--limits=0'
      ], {
        cwd: path.join(__dirname, '..', '..'),
        env: {
          ...process.env,
          TOKEN_MONITOR_HUB_URL: 'http://127.0.0.1:17321',
          HOME: home,
          USERPROFILE: home,
          XDG_CONFIG_HOME: path.join(home, '.config'),
          XDG_DATA_HOME: path.join(home, '.local', 'share')
        },
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
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});