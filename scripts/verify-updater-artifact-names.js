'use strict';

const fs = require('node:fs');
const path = require('node:path');

function stripYamlQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function artifactNameFromReference(value) {
  const reference = stripYamlQuotes(value);
  let pathname = reference;
  try {
    pathname = new URL(reference, 'https://release.invalid/').pathname;
  } catch (_) {}
  try {
    pathname = decodeURIComponent(pathname);
  } catch (_) {}
  return path.posix.basename(pathname);
}

function referencedArtifactNames(contents) {
  const names = new Set();
  const referencePattern = /^\s*(?:-\s*)?(?:url|path):\s*(.+?)\s*$/gm;
  for (const match of contents.matchAll(referencePattern)) {
    const name = artifactNameFromReference(match[1]);
    if (name) names.add(name);
  }
  return [...names];
}

function topLevelPathName(contents) {
  const match = String(contents).match(/^path:\s*(.+?)\s*$/m);
  return match ? artifactNameFromReference(match[1]) : '';
}

/**
 * AppImage is the only Linux target electron-updater can install in place, so
 * `latest-linux.yml` must point `path:` at the AppImage and list it in `files:`.
 *
 * This is not theoretical: a feed containing only the `.deb` was produced by a
 * real build, which silently leaves every AppImage install unable to
 * auto-update (AppImageUpdater finds no matching file and the download throws).
 * Listing the deb in `files:` as well is fine and expected.
 */
function verifyLinuxAppImageUpdaterFeed(distDir) {
  const feedPath = path.join(distDir, 'latest-linux.yml');
  if (!fs.existsSync(feedPath)) return { skipped: true };
  const contents = fs.readFileSync(feedPath, 'utf8');

  const primary = topLevelPathName(contents);
  if (!primary) {
    throw new Error('latest-linux.yml has no top-level path entry');
  }
  if (!primary.endsWith('.AppImage')) {
    throw new Error(
      `latest-linux.yml path is ${primary}; AppImage installs need path to be the .AppImage so electron-updater can find the download`
    );
  }

  const names = referencedArtifactNames(contents);
  if (!names.includes(primary)) {
    throw new Error(`latest-linux.yml path ${primary} is not listed in its files list`);
  }
  const appImages = names.filter((name) => name.endsWith('.AppImage'));
  if (appImages.length === 0) {
    throw new Error('latest-linux.yml does not list any AppImage artifact');
  }
  for (const name of appImages) {
    if (!fs.existsSync(path.join(distDir, name))) {
      throw new Error(`latest-linux.yml references a missing AppImage: ${name}`);
    }
  }
  return { primary, appImages };
}

function verifyUpdaterArtifactNames(distDir) {
  const metadataFiles = fs.readdirSync(distDir)
    .filter((name) => /^latest(?:-[^.]+)?\.ya?ml$/.test(name))
    .sort();
  if (metadataFiles.length === 0) {
    throw new Error(`No updater metadata found in ${distDir}`);
  }

  const missing = [];
  for (const metadataFile of metadataFiles) {
    const contents = fs.readFileSync(path.join(distDir, metadataFile), 'utf8');
    const names = referencedArtifactNames(contents);
    if (names.length === 0) {
      throw new Error(`${metadataFile} does not reference any artifacts`);
    }
    for (const name of names) {
      if (!fs.existsSync(path.join(distDir, name))) {
        missing.push(`${metadataFile} -> ${name}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Updater metadata references missing artifacts:\n${missing.join('\n')}`);
  }
  return { metadataFiles };
}

if (require.main === module) {
  const distDir = path.resolve(process.argv[2] || 'dist');
  try {
    const result = verifyUpdaterArtifactNames(distDir);
    const linux = verifyLinuxAppImageUpdaterFeed(distDir);
    console.log(`Verified updater artifact names in ${result.metadataFiles.join(', ')}`);
    if (!linux.skipped) {
      console.log(`Verified latest-linux.yml AppImage feed (path: ${linux.primary})`);
    }
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  artifactNameFromReference,
  referencedArtifactNames,
  verifyLinuxAppImageUpdaterFeed,
  verifyUpdaterArtifactNames
};
