'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Linter } = require('eslint');

const registry = require('../../src/shared/hubBuildRegistry.json');
const {
  CORE_SOURCE_FILES,
  NODE_RUNTIME_SOURCE_FILES,
  currentHubSourceBuildIds,
  latestEntry,
  nodeLockBuildInput,
  nodePackageBuildInput,
  updatedRegistry,
  validateRegistry,
} = require('../../scripts/hub-build-manifest');

const ROOT = path.resolve(__dirname, '..', '..');

function buildId(character) {
  return `sha256:${character.repeat(64)}`;
}

function componentHistory(characters) {
  return [...characters].map((character, index) => ({
    revision: index + 1,
    buildId: buildId(character)
  }));
}

function staticSpecifier(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value?.cooked || '';
  }
  return '';
}

function localDependencySpecifiers(file, source) {
  const linter = new Linter({ configType: 'flat' });
  const messages = linter.verify(source, [{
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs'
    }
  }], { filename: file });
  assert.deepEqual(messages.filter((message) => message.fatal), [], `cannot parse dependencies in ${file}`);

  const specifiers = new Set();
  const sourceCode = linter.getSourceCode();
  for (const step of sourceCode.traverse()) {
    if (step.type !== 'visit' || step.phase !== 1) continue;
    const node = step.target;
    let specifier = '';
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) {
      specifier = staticSpecifier(node.source);
    } else if (node.type === 'ImportExpression') {
      specifier = staticSpecifier(node.source);
    } else if (node.type === 'CallExpression') {
      const isRequire = node.callee?.type === 'Identifier' && node.callee.name === 'require';
      const isRequireResolve = node.callee?.type === 'MemberExpression'
        && !node.callee.computed
        && node.callee.object?.type === 'Identifier'
        && node.callee.object.name === 'require'
        && node.callee.property?.type === 'Identifier'
        && node.callee.property.name === 'resolve';
      if (isRequire || isRequireResolve) specifier = staticSpecifier(node.arguments[0]);
    }
    if (specifier.startsWith('.')) specifiers.add(specifier);
  }
  return [...specifiers];
}

function resolveLocalDependency(fromFile, specifier) {
  const unresolved = path.resolve(path.dirname(path.join(ROOT, fromFile)), specifier);
  const candidates = path.extname(unresolved)
    ? [unresolved]
    : [`${unresolved}.js`, `${unresolved}.json`, path.join(unresolved, 'index.js')];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  assert.ok(resolved, `cannot resolve ${specifier} imported by ${fromFile}`);
  const relative = path.relative(ROOT, resolved).split(path.sep).join('/');
  assert.ok(relative && !relative.startsWith('../'), `${specifier} imported by ${fromFile} escapes the repository`);
  return relative;
}

function localDependencyClosure(entryFiles) {
  const visited = new Set();
  const pending = [...entryFiles];
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (path.extname(file) === '.json') continue;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const specifier of localDependencySpecifiers(file, source)) {
      const dependency = resolveLocalDependency(file, specifier);
      if (!visited.has(dependency)) pending.push(dependency);
    }
  }
  return [...visited].sort();
}

test('Hub build registry matches the current core and runtime source closures', () => {
  const sourceBuildIds = currentHubSourceBuildIds();
  for (const component of ['core', 'node-hub']) {
    assert.equal(
      latestEntry(registry, component)?.buildId,
      sourceBuildIds[component],
      `${component} changed; run npm run update:hub-build after the implementation is final`
    );
  }
});

test('Node Hub identity follows only its declared dotenv runtime dependency and resolution', () => {
  const packageJson = {
    version: '0.42.0',
    dependencies: { dotenv: '^17.4.2', semver: '^7.8.5' }
  };
  assert.equal(
    nodePackageBuildInput(packageJson),
    nodePackageBuildInput({ ...packageJson, version: '0.43.0' })
  );
  assert.notEqual(
    nodePackageBuildInput(packageJson),
    nodePackageBuildInput({ ...packageJson, dependencies: { ...packageJson.dependencies, dotenv: '^18.0.0' } })
  );

  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { version: '0.42.0' },
      'node_modules/dotenv': { version: '17.4.2', integrity: 'sha512:first' },
      'node_modules/semver': { version: '7.8.5', integrity: 'sha512:unrelated' }
    }
  };
  assert.equal(
    nodeLockBuildInput(lock),
    nodeLockBuildInput({ ...lock, packages: { ...lock.packages, '': { version: '0.43.0' } } })
  );
  assert.equal(
    nodeLockBuildInput(lock),
    nodeLockBuildInput({
      ...lock,
      packages: {
        ...lock.packages,
        'node_modules/semver': { version: '8.0.0', integrity: 'sha512:changed-but-unrelated' }
      }
    })
  );
  assert.notEqual(
    nodeLockBuildInput(lock),
    nodeLockBuildInput({
      ...lock,
      packages: {
        ...lock.packages,
        'node_modules/dotenv': { version: '18.0.0', integrity: 'sha512:second' }
      }
    })
  );
});

test('Hub build manifests cover the complete Node local dependency graph', () => {
  // The registry is runtime metadata produced from these hashes, so hashing it
  // back into either component would make the build identity self-referential.
  const nodeRegistryMetadata = 'src/shared/hubBuildRegistry.json';
  assert.deepEqual(
    localDependencyClosure(['src/hub/server.js']),
    [...new Set([...CORE_SOURCE_FILES, ...NODE_RUNTIME_SOURCE_FILES, nodeRegistryMetadata])].sort()
  );
});

test('Hub build registry enforces canonical component histories', () => {
  assert.equal(validateRegistry(registry), registry);

  const valid = {
    schemaVersion: 1,
    components: {
      core: componentHistory('12'),
      'node-hub': componentHistory('34'),
    }
  };
  assert.equal(validateRegistry(valid), valid);

  const clone = () => JSON.parse(JSON.stringify(valid));
  const missingComponent = clone();
  delete missingComponent.components['node-hub'];
  assert.throws(() => validateRegistry(missingComponent), /components must be exactly/);

  const duplicateRevision = clone();
  duplicateRevision.components.core[1].revision = 1;
  assert.throws(() => validateRegistry(duplicateRevision), /core revision at index 1 must be 2/);

  const skippedRevision = clone();
  skippedRevision.components['node-hub'][1].revision = 3;
  assert.throws(() => validateRegistry(skippedRevision), /node-hub revision at index 1 must be 2/);

  const malformedBuildId = clone();
  malformedBuildId.components.core[0].buildId = `sha256:${'F'.repeat(64)}`;
  assert.throws(() => validateRegistry(malformedBuildId), /valid SHA-256 build ID/);
});

test('Hub build registry advances only the component whose source changed', () => {
  const base = {
    schemaVersion: 1,
    components: {
      core: componentHistory('123'),
      'node-hub': componentHistory('4567'),
    }
  };
  const next = updatedRegistry(base, {
    core: buildId('3'),
    'node-hub': buildId('d'),
  });
  assert.equal(next.components.core.length, 3);
  assert.deepEqual(next.components['node-hub'].at(-1), { revision: 5, buildId: buildId('d') });
});
