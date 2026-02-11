const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cookieParser());
app.use(express.json());

function reqEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function signPayload(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

function verifyToken(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('invalid token format');
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('invalid signature');
  }
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new Error('token expired');
  }
  return payload;
}

function allowedOrigins() {
  return String(process.env.ALLOWED_RETURN_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateReturnTo(urlString) {
  const allowed = allowedOrigins();
  const returnTo = new URL(urlString);
  if (allowed.length === 0) {
    return returnTo.toString();
  }
  const origin = returnTo.origin;
  if (!allowed.includes(origin)) {
    throw new Error(`return_to origin not allowed: ${origin}`);
  }
  return returnTo.toString();
}

function buildRedirectUri() {
  const publicUrl = reqEnv('NCAUTH_PUBLIC_URL').replace(/\/+$/, '');
  return `${publicUrl}/auth/callback`;
}

function oauthBaseUrl() {
  return (process.env.NC_PUBLIC_URL || reqEnv('NC_BASE_URL')).replace(/\/+$/, '');
}

async function exchangeCodeForToken(code, redirectUri) {
  const ncBase = reqEnv('NC_BASE_URL').replace(/\/+$/, '');
  const clientId = reqEnv('NC_OAUTH_CLIENT_ID');
  const clientSecret = reqEnv('NC_OAUTH_CLIENT_SECRET');
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${ncBase}/index.php/apps/oauth2/api/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  });

  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data.error_description || data.error || text || `token request failed (${res.status})`);
  }
  return data;
}

async function fetchCurrentUserProfile(accessToken) {
  const ncBase = reqEnv('NC_BASE_URL').replace(/\/+$/, '');
  const res = await fetch(`${ncBase}/ocs/v2.php/cloud/user?format=json`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'OCS-APIREQUEST': 'true',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`user lookup failed (${res.status})`);
  }
  const ncUserId = data?.ocs?.data?.id || data?.ocs?.data?.uid;
  if (!ncUserId) {
    throw new Error('could not parse nc user id');
  }
  return {
    ncUserId: String(ncUserId),
    email: data?.ocs?.data?.email ? String(data.ocs.data.email).toLowerCase() : null,
    displayName: data?.ocs?.data?.displayname ? String(data.ocs.data.displayname) : null,
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ncauth' });
});

app.get('/auth/start', (req, res) => {
  try {
    const defaultReturnTo = reqEnv('UXMAIL_CALLBACK_URL');
    const returnToRaw = String(req.query.return_to || defaultReturnTo);
    const returnTo = validateReturnTo(returnToRaw);
    const state = crypto.randomBytes(16).toString('hex');
    const ttl = Number(process.env.STATE_TTL_SECONDS || 600);

    res.cookie(process.env.STATE_COOKIE_NAME || 'ncauth_state', JSON.stringify({ state, returnTo }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ttl * 1000,
    });

    const clientId = reqEnv('NC_OAUTH_CLIENT_ID');
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: buildRedirectUri(),
      state,
    });

    return res.redirect(`${oauthBaseUrl()}/index.php/apps/oauth2/authorize?${params.toString()}`);
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

app.get('/auth/callback', async (req, res) => {
  const cookieName = process.env.STATE_COOKIE_NAME || 'ncauth_state';
  const stateCookieRaw = req.cookies[cookieName];
  const stateFromQuery = String(req.query.state || '');
  const code = String(req.query.code || '');
  const error = String(req.query.error || '');

  if (error) {
    return res.status(400).json({ error });
  }

  if (!stateCookieRaw || !stateFromQuery || !code) {
    return res.status(400).json({ error: 'missing oauth callback data' });
  }

  let stateCookie;
  try {
    stateCookie = JSON.parse(stateCookieRaw);
  } catch {
    return res.status(400).json({ error: 'invalid state cookie' });
  } finally {
    res.clearCookie(cookieName, { path: '/' });
  }

  if (stateCookie.state !== stateFromQuery) {
    return res.status(400).json({ error: 'state mismatch' });
  }

  try {
    const token = await exchangeCodeForToken(code, buildRedirectUri());
    const profile = await fetchCurrentUserProfile(token.access_token);
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: reqEnv('NCAUTH_PUBLIC_URL'),
      aud: 'uxmail',
      iat: now,
      exp: now + 300,
      profile,
      oauth: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresIn: token.expires_in || null,
        scope: token.scope || null,
        tokenType: token.token_type || null,
      },
    };

    const signed = signPayload(payload, reqEnv('SHARED_SIGNING_SECRET'));
    const returnTo = validateReturnTo(stateCookie.returnTo);
    const url = new URL(returnTo);
    url.searchParams.set('nc_auth_token', signed);
    return res.redirect(url.toString());
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
});

app.post('/auth/verify', (req, res) => {
  try {
    const token = req.body?.token;
    const payload = verifyToken(token, reqEnv('SHARED_SIGNING_SECRET'));
    return res.json({ ok: true, payload });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

const port = Number(process.env.PORT || 4010);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[ncauth] listening on http://localhost:${port}`);
});

