'use strict';

const PROJECT_VERSION_PATTERN = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-rev\.(?<revision>[1-9]\d*))?$/;

function parseProjectVersion(value) {
  if (typeof value !== 'string') return null;
  const version = value.trim();
  const match = PROJECT_VERSION_PATTERN.exec(version);
  if (!match) return null;

  const major = Number(match.groups.major);
  const minor = Number(match.groups.minor);
  const patch = Number(match.groups.patch);
  const revision = match.groups.revision !== undefined ? Number(match.groups.revision) : null;

  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return null;
  }
  if (revision !== null && !Number.isSafeInteger(revision)) {
    return null;
  }

  return {
    version,
    major,
    minor,
    patch,
    revision,
    channel: revision !== null ? 'rev' : null,
    upstreamVersion: `${match.groups.major}.${match.groups.minor}.${match.groups.patch}`
  };
}

function parseProjectTag(tag) {
  if (typeof tag !== 'string') return null;
  return parseProjectVersion(tag.trim().replace(/^v/i, ''));
}

function isProjectVersion(value) {
  return Boolean(parseProjectVersion(value));
}

function compareProjectVersions(leftValue, rightValue) {
  const left = typeof leftValue === 'string' ? parseProjectVersion(leftValue) : leftValue;
  const right = typeof rightValue === 'string' ? parseProjectVersion(rightValue) : rightValue;
  if (!left || !right) return null;

  for (const name of ['major', 'minor', 'patch']) {
    if (left[name] !== right[name]) return left[name] > right[name] ? 1 : -1;
  }
  const leftRev = left.revision ?? 0;
  const rightRev = right.revision ?? 0;
  if (leftRev !== rightRev) return leftRev > rightRev ? 1 : -1;
  return 0;
}

module.exports = {
  PROJECT_VERSION_PATTERN,
  parseProjectVersion,
  parseProjectTag,
  isProjectVersion,
  compareProjectVersions
};
