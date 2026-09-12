'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AGY_REDIRECT_URI,
  CODEX_REDIRECT_URI,
  createOAuthSessionManager
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
