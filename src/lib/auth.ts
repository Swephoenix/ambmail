import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';

const SESSION_COOKIE = 'uxmail_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export { hashPassword, verifyPassword };

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.userSession.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
  return token;
}

export async function setSessionCookie(
  token: string,
  options: { cookieName?: string } = {},
) {
  const cookieStore = await cookies();
  const cookieName = options.cookieName ?? SESSION_COOKIE;
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(options: { cookieName?: string } = {}) {
  const cookieStore = await cookies();
  const cookieName = options.cookieName ?? SESSION_COOKIE;
  cookieStore.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionUser(cookieName: string = SESSION_COOKIE) {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.userSession.delete({ where: { token } });
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) return null;
  const hasNextcloudSession = await prisma.nextcloudToken.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  return hasNextcloudSession ? user : null;
}
