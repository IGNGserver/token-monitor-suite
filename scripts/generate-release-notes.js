'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CATEGORY_ORDER = ['Added', 'Changed', 'Improved', 'Fixed'];
const CATEGORY_ZH = Object.freeze({
  Added: '新增',
  Changed: '变更',
  Improved: '改进',
  Fixed: '修复'
});
const SCOPE_ZH = Object.freeze({
  android: 'Android',
  collector: '采集器',
  desktop: '桌面端',
  electron: '桌面端',
  home: '首页',
  hub: 'Hub',
  limits: '用量限制',
  release: '发布流程',
  renderer: '界面',
  settings: '设置',
  sync: '同步',
  tray: '托盘',
  updater: '更新器',
  windows: 'Windows'
});
const IGNORED_TYPES = new Set(['build', 'ci', 'chore', 'docs', 'style', 'test']);
const START_MARKERS = Object.freeze({
  en: '<!-- app-update-notes:en:start -->',
  zh: '<!-- app-update-notes:zh:start -->'
});
const END_MARKERS = Object.freeze({
  en: '<!-- app-update-notes:en:end -->',
  zh: '<!-- app-update-notes:zh:end -->'
});

function parseCommitSubject(subject) {
  const text = String(subject || '').trim();
  if (!text || /^merge\b/i.test(text)) return null;
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<summary>.+)$/i.exec(text);
  if (!match) return null;

  const type = match.groups.type.toLowerCase();
  if (IGNORED_TYPES.has(type) || /^(?:release|prepare version)\b/i.test(match.groups.summary)) return null;
  let category;
  if (match.groups.breaking) category = 'Changed';
  else if (type === 'feat') category = 'Added';
  else if (type === 'fix') category = 'Fixed';
  else if (type === 'perf' || type === 'refactor' || type === 'revert') category = 'Improved';
  else return null;

  return {
    category,
    scope: String(match.groups.scope || '').trim(),
    summary: match.groups.summary.trim()
  };
}

function normalizeCommit(commit) {
  if (typeof commit === 'string') return parseCommitSubject(commit);
  if (!commit || typeof commit !== 'object') return null;
  if (commit.category && CATEGORY_ORDER.includes(commit.category) && commit.summary) {
    return {
      category: commit.category,
      scope: String(commit.scope || '').trim(),
      summary: String(commit.summary).trim()
    };
  }
  return parseCommitSubject(commit.subject || commit.message || '');
}

function scopeLabel(scope, locale) {
  const value = String(scope || '').trim();
  if (!value) return '';
  if (locale === 'zh') return SCOPE_ZH[value.toLowerCase()] || value;
  return value;
}

function releaseNoteBullet(commit, locale) {
  const scope = scopeLabel(commit.scope, locale);
  return scope ? `- **${scope}:** ${commit.summary}` : `- ${commit.summary}`;
}

function collectReleaseNoteGroups(commits, version) {
  const groups = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  const seen = new Set();
  for (const raw of commits || []) {
    const commit = normalizeCommit(raw);
    if (!commit) continue;
    const key = `${commit.category}\u0000${commit.scope}\u0000${commit.summary}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    groups.get(commit.category).push(commit);
  }

  if (CATEGORY_ORDER.every((category) => groups.get(category).length === 0)) {
    groups.get('Fixed').push({
      category: 'Fixed',
      scope: 'release',
      summary: `Maintenance updates for v${String(version || 'this release').replace(/^v/i, '')}.`
    });
  }
  return groups;
}

function formatReleaseNoteSection(groups, locale) {
  const lines = [];
  for (const category of CATEGORY_ORDER) {
    const entries = groups.get(category) || [];
    if (entries.length === 0) continue;
    lines.push(`### ${locale === 'zh' ? CATEGORY_ZH[category] : category}`);
    lines.push(...entries.map((entry) => releaseNoteBullet(entry, locale)));
    lines.push('');
  }
  return lines.join('\n').trim();
}

function replaceMarkedSection(body, locale, content) {
  const startMarker = START_MARKERS[locale];
  const endMarker = END_MARKERS[locale];
  const start = body.indexOf(startMarker);
  if (start < 0) throw new Error(`Release template is missing the ${locale} start marker`);
  const contentStart = start + startMarker.length;
  const end = body.indexOf(endMarker, contentStart);
  if (end < 0) throw new Error(`Release template is missing the ${locale} end marker`);
  return `${body.slice(0, contentStart)}\n${content}\n${body.slice(end)}`;
}

function renderReleaseBody(template, { version, commits = [] } = {}) {
  const groups = collectReleaseNoteGroups(commits, version);
  let body = replaceMarkedSection(template, 'en', formatReleaseNoteSection(groups, 'en'));
  body = replaceMarkedSection(body, 'zh', formatReleaseNoteSection(groups, 'zh'));
  return body;
}

function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function resolvePreviousTag(headRef = 'HEAD', cwd = process.cwd()) {
  try {
    const exactTag = git(['describe', '--exact-match', '--tags', '--match', 'v*', headRef], cwd);
    if (exactTag) return git(['describe', '--tags', '--abbrev=0', '--match', 'v*', `${headRef}^`], cwd);
  } catch (_) {}
  try {
    return git(['describe', '--tags', '--abbrev=0', '--match', 'v*', headRef], cwd);
  } catch (_) {
    return '';
  }
}

function readGitCommits({ baseRef = '', headRef = 'HEAD', cwd = process.cwd() } = {}) {
  const range = baseRef ? `${baseRef}..${headRef}` : headRef;
  let output;
  try {
    output = execFileSync('git', [
      'log', '--no-merges', '--pretty=format:%s%x1f%b%x1e', range, '--'
    ], { cwd, encoding: 'utf8' });
  } catch (_) {
    return [];
  }
  return output.split('\x1e')
    .map((record) => record.split('\x1f')[0].trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function generateReleaseBody({
  version,
  templatePath,
  outputPath,
  baseRef,
  headRef = 'HEAD',
  cwd = process.cwd()
}) {
  const template = fs.readFileSync(path.resolve(cwd, templatePath), 'utf8');
  const previousTag = baseRef || resolvePreviousTag(headRef, cwd);
  const commits = readGitCommits({ baseRef: previousTag, headRef, cwd });
  const body = renderReleaseBody(template, { version, commits });
  fs.writeFileSync(path.resolve(cwd, outputPath), body, 'utf8');
  return { body, previousTag, commits };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const version = String(args.version || '').replace(/^v/i, '').trim();
  const result = generateReleaseBody({
    version: version || 'unknown',
    templatePath: args.template || '.github/RELEASE_TEMPLATE.md',
    outputPath: args.output || 'release-body.md',
    baseRef: args.base || '',
    headRef: args.head || 'HEAD'
  });
  console.log(`Rendered release notes from ${result.previousTag || 'repository history'} (${result.commits.length} commits).`);
}

module.exports = {
  CATEGORY_ORDER,
  CATEGORY_ZH,
  collectReleaseNoteGroups,
  formatReleaseNoteSection,
  generateReleaseBody,
  parseCommitSubject,
  readGitCommits,
  renderReleaseBody,
  resolvePreviousTag
};
