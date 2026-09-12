'use strict';

const crypto = require('node:crypto');
const { fetchBufferedWithTimeout } = require('../shared/http');

// Official OpenAI Codex CLI OAuth Client ID
const CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_AUTH_URL = 'https://auth.openai.com/oauth/authorize';
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CODEX_REDIRECT_URI = 'http://localhost:1455/auth/callback';

// Antigravity CLI uses Google's installed-app OAuth flow. The callback is a
// hosted page; the Hub still receives the final URL from the user and binds it
// to this server-side PKCE session.
const AGY_OAUTH_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const AGY_AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const AGY_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AGY_REDIRECT_URI = 'https://antigravity.google/oauth-callback';
const AGY_SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
  'openid'
].join(' ');

const CODEX_CALLBACK_ORIGINS = new Set(['http://localhost:1455', 'http://127.0.0.1:1455']);
const AGY_CALLBACK_ORIGINS = new Set(['https://antigravity.google']);

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REDIRECT_URL_LENGTH = 16 * 1024;

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

function oauthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function tokenExpiry(tokens, nowMs = Date.now()) {
  const expiresIn = Number(tokens?.expires_in ?? tokens?.expiresIn);
  if (Number.isFinite(expiresIn) && expiresIn > 0) return nowMs + expiresIn * 1000;
  const expiresAt = Number(tokens?.expires_at ?? tokens?.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0) return expiresAt < 20_000_000_000 ? expiresAt * 1000 : expiresAt;
  return null;
}

function validateTokenResponse(tokens, provider, nowMs = Date.now()) {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    throw oauthError('token_response_invalid', `${provider} token response is invalid`);
  }
  const accessToken = String(tokens.access_token || tokens.accessToken || '').trim();
  if (!accessToken) throw oauthError('token_response_invalid', `${provider} token response has no access token`);
  return {
    accessToken,
    refreshToken: String(tokens.refresh_token || tokens.refreshToken || '').trim(),
    idToken: String(tokens.id_token || tokens.idToken || '').trim(),
    expiresAt: tokenExpiry(tokens, nowMs),
    raw: tokens
  };
}

function oauthProviderConfig(provider) {
  if (provider === 'codex') {
    return { clientId: CODEX_OAUTH_CLIENT_ID, tokenUrl: CODEX_TOKEN_URL, label: 'OpenAI' };
  }
  if (provider === 'antigravity') {
    return { clientId: AGY_OAUTH_CLIENT_ID, tokenUrl: AGY_TOKEN_URL, label: 'Google' };
  }
  throw oauthError('provider_unsupported', `Unsupported OAuth provider: ${provider}`);
}

async function refreshOAuthToken(provider, refreshToken, deps = {}) {
  const token = String(refreshToken || '').trim();
  if (!token) throw oauthError('refresh_token_missing', `${provider} refresh token is missing`);
  const config = oauthProviderConfig(provider);
  const fetchFn = deps.fetch || fetch;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: token
  }).toString();
  let res;
  try {
    res = await fetchBufferedWithTimeout(fetchFn, config.tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json'
      },
      body
    }, 15000);
  } catch (error) {
    throw oauthError('refresh_network_error', `${config.label} token refresh network failed: ${error.message}`);
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      message = json.error_description || json.error || message;
    } catch (_) {}
    throw oauthError('refresh_failed', `${config.label} token refresh failed: ${message}`);
  }
  return validateTokenResponse(await res.json(), config.label, deps.now ? deps.now() : Date.now());
}

function credentialWithOAuthTokens(provider, credential, tokens) {
  const next = {
    ...(credential && typeof credential === 'object' ? credential : {}),
    source: 'oauth',
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
    ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {})
  };
  if (provider !== 'codex') return next;

  let authJson = credential?.authJson;
  if (typeof authJson === 'string') {
    try { authJson = JSON.parse(authJson); } catch (_) { authJson = null; }
  }
  const auth = authJson && typeof authJson === 'object' && !Array.isArray(authJson)
    ? { ...authJson }
    : {};
  const oldTokens = auth.tokens && typeof auth.tokens === 'object' && !Array.isArray(auth.tokens)
    ? { ...auth.tokens }
    : {};
  auth.tokens = {
    ...oldTokens,
    access_token: tokens.accessToken,
    ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
    ...(tokens.idToken ? { id_token: tokens.idToken } : {}),
    ...(tokens.expiresAt ? { expires_at: tokens.expiresAt } : {})
  };
  next.authJson = auth;
  return next;
}

async function refreshOAuthCredential(provider, credential, deps = {}) {
  let authJson = credential?.authJson;
  if (typeof authJson === 'string') {
    try { authJson = JSON.parse(authJson); } catch (_) { authJson = null; }
  }
  const refreshToken = credential?.refreshToken || credential?.refresh_token
    || credential?.tokens?.refresh_token || authJson?.tokens?.refresh_token || authJson?.tokens?.refreshToken;
  const tokens = await refreshOAuthToken(provider, refreshToken, deps);
  return { credential: credentialWithOAuthTokens(provider, credential, tokens), tokens };
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
        response_type: 'code',
        client_id: AGY_OAUTH_CLIENT_ID,
        redirect_uri: AGY_REDIRECT_URI,
        scope: AGY_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: challenge,
        code_challenge_method: 'S256',
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
    const raw = String(rawUrl || '').trim();
    if (!raw || raw.length > MAX_REDIRECT_URL_LENGTH) {
      throw oauthError('invalid_redirect_url', 'Invalid redirect URL');
    }
    let parsed;
    let queryOnly = false;
    try {
      parsed = new URL(raw);
    } catch (_) {
      // If user pasted query string directly
      try {
        parsed = new URL(`http://localhost/redirect${raw.replace(/^\?/, '?')}`);
        queryOnly = true;
      } catch (_) {
        throw oauthError('invalid_redirect_url', 'Invalid redirect URL');
      }
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw oauthError('invalid_redirect_url', 'OAuth callback must use HTTP or HTTPS');
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

    if (expectedState && state !== expectedState) {
      throw oauthError('oauth_state_mismatch', 'OAuth state mismatch. Session may have expired or was tampered.');
    }

    return {
      code,
      state,
      origin: parsed.origin,
      queryOnly,
      accessToken,
      apiKey: apiKey || token,
      refreshToken: queryParams.get('refresh_token') || hashParams.get('refresh_token') || '',
      idToken: queryParams.get('id_token') || hashParams.get('id_token') || '',
      expiresIn: queryParams.get('expires_in') || hashParams.get('expires_in') || ''
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

    return validateTokenResponse(await res.json(), 'OpenAI', now());
  }

  async function exchangeAntigravityToken(code, verifier, deps = {}) {
    const fetchFn = deps.fetch || fetch;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: AGY_OAUTH_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: AGY_REDIRECT_URI
    }).toString();
    let res;
    try {
      res = await fetchBufferedWithTimeout(fetchFn, AGY_TOKEN_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json'
        },
        body
      }, 15000);
    } catch (err) {
      throw oauthError('exchange_network_error', `Google token exchange network failed: ${err.message}`);
    }
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        message = json.error_description || json.error || message;
      } catch (_) {}
      throw oauthError('exchange_failed', `Google token exchange failed: ${message}`);
    }
    return validateTokenResponse(await res.json(), 'Google', now());
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
    const allowedOrigins = session.provider === 'codex' ? CODEX_CALLBACK_ORIGINS : AGY_CALLBACK_ORIGINS;
    if (!parsed.queryOnly && !allowedOrigins.has(parsed.origin)) {
      throw oauthError('oauth_redirect_mismatch', 'OAuth callback URL does not match the selected provider.');
    }

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
          credential: { accessToken: parsed.accessToken, source: 'oauth' }
        };
      }
      const tokens = await exchangeCodexToken(parsed.code, session.verifier, deps);
      sessions.delete(sessionId);
      return {
        provider: 'codex',
        credential: {
          authJson: {
            tokens: {
              access_token: tokens.accessToken,
              ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
              ...(tokens.idToken ? { id_token: tokens.idToken } : {}),
              ...(tokens.raw.account_id ? { account_id: tokens.raw.account_id } : {}),
              ...(tokens.expiresAt ? { expires_at: tokens.expiresAt } : {})
            }
          },
          accessToken: tokens.accessToken,
          ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
          ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
          source: 'oauth'
        }
      };
    }

    if (session.provider === 'antigravity') {
      if (!parsed.code && !parsed.accessToken && !parsed.apiKey) {
        throw oauthError('code_missing', 'No authorization code found in the pasted URL.');
      }
      const tokens = parsed.code
        ? await exchangeAntigravityToken(parsed.code, session.verifier, deps)
        : {
            accessToken: parsed.apiKey || parsed.accessToken,
            refreshToken: parsed.refreshToken,
            idToken: parsed.idToken,
            expiresAt: tokenExpiry({ expires_in: parsed.expiresIn }, now())
          };
      sessions.delete(sessionId);
      return {
        provider: 'antigravity',
        credential: {
          source: 'oauth',
          accessToken: tokens.accessToken,
          ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
          ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
          ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {})
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
  AGY_AUTH_URL,
  AGY_OAUTH_CLIENT_ID,
  AGY_TOKEN_URL,
  AGY_REDIRECT_URI,
  refreshOAuthCredential,
  refreshOAuthToken
};
