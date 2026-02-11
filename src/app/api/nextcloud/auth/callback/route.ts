import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exchangeOAuthCodeForProfile, upsertOAuthTokenForUser } from '@/lib/nextcloud';

function nameFromProfile(email: string | null, displayName: string | null, ncUserId: string) {
  if (displayName?.trim()) return displayName.trim();
  if (email) {
    const localPart = email.split('@')[0] || 'User';
    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ') || 'User';
  }
  return ncUserId;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?nc=error&message=${encodeURIComponent(error)}`, req.url));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('uxmail_nc_state')?.value;
  cookieStore.set('uxmail_nc_state', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/?nc=state', req.url));
  }

  try {
    const { token, profile } = await exchangeOAuthCodeForProfile(code, req.url);
    const normalizedEmail = profile.email?.toLowerCase() ?? null;

    const existingByNc = await prisma.nextcloudToken.findFirst({
      where: { ncUserId: profile.ncUserId },
      include: { user: true },
    });

    let user = existingByNc?.user ?? null;

    if (!user) {
      let generatedUsername = normalizedEmail || `${profile.ncUserId}@nextcloud.local`;
      const usernameTaken = await prisma.user.findUnique({ where: { username: generatedUsername } });
      if (usernameTaken) {
        generatedUsername = `${profile.ncUserId}@nextcloud.local`;
      }
      user = await prisma.user.create({
        data: {
          username: generatedUsername,
          name: nameFromProfile(normalizedEmail, profile.displayName, profile.ncUserId),
          passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
        },
      });
    }

    await upsertOAuthTokenForUser(user.id, token, profile.ncUserId);
    const sessionToken = await createSession(user.id);
    await setSessionCookie(sessionToken);
    return NextResponse.redirect(new URL('/?nc=connected', req.url));
  } catch (err: unknown) {
    return NextResponse.redirect(
      new URL(`/?nc=error&message=${encodeURIComponent(err.message || 'failed')}`, req.url)
    );
  }
}
