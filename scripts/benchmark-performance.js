'use strict';

// Local, synthetic comparison. No providers, credentials or user logs are read.
// Usage: node scripts/benchmark-performance.js [baseline-git-ref]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const baseline = process.argv[2] || 'HEAD';
const runs = 7;
const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
function source(file, before) {
  return before
    ? execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
function measure(code) {
  const samples = Array.from({ length: runs }, () => JSON.parse(execFileSync(
    process.execPath, ['--expose-gc', '-e', code], { cwd: root, encoding: 'utf8' }
  )));
  return Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(sample => sample[key]))]));
}
const results = { node: process.version, baseline, runs, scenario: 'isolated Node processes; no real provider or desktop workload' };
for (const before of [true, false]) {
  const outbound = source('src/shared/outboundFetch.js', before);
  const formatting = source('src/shared-ui/core/format.js', before).replaceAll('export function ', 'function ');
  const data = source('src/shared-ui/core/data.js', before).replace(/^export /gm, '');
  results[before ? 'before' : 'after'] = {
    directHttpModule: measure(`
      const Module = require('node:module');
      const file = ${JSON.stringify(path.join(root, 'src/shared/outboundFetch.js'))};
      const mod = new Module(file, module); mod.paths = module.paths;
      gc(); const memory = process.memoryUsage(); const cpu = process.cpuUsage(); const start = performance.now();
      mod._compile(${JSON.stringify(outbound)}, file); mod.exports.createOutboundFetch({});
      const ms = performance.now() - start; const used = process.cpuUsage(cpu); gc();
      console.log(JSON.stringify({ ms, cpuMs: (used.user + used.system) / 1000,
        retainedHeapBytes: process.memoryUsage().heapUsed - memory.heapUsed,
        rssDeltaBytes: process.memoryUsage().rss - memory.rss, modules: Object.keys(require.cache).length }));
    `),
    sessionPage200Of20000: measure(`
      ${data}
      const sessions = {};
      for (let index = 0; index < 20000; index++) sessions['s' + index] = {
        client: 'codex', sessionId: 's' + index, totalTokens: index + 1,
        models: { 'gpt-5': index + 1 },
        lastUsedAt: new Date(Date.UTC(2026, 0, 1) + ((index * 7919) % 20000) * 1000).toISOString()
      };
      sessionRows({ sessions }); gc();
      const heap = process.memoryUsage().heapUsed; const start = performance.now();
      const result = sessionRows({ sessions });
      console.log(JSON.stringify({ ms: performance.now() - start,
        heapDeltaBytes: process.memoryUsage().heapUsed - heap, rows: result.rows.length, total: result.total }));
    `),
    format1000Rows: measure(`
      ${formatting}
      const iso = '2026-09-19T06:23:00.000Z';
      formatReset(iso, 'en'); formatRelative(iso, 'en');
      const times = {};
      for (const fn of [formatRelative, formatReset]) {
        const start = performance.now();
        for (let index = 0; index < 1000; index++) fn(iso, 'en');
        times[fn.name + 'Ms'] = performance.now() - start;
      }
      console.log(JSON.stringify(times));
    `)
  };
}
console.log(JSON.stringify(results, null, 2));
