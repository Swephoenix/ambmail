import crypto from 'crypto';
import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { readRuntimeOAuthConfig } from '@/lib/nextcloud-oauth-config';

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl() {
  return process.env.NC_BASE_URL || DEFAULT_BASE_URL;
}

function getPublicUrl() {
  return process.env.NC_PUBLIC_URL || getBaseUrl();
}

async function readClientCreds() {
  const clientId = process.env.NC_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NC_OAUTH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  const runtime = await readRuntimeOAuthConfig();
  if (runtime?.clientId && runtime?.clientSecret) {
    return {
      clientId: runtime.clientId,
      clientSecret: runtime.clientSecret,
    };
  }

  const dataPath = process.env.NC_OAUTH_DATA_PATH;
  if (!dataPath) {
    throw new Error('Missing Nextcloud OAuth client credentials');
  }
  const raw = await fs.readFile(dataPath, 'utf8');
  const idMatch = raw.match(/(client id|identifier)\s*:?\s*([^\s]+)/i);
  const secretMatch = raw.match(/(client secret|secret)\s*:?\s*([^\s]+)/i);
  if (!idMatch || !secretMatch) {
    throw new Error('Could not parse Nextcloud oauth2-client.txt');
  }
  return { clientId: idMatch[2], clientSecret: secretMatch[2] };
}

function getRedirectUri(requestUrl: string) {
  const configured = process.env.AMBMAIL_PUBLIC_URL;
  if (configured) {
    return `${configured.replace(/\/+$/, '')}/api/nextcloud/auth/callback`;
  }
  const origin = new URL(requestUrl).origin;
  return `${origin}/api/nextcloud/auth/callback`;
}

async function exchangeCodeForToken(code: string, redirectUri: string) {
  const { clientId, clientSecret } = await readClientCreds();
  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('code', code);
  params.set('redirect_uri', redirectUri);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${getBaseUrl()}/index.php/apps/oauth2/api/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = data.error_description || data.error || text || `token request failed (${res.status})`;
    throw new Error(err);
  }
  return data;
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = await readClientCreds();
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('refresh_token', refreshToken);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${getBaseUrl()}/index.php/apps/oauth2/api/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = data.error_description || data.error || text || `refresh request failed (${res.status})`;
    throw new Error(err);
  }
  return data;
}

type NextcloudUserProfile = {
  ncUserId: string;
  email: string | null;
  displayName: string | null;
};

async function fetchCurrentUserProfile(accessToken: string): Promise<NextcloudUserProfile> {
  const res = await fetch(`${getBaseUrl()}/ocs/v2.php/cloud/user?format=json`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'OCS-APIREQUEST': 'true',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error('user lookup failed');
  }
  const ncUserId = data?.ocs?.data?.id || data?.ocs?.data?.uid;
  if (!ncUserId) {
    throw new Error('could not read user id');
  }
  const email = data?.ocs?.data?.email ? String(data.ocs.data.email).toLowerCase() : null;
  const displayName = data?.ocs?.data?.displayname ? String(data.ocs.data.displayname) : null;
  return {
    ncUserId: String(ncUserId),
    email,
    displayName,
  };
}

function normalizePath(rawPath?: string | null) {
  return String(rawPath || '')
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/^\//, '');
}

async function upsertToken(userId: string, token: unknown, ncUserId?: string | null) {
  const expiresIn = Number(token.expires_in || 0);
  const expiresAt = expiresIn ? new Date(Date.now() + Math.max(expiresIn - 60, 0) * 1000) : null;

  return prisma.nextcloudToken.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt,
      tokenType: token.token_type || null,
      scope: token.scope || null,
      ncUserId: ncUserId || null,
    },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || undefined,
      expiresAt,
      tokenType: token.token_type || undefined,
      scope: token.scope || undefined,
      ncUserId: ncUserId || undefined,
    },
  });
}

export async function startOAuthState() {
  return crypto.randomBytes(16).toString('hex');
}

export function buildAuthorizeUrl(requestUrl: string, state: string, clientId: string) {
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('response_type', 'code');
  params.set('redirect_uri', getRedirectUri(requestUrl));
  params.set('state', state);
  return `${getPublicUrl()}/index.php/apps/oauth2/authorize?${params.toString()}`;
}

export async function getClientId() {
  const { clientId } = await readClientCreds();
  return clientId;
}

export async function handleOAuthCallback(userId: string, code: string, requestUrl: string) {
  const token = await exchangeCodeForToken(code, getRedirectUri(requestUrl));
  const profile = await fetchCurrentUserProfile(token.access_token);
  const ncUserId = profile.ncUserId;
  await upsertToken(userId, token, ncUserId);
  return ncUserId;
}

export async function exchangeOAuthCodeForProfile(code: string, requestUrl: string) {
  const token = await exchangeCodeForToken(code, getRedirectUri(requestUrl));
  const profile = await fetchCurrentUserProfile(token.access_token);
  return { token, profile };
}

export async function upsertOAuthTokenForUser(userId: string, token: unknown, ncUserId: string) {
  await upsertToken(userId, token, ncUserId);
}

export async function getValidToken(userId: string) {
  const stored = await prisma.nextcloudToken.findUnique({ where: { userId } });
  if (!stored) return null;
  let tokenRecord = stored;
  if (tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() <= Date.now()) {
    if (!tokenRecord.refreshToken) return null;
    const refreshed = await refreshAccessToken(tokenRecord.refreshToken);
    await upsertToken(userId, refreshed, tokenRecord.ncUserId);
    const updated = await prisma.nextcloudToken.findUnique({ where: { userId } });
    if (!updated) return null;
    tokenRecord = updated;
  }
  if (!tokenRecord.ncUserId) {
    try {
      const profile = await fetchCurrentUserProfile(tokenRecord.accessToken);
      const ncUserId = profile.ncUserId;
      await prisma.nextcloudToken.update({
        where: { userId },
        data: { ncUserId },
      });
      tokenRecord = { ...tokenRecord, ncUserId };
    } catch {
      // If we cannot resolve the user, treat it as not connected.
      return null;
    }
  }
  return tokenRecord;
}

export async function listNextcloudFiles(accessToken: string, ncUserId: string, path?: string | null) {
  const cleanPath = normalizePath(path);
  const base = `${getBaseUrl()}/remote.php/dav/files/${encodeURIComponent(ncUserId)}/`;
  const url = `${base}${cleanPath}`;
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Depth: '1',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`file list failed (${res.status})`);
  }

  const prefix = `/remote.php/dav/files/${ncUserId}/`;
  const entries = [];
  const responses = Array.from(text.matchAll(/<d:response>([\s\S]*?)<\/d:response>/g)).map((m) => m[1]);
  for (const block of responses) {
    const hrefMatch = block.match(/<d:href>([^<]+)<\/d:href>/);
    if (!hrefMatch) continue;
    const href = decodeURIComponent(hrefMatch[1]);
    if (!href.startsWith(prefix)) continue;
    let itemPath = href.slice(prefix.length);
    if (!itemPath || itemPath === '/') continue;
    const isDir = /<d:collection\/>/.test(block);
    if (isDir && !itemPath.endsWith('/')) itemPath += '/';
    const nameMatch = block.match(/<d:displayname>([^<]+)<\/d:displayname>/);
    const sizeMatch = block.match(/<d:getcontentlength>([^<]+)<\/d:getcontentlength>/);
    const name = nameMatch ? nameMatch[1] : itemPath.replace(/\/$/, '').split('/').pop();
    const size = sizeMatch ? Number(sizeMatch[1]) : null;
    entries.push({ path: itemPath, isDir, name, size });
  }

  return entries.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return String(a.name).localeCompare(String(b.name));
  });
}

export async function downloadNextcloudFile(accessToken: string, ncUserId: string, path: string) {
  const cleanPath = normalizePath(path);
  const base = `${getBaseUrl()}/remote.php/dav/files/${encodeURIComponent(ncUserId)}/`;
  const url = `${base}${cleanPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `download failed (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    buffer,
    contentType: res.headers.get('content-type') || undefined,
    size: Number(res.headers.get('content-length')) || buffer.length,
    name: cleanPath.split('/').pop() || 'file',
  };
}

export async function createShareLink(accessToken: string, path: string) {
  const cleanPath = normalizePath(path);
  const params = new URLSearchParams();
  params.set('path', `/${cleanPath}`);
  params.set('shareType', '3');

  const res = await fetch(`${getBaseUrl()}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'OCS-APIRequest': 'true',
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.ocs?.meta?.message || data?.ocs?.meta?.statuscode || res.status;
    throw new Error(`share failed (${err})`);
  }
  const url = data?.ocs?.data?.url;
  if (!url) {
    throw new Error('missing share url');
  }
  return url;
}
