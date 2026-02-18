import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';

const ADMIN_COOKIE = 'ambmail_admin_panel';
const ADMIN_COOKIE_TTL_SECONDS = 60 * 60 * 12;

function getConfiguredSecret() {
  return process.env.ADMIN_PANEL_SECRET?.trim() || '';
}

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function isAdminSecretConfigured() {
  return Boolean(getConfiguredSecret());
}

export function verifyAdminPanelPassword(password: string) {
  const configured = getConfiguredSecret();
  if (!configured) return false;
  return safeEqual(hashValue(password.trim()), hashValue(configured));
}

export async function setAdminPanelCookie() {
  const configured = getConfiguredSecret();
  if (!configured) return;
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, hashValue(configured), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_COOKIE_TTL_SECONDS,
  });
}

export async function clearAdminPanelCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function hasAdminPanelCookie() {
  const configured = getConfiguredSecret();
  if (!configured) return false;

  const cookieStore = await cookies();
  const current = cookieStore.get(ADMIN_COOKIE)?.value || '';
  if (!current) return false;
  return safeEqual(current, hashValue(configured));
}

export async function hasAdminAccess() {
  const sessionUser = await getSessionUser();
  if (sessionUser?.role === 'ADMIN') return true;
  return hasAdminPanelCookie();
}
