'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..', '..');

// Prohibited terms for retired widget/upstream surfaces across user-facing docs
const FORBIDDEN_TERMS = [
  { pattern: /floating bubble/i, name: 'Floating Bubble' },
  { pattern: /悬浮小窗/, name: '悬浮小窗' },
  { pattern: /懸浮小窗/, name: '懸浮小窗' },
  { pattern: /フローティングバブル/, name: 'フローティングバブル' },
  { pattern: /플로팅 버블/, name: '플로팅 버블' },
  { pattern: /Widgy/i, name: 'Widgy' },
  { pattern: /Scriptable/i, name: 'Scriptable' },
  { pattern: /Cloudflare Worker/i, name: 'Cloudflare Worker' },
  { pattern: /native macOS widget/i, name: 'native macOS widget' },
  { pattern: /原生 macOS 小部件/, name: '原生 macOS 小部件' },
  { pattern: /原生 macOS 小工具/, name: '原生 macOS 小工具' },
  { pattern: /ネイティブ macOS ウィジェット/, name: 'ネイティブ macOS ウィジェット' },
  { pattern: /네이티브 macOS 위젯/, name: '네이티브 macOS 위젯' },
  { pattern: /dedicated dashboard window/i, name: 'dedicated dashboard window' },
  { pattern: /独立的仪表板窗口/, name: '独立的仪表板窗口' },
  { pattern: /獨立的儀表板視窗/, name: '獨立的儀表板視窗' },
  { pattern: /専用ダッシュボードウィンドウ/, name: '専用ダッシュボードウィンドウ' },
  { pattern: /전용 대시보드 창/, name: '전용 대시보드 창' }
];

function getMarkdownFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'archive') {
        continue;
      }
      results.push(...getMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

test('user-facing documentation does not contain retired surface terms', () => {
  const readmeFiles = fs.readdirSync(rootDir)
    .filter((f) => f.startsWith('README') && f.endsWith('.md'))
    .map((f) => path.join(rootDir, f));
  
  const docsFiles = getMarkdownFiles(path.join(rootDir, 'docs'));
  const allDocs = [...readmeFiles, ...docsFiles];

  const violations = [];

  for (const file of allDocs) {
    const relative = path.relative(rootDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // Allow historical references / boundaries (e.g. "product-scope", "retired", "removed", "no longer", "does not")
      if (/retired|removed|no longer|does not embed|deliberately not|not supported|boundary|archive/i.test(line)) {
        return;
      }
      for (const { pattern, name } of FORBIDDEN_TERMS) {
        if (pattern.test(line)) {
          violations.push(`${relative}:${idx + 1} contains prohibited term '${name}': "${line.trim()}"`);
        }
      }
    });
  }

  assert.deepEqual(violations, [], `Prohibited surface terms found:\n${violations.join('\n')}`);
});
