import crypto from 'crypto';

type NcAuthProfile = {
  ncUserId: string;
  email: string | null;
  displayName: string | null;
};

type NcAuthOauth = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scope: string | null;
  tokenType: string | null;
};

export type NcAuthPayload = {
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  profile: NcAuthProfile;
  oauth: NcAuthOauth;
};

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function decodeJson<T>(encoded: string): T {
  return JSON.parse(fromBase64Url(encoded)) as T;
}

export function verifyNcAuthToken(token: string, secret: string): NcAuthPayload {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('invalid token format');
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('invalid token signature');
  }

  const header = decodeJson<{ alg?: string }>(encodedHeader);
  if (header.alg !== 'HS256') {
    throw new Error('unsupported token algorithm');
  }

  const payload = decodeJson<NcAuthPayload>(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new Error('token expired');
  }

  if (!payload.profile?.ncUserId || !payload.oauth?.accessToken) {
    throw new Error('missing token payload data');
  }

  return payload;
}

