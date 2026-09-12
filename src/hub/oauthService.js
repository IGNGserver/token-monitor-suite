'use strict';

const crypto = require('node:crypto');
const { fetchBufferedWithTimeout } = require('../shared/http');

// Official OpenAI Codex CLI OAuth Client ID
const CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_AUTH_URL = 'https://auth.openai.com/oauth/authorize';
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CODEX_REDIRECT_URI = 'http://localhost:1455/auth/callback';

// Codeium / Antigravity Auth Base URL
const AGY_AUTH_URL = 'https://codeium.com/profile';

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkce() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function createOAuthSessionManager({ now = Date.now, ttlMs = SESSION_TTL_MS } = {}) {
  const sessions = new Map();

  function cleanup() {
    const current = now();
    for (const [id, session] of sessions.entries()) {
      if (current - session.createdAt > ttlMs) {
        sessions.delete(id);
      }
    }
  }

  function startSession(provider) {
    cleanup();
    const sessionId = crypto.randomUUID();
    const state = base64UrlEncode(crypto.randomBytes(24));
    const { verifier, challenge } = generatePkce();

    let authUrl;
    if (provider === 'codex') {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CODEX_OAUTH_CLIENT_ID,
        redirect_uri: CODEX_REDIRECT_URI,
        scope: 'openid profile email offline_access api.connectors.read api.connectors.invoke',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        id_token_add_organizations: 'true',
        codex_cli_simplified_flow: 'true',
        state,
        originator: 'codex_cli_rs'
      });
      authUrl = `${CODEX_AUTH_URL}?${params.toString()}`;
    } else if (provider === 'antigravity') {
      const params = new URLSearchParams({
        redirect_uri: 'http://localhost:8080/callback',
        state
      });
      authUrl = `${AGY_AUTH_URL}?${params.toString()}`;
    } else {
      const err = new Error(`Unsupported OAuth provider: ${provider}`);
      err.code = 'provider_unsupported';
      throw err;
    }

    sessions.set(sessionId, {
      id: sessionId,
      provider,
      verifier,
      state,
      createdAt: now()
    });

    return { sessionId, authUrl, provider };
  }

  function parseRedirectUrl(rawUrl, expectedState = '') {
    let parsed;
    try {
      parsed = new URL(String(rawUrl || '').trim());
    } catch (_) {
      // If user pasted query string directly
      try {
        parsed = new URL(`http://localhost:8080/${String(rawUrl || '').trim().replace(/^\?/, '?')}`);
      } catch (_) {
        const error = new Error('Invalid redirect URL');
        error.code = 'invalid_redirect_url';
        throw error;
      }
    }

    // Query params or Hash params
    const queryParams = parsed.searchParams;
    let hashParams = new URLSearchParams();
    if (parsed.hash && parsed.hash.length > 1) {
      hashParams = new URLSearchParams(parsed.hash.slice(1));
    }

    const code = queryParams.get('code') || hashParams.get('code') || '';
    const state = queryParams.get('state') || hashParams.get('state') || '';
    const accessToken = queryParams.get('access_token') || hashParams.get('access_token') || '';
    const apiKey = queryParams.get('api_key') || hashParams.get('api_key') || '';
    const token = queryParams.get('token') || hashParams.get('token') || '';
    const error = queryParams.get('error') || hashParams.get('error') || '';
    const errorDescription = queryParams.get('error_description') || hashParams.get('error_description') || '';

    if (error) {
      const err = new Error(errorDescription || `OAuth authorization failed: ${error}`);
      err.code = 'oauth_error';
      throw err;
    }

    if (expectedState && state && state !== expectedState) {
      const err = new Error('OAuth state mismatch. Session may have expired or was tampered.');
      err.code = 'oauth_state_mismatch';
      throw err;
    }

    return {
      code,
      state,
      accessToken,
      apiKey: apiKey || token
    };
  }

  async function exchangeCodexToken(code, verifier, deps = {}) {
    const fetchFn = deps.fetch || fetch;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CODEX_OAUTH_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: CODEX_REDIRECT_URI
    }).toString();

    let res;
    try {
      res = await fetchBufferedWithTimeout(fetchFn, CODEX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json'
        },
        body
      }, 15000);
    } catch (err) {
      const error = new Error(`OpenAI token exchange network failed: ${err.message}`);
      error.code = 'exchange_network_error';
      throw error;
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        message = json.error_description || json.error || message;
      } catch (_) {}
      const error = new Error(`Token exchange failed: ${message}`);
      error.code = 'exchange_failed';
      throw error;
    }

    const tokens = await res.json();
    return tokens;
  }

  async function exchangeSession(sessionId, redirectUrl, deps = {}) {
    cleanup();
    const session = sessions.get(sessionId);
    if (!session) {
      const error = new Error('OAuth session not found or has expired. Please restart authorization.');
      error.code = 'session_expired';
      throw error;
    }

    const parsed = parseRedirectUrl(redirectUrl, session.state);

    if (session.provider === 'codex') {
      if (!parsed.code && !parsed.accessToken) {
        const error = new Error('No authorization code found in the pasted URL.');
        error.code = 'code_missing';
        throw error;
      }
      if (parsed.accessToken) {
        sessions.delete(sessionId);
        return {
          provider: 'codex',
          credential: { accessToken: parsed.accessToken }
        };
      }
      const tokens = await exchangeCodexToken(parsed.code, session.verifier, deps);
      sessions.delete(sessionId);
      return {
        provider: 'codex',
        credential: {
          authJson: {
            tokens: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              id_token: tokens.id_token,
              account_id: tokens.account_id
            }
          },
          accessToken: tokens.access_token
        }
      };
    }

    if (session.provider === 'antigravity') {
      sessions.delete(sessionId);
      const token = parsed.apiKey || parsed.accessToken || parsed.code;
      if (!token) {
        const error = new Error('No authentication token found in the pasted URL.');
        error.code = 'token_missing';
        throw error;
      }
      return {
        provider: 'antigravity',
        credential: {
          csrfToken: token,
          endpoint: 'http://127.0.0.1:0'
        }
      };
    }

    throw new Error(`Unsupported provider: ${session.provider}`);
  }

  return {
    startSession,
    parseRedirectUrl,
    exchangeSession,
    _sessions: sessions
  };
}

module.exports = {
  createOAuthSessionManager,
  CODEX_OAUTH_CLIENT_ID,
  CODEX_AUTH_URL,
  CODEX_TOKEN_URL,
  CODEX_REDIRECT_URI,
  AGY_AUTH_URL
};
