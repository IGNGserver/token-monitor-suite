'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ADMIN_SCOPE,
  INGEST_SCOPE,
  READ_SCOPE,
  createHubAuthPolicy,
  ingestCredentialEntries,
  secretMatches
} = require('../../src/shared/hubAuth');

function request(secret, url = 'https://hub.example/api/stats') {
  return new Request(url, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
}

test('Hub credentials enforce viewer, bound ingest, and admin capabilities', () => {
  const policy = createHubAuthPolicy({
    adminSecret: 'admin-secret',
    viewerSecret: 'viewer-secret',
    legacySecret: 'legacy-secret',
    ingestCredentials: { 'device-a': 'ingest-a' }
  });
  assert.equal(policy.authorize(request('viewer-secret'), READ_SCOPE).ok, true);
  assert.equal(policy.authorize(request('viewer-secret'), ADMIN_SCOPE).status, 403);
  assert.equal(policy.authorize(request('legacy-secret'), INGEST_SCOPE).status, 403);
  assert.equal(policy.authorize(request('ingest-a'), READ_SCOPE).ok, true);
  assert.equal(policy.authorize(request('ingest-a'), INGEST_SCOPE, { deviceId: 'device-a' }).ok, true);
  assert.equal(policy.authorize(request('ingest-a'), INGEST_SCOPE, { deviceId: 'device-b' }).error, 'device_identity_mismatch');
  assert.equal(policy.authorize(request('admin-secret'), ADMIN_SCOPE).ok, true);
  assert.equal(policy.authorize(request('wrong'), READ_SCOPE).status, 401);
});

test('query credentials are limited to viewer and strictly read-only legacy access', () => {
  const policy = createHubAuthPolicy({
    adminSecret: 'admin',
    viewerSecret: 'viewer',
    legacySecret: 'legacy-read',
    ingestCredentials: { dev: 'ingest' }
  });
  assert.equal(policy.authorize(new Request('https://hub.example/api/stats?secret=viewer'), READ_SCOPE).ok, true);
  assert.equal(policy.authorize(new Request('https://hub.example/api/stats?secret=legacy-read'), READ_SCOPE).ok, true);
  assert.equal(policy.authorize(new Request('https://hub.example/api/stats?secret=admin'), READ_SCOPE).status, 403);
  assert.equal(policy.authorize(new Request('https://hub.example/api/ingest?secret=ingest'), INGEST_SCOPE, { deviceId: 'dev' }).status, 403);

  for (const option of ['allowLegacyAdmin', 'allowLegacyIngest']) {
    const elevated = createHubAuthPolicy({ legacySecret: 'legacy-elevated', [option]: true });
    const result = elevated.authorize(
      new Request('https://hub.example/api/stats?secret=legacy-elevated'),
      READ_SCOPE
    );
    assert.equal(result.status, 403);
    assert.equal(result.error, 'query_credentials_are_read_only');
  }
});

test('legacy elevation is explicit and an unconfigured local policy remains usable', () => {
  const legacy = createHubAuthPolicy({ legacySecret: 'legacy', allowLegacyAdmin: true, allowLegacyIngest: true });
  assert.equal(legacy.authorize(request('legacy'), ADMIN_SCOPE).ok, true);
  assert.equal(legacy.authorize(request('legacy'), INGEST_SCOPE, { deviceId: 'any' }).ok, true);
  assert.equal(createHubAuthPolicy().authorize(request(''), ADMIN_SCOPE).ok, true);
});

test('ingest credential configuration rejects invalid or duplicate identities', () => {
  assert.deepEqual(ingestCredentialEntries('{"dev":"secret"}').map(({ deviceId }) => deviceId), ['dev']);
  assert.throws(() => ingestCredentialEntries('{bad'), /valid JSON/);
  assert.throws(() => ingestCredentialEntries([{ deviceId: 'a', secret: 'same' }, { deviceId: 'b', secret: 'same' }]), /unique/);
  assert.equal(secretMatches('same', 'same'), true);
  assert.equal(secretMatches('same', 'different'), false);
});

test('scoped credentials cannot collapse back into one ambiguous secret', () => {
  assert.throws(() => createHubAuthPolicy({
    adminSecret: 'same-token',
    viewerSecret: 'same-token'
  }), (error) => error?.code === 'duplicate_hub_credentials');
  assert.throws(() => createHubAuthPolicy({
    adminSecret: 'same-token',
    ingestCredentials: { laptop: 'same-token' }
  }), (error) => error?.code === 'duplicate_hub_credentials');
  assert.throws(() => createHubAuthPolicy({
    legacySecret: 'same-token',
    ingestCredentials: { laptop: 'same-token' }
  }), (error) => error?.code === 'duplicate_hub_credentials');
});
