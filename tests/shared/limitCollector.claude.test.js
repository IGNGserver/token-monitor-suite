'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { claudeCommandCandidates, fetchClaudeLimits, mapClaudeCliUsageToProvider, mapClaudeUsageToProvider } = require('../../src/shared/limitCollector');

function fakeSpawnForClaudeUsage(expectedCommand = 'claude.cmd') {
  return (command, args) => {
    assert.equal(command, expectedCommand);
    assert.deepEqual(args, ['/usage']);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => {
      child.stdout.emit('data', Buffer.from([
        'Current session',
        '95% left',
        'Resets 6pm',
        'Current week',
        '80% left',
        'Resets Jun 18'
      ].join('\n')));
      child.emit('close', 0);
    });
    return child;
  };
}

test('Claude limits fall back to direct CLI usage on Windows when OAuth usage is unavailable', async () => {
  const provider = await fetchClaudeLimits({}, {
    platform: 'win32',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    claudeCredentialPath: 'C:\\Users\\Javis\\.claude\\.credentials.json',
    stat: async () => ({ mtimeMs: 1 }),
    readFile: async () => JSON.stringify({
      claudeAiOauth: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.parse('2026-06-12T00:00:00Z')
      }
    }),
    fetch: async () => ({
      ok: false,
      status: 500
    }),
    existsSync: () => false,
    spawn: fakeSpawnForClaudeUsage()
  });

  assert.equal(provider.provider, 'claude');
  assert.equal(provider.status, 'ok');
  assert.equal(provider.source, 'cli');
  assert.equal(provider.windows[0].kind, 'session');
  assert.equal(provider.windows[0].usedPercent, 5);
  assert.equal(provider.windows[1].kind, 'weekly');
  assert.equal(provider.windows[1].usedPercent, 20);
});

test('Claude limits fall back to CLI usage when OAuth credentials are not discoverable', async () => {
  let cliCalls = 0;
  const provider = await fetchClaudeLimits({}, {
    platform: 'darwin',
    now: () => Date.parse('2026-07-15T00:00:00Z'),
    claudeCredentialPath: '/tmp/missing-claude-credentials.json',
    stat: async () => {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    },
    readMacKeychain: false,
    runClaudeUsageCli: async () => {
      cliCalls += 1;
      return [
        'Current session',
        '95% left',
        'Resets 6pm',
        'Current week',
        '80% left',
        'Resets Jul 22'
      ].join('\n');
    }
  });

  assert.equal(cliCalls, 1);
  assert.equal(provider.provider, 'claude');
  assert.equal(provider.status, 'ok');
  assert.equal(provider.source, 'cli');
  assert.equal(provider.windows[0].usedPercent, 5);
  assert.equal(provider.windows[1].usedPercent, 20);
});

test('Claude limits read Windows Credential Manager credentials when credential files are absent', async () => {
  const provider = await fetchClaudeLimits({}, {
    platform: 'win32',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    claudeCredentialPath: 'C:\\Users\\Javis\\.claude\\.credentials.json',
    stat: async () => {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    },
    readWindowsCredentialSecret: async (service, targets) => {
      assert.equal(service, 'Claude Code-credentials');
      assert.equal(targets.includes('Claude Code-credentials'), true);
      return JSON.stringify({
        claudeAiOauth: {
          accessToken: 'credential-manager-token',
          refreshToken: 'credential-manager-refresh',
          expiresAt: Date.parse('2026-06-12T00:00:00Z'),
          subscriptionType: 'max',
          rateLimitTier: 'default_claude_max_5x'
        }
      });
    },
    fetch: async (_url, options) => {
      assert.equal(options.headers.authorization, 'Bearer credential-manager-token');
      return {
        ok: true,
        json: async () => ({
          five_hour: {
            utilization: 12,
            resets_at: '2026-06-11T05:00:00Z'
          }
        })
      };
    }
  });

  assert.equal(provider.provider, 'claude');
  assert.equal(provider.status, 'ok');
  assert.equal(provider.source, 'oauth');
  assert.equal(provider.accountLabel, 'Max 5x');
  assert.equal(provider.windows[0].usedPercent, 12);
});

test('Claude OAuth usage mapping accepts camelCase response fields', async () => {
  const provider = await fetchClaudeLimits({}, {
    platform: 'linux',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    claudeCredentialPath: '/tmp/claude-credentials.json',
    stat: async () => ({ mtimeMs: 1 }),
    readFile: async () => JSON.stringify({
      claudeAiOauth: {
        accessToken: 'access-token',
        expiresAt: Date.parse('2026-06-12T00:00:00Z')
      }
    }),
    fetch: async () => ({
      ok: true,
      json: async () => ({
        fiveHour: {
          utilization: 34,
          resetsAt: '2026-06-11T05:00:00Z'
        },
        sevenDay: {
          utilization: 56,
          resetsAt: '2026-06-18T00:00:00Z'
        }
      })
    })
  });

  assert.equal(provider.windows[0].kind, 'session');
  assert.equal(provider.windows[0].usedPercent, 34);
  assert.equal(provider.windows[0].resetsAt, '2026-06-11T05:00:00.000Z');
  assert.equal(provider.windows[1].kind, 'weekly');
  assert.equal(provider.windows[1].usedPercent, 56);
  assert.equal(provider.windows[1].resetsAt, '2026-06-18T00:00:00.000Z');
});

test('Claude OAuth usage mapping preserves fractional percentage utilization values', async () => {
  let cliCalls = 0;
  const provider = await fetchClaudeLimits({}, {
    platform: 'darwin',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    claudeCredentialPath: '/tmp/claude-credentials.json',
    stat: async () => ({ mtimeMs: 1 }),
    readFile: async () => JSON.stringify({
      claudeAiOauth: {
        accessToken: 'access-token',
        expiresAt: Date.parse('2026-06-12T00:00:00Z')
      }
    }),
    fetch: async () => ({
      ok: true,
      json: async () => ({
        fiveHour: {
          utilization: 0.99,
          resetsAt: '2026-06-11T08:00:00Z'
        },
        sevenDay: {
          utilization: 0,
          resetsAt: '2026-06-18T10:00:00Z'
        }
      })
    }),
    runClaudeUsageCli: async () => {
      cliCalls += 1;
      return '';
    }
  });

  assert.equal(provider.source, 'oauth');
  assert.equal(provider.sourceDetail, '');
  assert.equal(provider.windows[0].usedPercent, 0.99);
  assert.equal(provider.windows[0].remainingPercent, 99.01);
  assert.equal(provider.windows[1].usedPercent, 0);
  assert.equal(provider.windows[1].remainingPercent, 100);
  assert.equal(cliCalls, 0);
});

test('Claude limits keep successful OAuth quota on macOS instead of replacing it with CLI', async () => {
  let cliCalls = 0;
  const provider = await fetchClaudeLimits({}, {
    platform: 'darwin',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    claudeCredentialPath: '/tmp/claude-credentials.json',
    stat: async () => ({ mtimeMs: 1 }),
    readFile: async () => JSON.stringify({
      claudeAiOauth: {
        accessToken: 'access-token',
        expiresAt: Date.parse('2026-06-12T00:00:00Z')
      }
    }),
    fetch: async () => ({
      ok: true,
      json: async () => ({
        fiveHour: {
          utilization: 100,
          resetsAt: '2026-06-11T08:00:00Z'
        },
        sevenDay: {
          utilization: 0,
          resetsAt: '2026-06-18T10:00:00Z'
        }
      })
    }),
    runClaudeUsageCli: async () => {
      cliCalls += 1;
      return [
        'Current session',
        '1% used',
        'Resets 3:59pm',
        'Current week',
        '0% used',
        'Resets Jun 19'
      ].join('\n');
    }
  });

  assert.equal(provider.source, 'oauth');
  assert.equal(provider.sourceDetail, '');
  assert.equal(provider.windows[0].usedPercent, 100);
  assert.equal(provider.windows[0].remainingPercent, 0);
  assert.equal(provider.windows[1].usedPercent, 0);
  assert.equal(provider.windows[1].remainingPercent, 100);
  assert.equal(cliCalls, 0);
});

test('Claude successful OAuth keeps plan label without probing CLI', async () => {
  let cliCalls = 0;
  const provider = await fetchClaudeLimits({}, {
    platform: 'darwin',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    claudeCredentialPath: '/tmp/claude-credentials.json',
    stat: async () => ({ mtimeMs: 1 }),
    readFile: async () => JSON.stringify({
      claudeAiOauth: {
        accessToken: 'access-token',
        expiresAt: Date.parse('2026-06-12T00:00:00Z'),
        subscriptionType: 'max',
        rateLimitTier: 'default_claude_max_5x'
      }
    }),
    fetch: async () => ({
      ok: true,
      json: async () => ({
        fiveHour: {
          utilization: 100,
          resetsAt: '2026-06-11T08:00:00Z'
        },
        sevenDay: {
          utilization: 0,
          resetsAt: '2026-06-18T10:00:00Z'
        }
      })
    }),
    runClaudeUsageCli: async () => {
      cliCalls += 1;
      return [
        'Current session',
        '1% used',
        'Resets 3:59pm',
        'Current week',
        '0% used',
        'Resets Jun 19'
      ].join('\n');
    }
  });

  assert.equal(provider.source, 'oauth');
  assert.equal(provider.sourceDetail, '');
  assert.equal(provider.accountLabel, 'Max 5x');
  assert.equal(provider.windows[0].remainingPercent, 0);
  assert.equal(cliCalls, 0);
});

test('Claude CLI usage parses compact PTY reset lines', () => {
  const provider = mapClaudeCliUsageToProvider([
    'Current session',
    '1% used',
    'Resets4pm(Asia/Hong_Kong)',
    'Current week (all models)',
    '0% used',
    'ResetsJun19at6pm(Asia/Hong_Kong)'
  ].join('\n'), {
    now: new Date('2026-06-13T07:00:00Z'),
    updatedAt: '2026-06-13T07:00:00Z'
  });

  const session = provider.windows.find((window) => window.kind === 'session');
  const weekly = provider.windows.find((window) => window.kind === 'weekly');
  assert.equal(session.resetDescription, 'Resets 4pm');
  assert.equal(weekly.resetDescription, 'Resets Jun 19 at 6pm');
  assert.equal(typeof session.resetsAt, 'string');
  assert.equal(typeof weekly.resetsAt, 'string');
});

test('Claude CLI usage maps out-of-order PTY reset lines by window shape', () => {
  const provider = mapClaudeCliUsageToProvider([
    'Current session',
    '1% used',
    'Current week (all models)',
    '0% used',
    'Resets4pm(Asia/Hong_Kong)',
    'ResetsJun19at6pm(Asia/Hong_Kong)'
  ].join('\n'), {
    now: new Date('2026-06-13T07:00:00Z'),
    updatedAt: '2026-06-13T07:00:00Z'
  });

  const session = provider.windows.find((window) => window.kind === 'session');
  const weekly = provider.windows.find((window) => window.kind === 'weekly');
  assert.equal(session.resetDescription, 'Resets 4pm');
  assert.equal(weekly.resetDescription, 'Resets Jun 19 at 6pm');
  assert.equal(typeof session.resetsAt, 'string');
  assert.equal(typeof weekly.resetsAt, 'string');
});

test('Claude command candidates include common Windows CLI install paths before generic commands', () => {
  const localAppData = 'C:\\Users\\Javis\\AppData\\Local';
  const appData = 'C:\\Users\\Javis\\AppData\\Roaming';
  const userProfile = 'C:\\Users\\Javis';

  const candidates = claudeCommandCandidates({
    LOCALAPPDATA: localAppData,
    APPDATA: appData,
    USERPROFILE: userProfile
  }, 'win32');

  const localNpm = 'C:\\Users\\Javis\\AppData\\Local\\npm\\claude.cmd';
  const roamingNpm = 'C:\\Users\\Javis\\AppData\\Roaming\\npm\\claude.cmd';
  const volta = 'C:\\Users\\Javis\\AppData\\Local\\Volta\\tools\\image\\packages\\@anthropic-ai\\claude-code\\bin\\claude.cmd';
  const fnm = 'C:\\Users\\Javis\\AppData\\Local\\fnm_multishells\\claude.cmd';

  assert.equal(candidates.includes(localNpm), true);
  assert.equal(candidates.includes(roamingNpm), true);
  assert.equal(candidates.includes(volta), true);
  assert.equal(candidates.includes(fnm), true);
  assert.ok(candidates.indexOf(roamingNpm) < candidates.indexOf('claude.cmd'));
  assert.ok(candidates.indexOf('claude.cmd') < candidates.indexOf('claude'));
});

test('Claude OAuth usage adds a Fable-only weekly window from the limits array', () => {
  const provider = mapClaudeUsageToProvider({
    five_hour: { utilization: 96, resets_at: '2026-07-02T14:00:00Z' },
    seven_day: { utilization: 22, resets_at: '2026-07-03T10:00:00Z' },
    limits: [
      { kind: 'session', group: 'session', percent: 96, resets_at: '2026-07-02T14:00:00Z', scope: null },
      { kind: 'weekly_all', group: 'weekly', percent: 22, resets_at: '2026-07-03T10:00:00Z', scope: null },
      {
        kind: 'weekly_scoped',
        group: 'weekly',
        percent: 1,
        resets_at: '2026-07-03T09:59:59Z',
        scope: { model: { id: null, display_name: 'Fable' }, surface: null }
      }
    ]
  });

  const weeklies = provider.windows.filter((window) => window.kind === 'weekly');
  assert.equal(weeklies.length, 2);
  // The unscoped "All models" weekly stays first so windowForKind() still resolves it.
  assert.equal(weeklies[0].label, '');
  assert.equal(weeklies[0].usedPercent, 22);
  const fable = weeklies[1];
  assert.equal(fable.label, 'Fable');
  assert.equal(fable.usedPercent, 1);
  assert.equal(fable.resetsAt, '2026-07-03T09:59:59.000Z');
});

test('Claude OAuth usage omits the Fable window when no scoped model limit is present', () => {
  const provider = mapClaudeUsageToProvider({
    five_hour: { utilization: 40, resets_at: '2026-07-02T14:00:00Z' },
    seven_day: { utilization: 10, resets_at: '2026-07-03T10:00:00Z' },
    limits: [
      { kind: 'session', group: 'session', percent: 40, resets_at: '2026-07-02T14:00:00Z', scope: null },
      { kind: 'weekly_all', group: 'weekly', percent: 10, resets_at: '2026-07-03T10:00:00Z', scope: null }
    ]
  });

  const weeklies = provider.windows.filter((window) => window.kind === 'weekly');
  assert.equal(weeklies.length, 1);
  assert.equal(weeklies[0].label, '');
});

test('Claude OAuth usage ignores non-Fable scoped weekly limits', () => {
  const provider = mapClaudeUsageToProvider({
    seven_day: { utilization: 10, resets_at: '2026-07-03T10:00:00Z' },
    limits: [
      { kind: 'weekly_all', group: 'weekly', percent: 10, resets_at: '2026-07-03T10:00:00Z', scope: null },
      {
        kind: 'weekly_scoped',
        group: 'weekly',
        percent: 3,
        resets_at: '2026-07-03T10:00:00Z',
        scope: { model: { id: null, display_name: 'Opus' }, surface: null }
      }
    ]
  });

  const labels = provider.windows.filter((window) => window.kind === 'weekly').map((window) => window.label);
  assert.deepEqual(labels, ['']);
});

// The Hub has no ~/.claude, no Keychain, and (because probing nulls `env`) no
// CLAUDE_CODE_OAUTH_TOKEN. OAuth there is only reachable if the credential
// arrives in `options`, which is what these two tests pin.

test('Claude uses a Hub-supplied OAuth access token without touching local files', async () => {
  let readFileCalls = 0;
  const provider = await fetchClaudeLimits({
    claudeAccessToken: 'hub-access-token',
    claudeAccountLabel: 'work'
  }, {
    platform: 'linux',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    env: Object.create(null),
    readFile: async () => { readFileCalls += 1; throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
    stat: async () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
    fetch: async (url, init) => {
      // The collector also calls the profile endpoint; only the usage call
      // carries the quota windows.
      assert.equal(init.headers.authorization, 'Bearer hub-access-token');
      if (/\/api\/oauth\/profile/.test(String(url))) {
        return { ok: true, json: async () => ({ account: { email: 'hub@example.com' } }) };
      }
      assert.match(String(url), /api\.anthropic\.com\/api\/oauth\/usage/);
      return {
        ok: true,
        json: async () => ({
          five_hour: { utilization: 25, resets_at: '2026-06-11T08:00:00Z' },
          seven_day: { utilization: 40, resets_at: '2026-06-18T10:00:00Z' }
        })
      };
    }
  });

  assert.equal(provider.source, 'oauth');
  assert.equal(provider.windows[0].usedPercent, 25);
  assert.equal(provider.windows[1].usedPercent, 40);
  // The Hub path must not fall through to local credential discovery.
  assert.equal(readFileCalls, 0);
});

test('a Hub OAuth access token takes precedence over an ambient env token', async () => {
  const seen = [];
  await fetchClaudeLimits({ claudeAccessToken: 'hub-token' }, {
    platform: 'linux',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    // A dev machine may still have the env var set; the explicit Hub account wins.
    env: { CLAUDE_CODE_OAUTH_TOKEN: 'ambient-token' },
    fetch: async (url, init) => {
      seen.push(init.headers.authorization);
      return { ok: true, json: async () => ({ five_hour: { utilization: 1 }, seven_day: { utilization: 2 } }) };
    }
  });
  // Both the usage and profile calls must use the Hub token, never the ambient one.
  assert.ok(seen.length > 0, 'expected at least one call');
  assert.deepEqual([...new Set(seen)], ['Bearer hub-token']);
});

test('a Hub refresh token is carried so the collector can renew the access token', async () => {
  const provider = await fetchClaudeLimits({
    claudeAccessToken: 'expired-token',
    claudeRefreshToken: 'hub-refresh-token',
    // Already expired, so the proactive refresh path must engage on non-darwin.
    claudeExpiresAt: '2026-06-10T00:00:00Z'
  }, {
    platform: 'linux',
    now: () => Date.parse('2026-06-11T00:00:00Z'),
    env: Object.create(null),
    fetch: async (url, init) => {
      if (/oauth\/token/.test(String(url))) {
        assert.match(String(init.body), /grant_type=refresh_token/);
        assert.match(String(init.body), /hub-refresh-token/);
        return {
          ok: true,
          json: async () => ({ access_token: 'renewed-token', refresh_token: 'rotated-token', expires_in: 3600 })
        };
      }
      assert.equal(init.headers.authorization, 'Bearer renewed-token');
      return { ok: true, json: async () => ({ five_hour: { utilization: 5 }, seven_day: { utilization: 6 } }) };
    }
  });
  assert.equal(provider.source, 'oauth');
  assert.equal(provider.windows.length, 2);
});
