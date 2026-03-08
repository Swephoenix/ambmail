import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { upsertOAuthTokenForUser } from '@/lib/nextcloud';
import { verifyNcAuthToken } from '@/lib/ncauth';

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
  try {
    const url = new URL(req.url);
    const signedToken = url.searchParams.get('nc_auth_token') || '';
    const secret = process.env.SHARED_SIGNING_SECRET || '';
    if (!signedToken || !secret) {
      return NextResponse.redirect(new URL('/?nc=error&message=missing_ncauth_token', req.url));
    }

    const payload = verifyNcAuthToken(signedToken, secret);
    const profile = payload.profile;
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

    const token = {
      access_token: payload.oauth.accessToken,
      refresh_token: payload.oauth.refreshToken || undefined,
      expires_in: payload.oauth.expiresIn || undefined,
      scope: payload.oauth.scope || undefined,
      token_type: payload.oauth.tokenType || undefined,
    };
    await upsertOAuthTokenForUser(user.id, token, profile.ncUserId);

    const sessionToken = await createSession(user.id);
    await setSessionCookie(sessionToken);
    return NextResponse.redirect(new URL('/?nc=connected', req.url));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.redirect(
      new URL(`/?nc=error&message=${encodeURIComponent(message)}`, req.url),
    );
  }
}

