'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AGY_OAUTH_CLIENT_SECRET,
  AGY_REDIRECT_URI,
  CODEX_REDIRECT_URI,
  createOAuthSessionManager,
  refreshOAuthToken
} = require('../../src/hub/oauthService');

function sessionState(session) {
  return new URL(session.authUrl).searchParams.get('state');
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('OAuth callbacks require the server-issued state', () => {
  const manager = createOAuthSessionManager({ now: () => Date.parse('2026-09-12T00:00:00Z') });
  const session = manager.startSession('codex');
  const state = sessionState(session);

  assert.throws(
    () => manager.parseRedirectUrl(`${CODEX_REDIRECT_URI}?code=code`, state),
    { code: 'oauth_state_mismatch' }
  );
  assert.deepEqual(
    manager.parseRedirectUrl(`${CODEX_REDIRECT_URI}?code=code&state=${encodeURIComponent(state)}`, state).code,
    'code'
  );
});

test('OAuth callbacks reject a valid state from the wrong origin', async () => {
  const manager = createOAuthSessionManager();
  const session = manager.startSession('antigravity');
  const state = sessionState(session);

  await assert.rejects(
    manager.exchangeSession(
      session.sessionId,
      `https://evil.example/callback?state=${encodeURIComponent(state)}&access_token=token`
    ),
    { code: 'oauth_redirect_mismatch' }
  );
});

test('OAuth token exchange validates the token response and keeps failed sessions retryable', async () => {
  const manager = createOAuthSessionManager();
  const session = manager.startSession('codex');
  const state = sessionState(session);

  await assert.rejects(
    manager.exchangeSession(
      session.sessionId,
      `${CODEX_REDIRECT_URI}?state=${encodeURIComponent(state)}&code=one-time-code`,
      { fetch: async () => jsonResponse({ expires_in: 3600 }) }
    ),
    { code: 'token_response_invalid' }
  );
  assert.equal(manager._sessions.has(session.sessionId), true);
});

test('Antigravity OAuth exchanges hosted callback codes into a refreshable credential', async () => {
  const now = Date.parse('2026-09-12T00:00:00Z');
  const manager = createOAuthSessionManager({ now: () => now });
  const session = manager.startSession('antigravity');
  const state = sessionState(session);
  let tokenRequest;

  const result = await manager.exchangeSession(
    session.sessionId,
    `${AGY_REDIRECT_URI}?state=${encodeURIComponent(state)}&code=google-code`,
    {
      fetch: async (url, init) => {
        tokenRequest = { url, init };
        return jsonResponse({ access_token: 'agy-access', refresh_token: 'agy-refresh', expires_in: 3600 });
      }
    }
  );

  assert.equal(result.provider, 'antigravity');
  assert.equal(result.credential.accessToken, 'agy-access');
  assert.equal(result.credential.refreshToken, 'agy-refresh');
  assert.equal(result.credential.expiresAt, now + 3600 * 1000);
  assert.equal(tokenRequest.url, 'https://oauth2.googleapis.com/token');
  assert.match(String(tokenRequest.init.body), /grant_type=authorization_code/);
  assert.equal(manager._sessions.has(session.sessionId), false);
});

test('Antigravity exchanges the bare authorization code Google displays on its page', async () => {
  const now = Date.parse('2026-09-12T00:00:00Z');
  const manager = createOAuthSessionManager({ now: () => now });
  const session = manager.startSession('antigravity');
  const verifier = manager._sessions.get(session.sessionId).verifier;
  let tokenBody;

  // Google's copy-code page never puts the code in the address bar and does not
  // echo the state, so the pasted value is the code alone (whitespace, quotes and
  // the page's own label text may come along with it).
  const result = await manager.exchangeSession(
    session.sessionId,
    '  "4/0AX4XfWhGoogleCode-example_1" \n',
    {
      fetch: async (url, init) => {
        tokenBody = new URLSearchParams(String(init.body));
        return jsonResponse({ access_token: 'agy-access', refresh_token: 'agy-refresh', expires_in: 3600 });
      }
    }
  );

  assert.equal(result.provider, 'antigravity');
  assert.equal(result.credential.accessToken, 'agy-access');
  assert.equal(tokenBody.get('code'), '4/0AX4XfWhGoogleCode-example_1');
  assert.equal(tokenBody.get('redirect_uri'), AGY_REDIRECT_URI);
  assert.equal(tokenBody.get('code_verifier'), verifier);
  // Google's installed-app token endpoint refuses both grants without this.
  assert.equal(tokenBody.get('client_secret'), AGY_OAUTH_CLIENT_SECRET);
  assert.equal(manager._sessions.has(session.sessionId), false);
});

test('Antigravity accepts schemeless callbacks and code= pastes', async () => {
  const code = '4/0AX4XfWhGoogleCode-example_2';
  const cases = [
    `code=${encodeURIComponent(code)}`,
    `?code=${encodeURIComponent(code)}`,
    `antigravity.google/oauth-callback?code=${encodeURIComponent(code)}`,
    `Authorization code: ${code}`
  ];
  for (const input of cases) {
    const manager = createOAuthSessionManager();
    const session = manager.startSession('antigravity');
    const result = await manager.exchangeSession(session.sessionId, input, {
      fetch: async () => jsonResponse({ access_token: 'agy-access', expires_in: 3600 })
    });
    assert.equal(result.credential.accessToken, 'agy-access', input);
  }
});

test('OAuth input that carries no code fails loudly instead of parsing to nothing', () => {
  const manager = createOAuthSessionManager();
  const session = manager.startSession('antigravity');
  const state = sessionState(session);

  // The provider's own page (no callback parameters) is a different mistake from
  // a tampered state, and must say so.
  assert.throws(
    () => manager.parseRedirectUrl('https://accounts.google.com/o/oauth2/approval?as=abc', state),
    { code: 'code_missing' }
  );
  assert.throws(
    () => manager.parseRedirectUrl('this is not an authorization code', state),
    { code: 'invalid_redirect_url' }
  );
  // A state that *is* present must still match, whatever the input shape.
  assert.throws(
    () => manager.parseRedirectUrl(`?code=google-code&state=wrong`, state),
    { code: 'oauth_state_mismatch' }
  );
});

test('Google token refresh sends the installed-app client secret', async () => {
  let body;
  await refreshOAuthToken('antigravity', 'agy-refresh', {
    env: {},
    fetch: async (url, init) => {
      body = new URLSearchParams(String(init.body));
      return jsonResponse({ access_token: 'agy-access', expires_in: 3600 });
    }
  });

  assert.equal(body.get('grant_type'), 'refresh_token');
  assert.equal(body.get('refresh_token'), 'agy-refresh');
  assert.equal(body.get('client_secret'), AGY_OAUTH_CLIENT_SECRET);
});

test('AGY_OAUTH_CLIENT_SECRET overrides the pinned Google client secret', async () => {
  let body;
  await refreshOAuthToken('antigravity', 'agy-refresh', {
    env: { AGY_OAUTH_CLIENT_SECRET: 'rotated-secret' },
    fetch: async (url, init) => {
      body = new URLSearchParams(String(init.body));
      return jsonResponse({ access_token: 'agy-access', expires_in: 3600 });
    }
  });

  assert.equal(body.get('client_secret'), 'rotated-secret');
});
