'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');

const rootDir = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

const localizedReadmes = ['README.md', 'README.zh-TW.md', 'README.zh-CN.md', 'README.ja.md', 'README.ko.md'];

// The supported-tools table is what a reader can actually verify, so the prose counts are
// checked against it — not against LIMIT_PROVIDER_IDS, where zai/zaiteam are two ids but
// share one table row.
const supportedToolCounts = (text, file) => {
  const rows = text.split('\n').filter((line) => line.startsWith('| <img'));
  assert.ok(rows.length > 0, `${file}: no supported-tools rows found`);

  const counts = { tools: rows.length, usage: 0, limits: 0 };
  for (const row of rows) {
    const cells = row.split('|').map((cell) => cell.trim());
    assert.equal(cells.length, 8, `${file}: unexpected column count in row: ${row}`);
    if (cells[4] === '✅') counts.usage += 1;
    if (cells[5] === '✅') counts.limits += 1;
  }
  return counts;
};

const supportedToolNames = (text) => text
  .split('\n')
  .filter((line) => line.startsWith('| <img'))
  .map((row) => row.split('|')[2].trim());

const supportedToolIds = (text, file) => text
  .split('\n')
  .filter((line) => line.startsWith('| <img'))
  .map((row) => {
    const id = row.match(/tools-icon\/([^".]+)\.[a-z]+"/i)?.[1];
    assert.ok(id, `${file}: no tool icon id found in row: ${row}`);
    return id;
  });

const supportedToolOrder = [
  'Claude Code',
  'Claude Desktop',
  'Codex',
  'OpenCode',
  'Hermes Agent',
  'OpenClaw',
  'Cursor',
  'Antigravity',
  'Cline',
  'Kimi CLI / Kimi Code',
  'Qwen CLI',
  'Grok Build',
  'GitHub Copilot',
  'Pi / Oh My Pi',
  'Zed',
  'Kilo Code',
  'Command Code',
  'MiMo Code',
  'ZCode / GLM',
  'Kiro',
  'CodeBuddy',
  'WorkBuddy',
  'Proma',
  'DeepSeek Harness',
  'Qoder / Qoder CN',
  'Reasonix',
  'Gemini CLI',
  'Roo Code',
  'Amp',
  'Droid',
  'Mux',
  'Kilo CLI',
  'Crush',
  'Goose',
  'Codebuff / Freebuff',
  'Trae',
  'Warp / Oz',
  'Gajae-Code',
  'Jcode',
  'Junie',
  'OpenCodeReview',
  'Devin CLI / Devin Desktop',
  'Senpi',
  'Augment Code',
  'Kimchi',
  'Prime Agent',
  'Cherry Studio',
  'MiniMax Code',
  'Fx',
  'LM Studio',
  'Unsloth',
  'Hindsight',
  'DeepSeek',
  'OpenRouter',
  'Minimax',
  'Volcengine',
  'Ollama',
  'Third-party APIs',
  'Sakana (Fugu)'
];

const supportedToolIdOrder = [
  'claude',
  'claude-desktop',
  'codex',
  'opencode',
  'hermes-agent',
  'openclaw',
  'cursor',
  'antigravity',
  'cline',
  'kimi',
  'qwen',
  'xai',
  'copilot',
  'pi',
  'zed',
  'kilocode',
  'commandcode',
  'mimo-code',
  'zcode',
  'kiro',
  'codebuddy',
  'workbuddy',
  'proma',
  'deepseek-harness',
  'qoder',
  'reasonix',
  'gemini',
  'roocode',
  'amp',
  'droid',
  'mux',
  'kilo',
  'crush',
  'goose',
  'codebuff',
  'trae',
  'warp',
  'gjc',
  'jcode',
  'junie',
  'opencodereview',
  'devin',
  'senpi',
  'augment',
  'kimchi',
  'prime-agent',
  'cherrystudio',
  'mcode',
  'fx',
  'lmstudio',
  'unsloth',
  'hindsight',
  'deepseek',
  'openrouter',
  'minimax',
  'volcengine',
  'ollama',
  'newapi',
  'sakana'
];

// Exact counts, not "at least": a floor check would still pass after new tools land, which is
// the staleness this guards. Reword a claim and the missing match fails loudly on purpose.
const countClaims = {
  'README.md': {
    tools: /across (\d+)\+ AI coding tools/,
    usage: /and (\d+)\+ AI tools/,
    limits: /and (\d+)\+ providers/
  },
  'README.zh-TW.md': {
    tools: /等 (\d+)\+ 種 AI 編程工具/,
    usage: /等 (\d+)\+ 種 AI 工具/,
    limits: /等 (\d+)\+ 家供應商/
  },
  'README.zh-CN.md': {
    tools: /等 (\d+)\+ 种 AI 编程工具/,
    usage: /等 (\d+)\+ 种 AI 工具/,
    limits: /等 (\d+)\+ 家提供方/
  },
  'README.ja.md': {
    tools: /など (\d+)\+ 種類の AI コーディングツール/,
    usage: /など (\d+)\+ 種類の AI ツール/,
    limits: /など (\d+)\+ プロバイダー/
  },
  'README.ko.md': {
    tools: /(\d+)개 이상의 AI 코딩 도구/,
    usage: /(\d+)개 이상의 AI 도구/,
    limits: /(\d+)개 이상 공급자/
  }
};

test('configuration reference env keys all exist in .env.example', () => {
  const envKeys = (text) => {
    const block = text.match(/```env\n([\s\S]*?)```/)?.[1] || '';
    return [...block.matchAll(/^(TOKEN_MONITOR_[A-Z0-9_]+)=/gm)].map((match) => match[1]);
  };
  const docKeys = envKeys(read('docs/configuration.md'));
  assert.ok(docKeys.length > 0, 'docs/configuration.md should list env keys');

  const exampleKeys = new Set(
    [...read('.env.example').matchAll(/^(TOKEN_MONITOR_[A-Z0-9_]+)=/gm)].map((match) => match[1])
  );
  for (const key of docKeys) assert.ok(exampleKeys.has(key), `${key} missing from .env.example`);
});

test('localized READMEs list the same supported tools', () => {
  const baselineText = read('README.md');
  const baseline = supportedToolCounts(baselineText, 'README.md');
  assert.deepEqual(supportedToolNames(baselineText), supportedToolOrder);
  for (const file of localizedReadmes) {
    const text = read(file);
    assert.deepEqual(supportedToolCounts(text, file), baseline, file);
    assert.deepEqual(supportedToolIds(text, file), supportedToolIdOrder, file);
  }
});

// The provider list is ordered to match the README table, so a reader comparing
// the two sees the same sequence. Nothing enforced that before: the order test
// pins LIMIT_PROVIDERS against its own hard-coded copy and the table test pins
// the README against its own, so both could pass while the two disagreed — which
// is exactly how Command Code landed in the wrong slot.
//
// The table's icon id is not always the provider id (a tool row is named after
// its artwork), and GLM/GLM Team share one row, so the two are bridged here.
const README_ICON_TO_LIMIT_PROVIDERS = {
  xai: ['grok'],
  'mimo-code': ['mimo'],
  zcode: ['zai', 'zaiteam'],
  newapi: ['thirdparty']
};

test('limit provider order follows the supported-tools table', () => {
  const text = read('README.md');
  const fromReadme = text
    .split('\n')
    .filter((line) => line.startsWith('| <img'))
    .filter((row) => row.split('|').map((cell) => cell.trim())[5] === '✅')
    .flatMap((row) => {
      const icon = row.match(/tools-icon\/([^".]+)\.[a-z]+"/i)[1];
      return README_ICON_TO_LIMIT_PROVIDERS[icon] || [icon];
    });

  assert.deepEqual(fromReadme, [...LIMIT_PROVIDER_IDS]);
});

test('README tool and provider counts match the supported-tools table', () => {
  for (const file of localizedReadmes) {
    const text = read(file);
    const counts = supportedToolCounts(text, file);
    for (const [claim, pattern] of Object.entries(countClaims[file])) {
      const match = text.match(pattern);
      assert.ok(match, `${file}: no ${claim} count claim matched ${pattern}`);
      assert.equal(Number(match[1]), counts[claim], `${file}: ${claim} count claim should be ${counts[claim]}`);
    }
  }
});

test('localized READMEs link to the configuration reference', () => {
  for (const file of localizedReadmes) assert.match(read(file), /docs\/configuration\.md/, file);
});

test('localized READMEs point quota management at the Hub', () => {
  // Provider credentials are Hub accounts now; the desktop client has no
  // credentials section of its own, so every locale must say where they live.
  const hubMentions = {
    'README.md': /Quota accounts, subscriptions, and pricing are managed on the Hub/,
    'README.zh-TW.md': /額度帳號、訂閱與定價由中樞管理/,
    'README.zh-CN.md': /额度账号、订阅与定价由中枢管理/,
    'README.ja.md': /クォータアカウント、サブスクリプション、価格設定はハブで管理/,
    'README.ko.md': /할당량 계정, 구독, 가격은 허브에서 관리/
  };

  for (const [file, pattern] of Object.entries(hubMentions)) {
    assert.match(read(file), pattern, file);
  }
  // The desktop settings list must no longer claim to hold credentials.
  for (const file of Object.keys(hubMentions)) {
    assert.doesNotMatch(read(file), /AI Tool Limits \(provider selection/, file);
  }
});

test('configuration reference sends provider accounts to the Hub', () => {
  const configuration = read('docs/configuration.md');
  // Quota credentials are Hub accounts; the doc must say so and must not present
  // a device-local credentials section.
  assert.match(configuration, /Accounts\s*\/\s*Management/, 'the accounts row should exist');
  assert.match(configuration, /Hub-owned quota accounts[^.]*OAuth/, 'accounts and their sign-in are Hub-owned');
  assert.match(configuration, /does not discover local developer-tool accounts/, 'the device must not claim to hold credentials');
  assert.doesNotMatch(configuration, /\*\*Window\*\* \|[^|]*tray mode/, 'the removed widget window settings must not be documented');
});

test('localized README WSL claims disclose the SQLite agent boundary', () => {
  const files = ['README.md', 'README.zh-TW.md', 'README.zh-CN.md', 'README.ja.md', 'README.ko.md'];

  for (const file of files) {
    const line = read(file).split('\n').find((value) => value.includes('**WSL')) || '';
    assert.match(line, /SQLite/, file);
    assert.match(line, /docs\/wsl-sqlite-setup(?:\.zh-CN)?\.md/, file);
  }
});

test('WSL SQLite guides keep English and Chinese entry points connected', () => {
  assert.match(read('docs/wsl-sqlite-setup.md'), /\[简体中文\]\(wsl-sqlite-setup\.zh-CN\.md\)/);
  assert.match(read('docs/wsl-sqlite-setup.zh-CN.md'), /\[English\]\(wsl-sqlite-setup\.md\)/);
});

test('WSL SQLite guides state and verify the Node.js prerequisite', () => {
  for (const file of ['docs/wsl-sqlite-setup.md', 'docs/wsl-sqlite-setup.zh-CN.md']) {
    const guide = read(file);
    assert.match(guide, /Node\.js 22\.13\.0/, file);
    assert.match(guide, /node --version\nnpm --version\n/, file);
  }
});


test('localized README env summaries stay aligned', () => {
  const files = localizedReadmes;
  const envKeys = (file) => {
    const block = read(file).match(/```env\n([\s\S]*?)```/)?.[1] || '';
    return [...block.matchAll(/^(TOKEN_MONITOR_[A-Z0-9_]+)=/gm)].map((match) => match[1]);
  };
  const expected = envKeys(files[0]);
  for (const file of files.slice(1)) assert.deepEqual(envKeys(file), expected, file);
});
