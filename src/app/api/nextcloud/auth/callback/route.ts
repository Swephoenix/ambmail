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
  console.log('[OAuth Callback] === OAuth Callback Request ===');
  console.log('[OAuth Callback] Request URL:', req.url);
  console.log('[OAuth Callback] Headers:', JSON.stringify({
    host: req.headers.get('host'),
    origin: req.headers.get('origin'),
    referer: req.headers.get('referer'),
  }, null, 2));

  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error');

  console.log('[OAuth Callback] Query params:', { code: code.substring(0, 20) + '...', state, error });

  // Determine the correct base URL for redirects
  // Use the referer header or fall back to AMBMAIL_PUBLIC_URL or request origin
  const referer = req.headers.get('referer');
  let baseUrl = url.origin;
  
  console.log('[OAuth Callback] Initial baseUrl:', baseUrl);
  console.log('[OAuth Callback] Referer header:', referer);

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      console.log('[OAuth Callback] Parsed referer URL:', {
        hostname: refererUrl.hostname,
        protocol: refererUrl.protocol,
        host: refererUrl.host,
        origin: refererUrl.origin,
      });
      // For localhost, ensure http protocol
      if (refererUrl.hostname === 'localhost' || refererUrl.hostname === '127.0.0.1') {
        baseUrl = `http://${refererUrl.host}`;
        console.log('[OAuth Callback] Localhost detected in referer, using:', baseUrl);
      } else {
        baseUrl = refererUrl.origin;
        console.log('[OAuth Callback] Using referer origin:', baseUrl);
      }
    } catch (e) {
      console.log('[OAuth Callback] Referer parse failed:', e);
      // If referer parsing fails, use request origin
    }
  } else if (process.env.AMBMAIL_PUBLIC_URL) {
    baseUrl = process.env.AMBMAIL_PUBLIC_URL.replace(/\/+$/, '');
    console.log('[OAuth Callback] No referer, using AMBMAIL_PUBLIC_URL:', baseUrl);
  } else {
    console.log('[OAuth Callback] No referer or AMBMAIL_PUBLIC_URL, using default origin:', baseUrl);
  }

  if (error) {
    console.log('[OAuth Callback] OAuth error, redirecting to:', `/?nc=error&message=${encodeURIComponent(error)}`);
    return NextResponse.redirect(new URL(`/?nc=error&message=${encodeURIComponent(error)}`, baseUrl));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('ambmail_nc_state')?.value;
  console.log('[OAuth Callback] Expected state from cookie:', expectedState);
  console.log('[OAuth Callback] Received state:', state);

  cookieStore.set('ambmail_nc_state', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  if (!code || !state || !expectedState || state !== expectedState) {
    console.log('[OAuth Callback] State mismatch or missing params:', {
      hasCode: !!code,
      hasState: !!state,
      hasExpectedState: !!expectedState,
      stateMatch: state === expectedState,
    });
    return NextResponse.redirect(new URL('/?nc=state', baseUrl));
  }

  console.log('[OAuth Callback] State validated, exchanging code for token...');

  try {
    const { token, profile } = await exchangeOAuthCodeForProfile(code, req.url);
    console.log('[OAuth Callback] Token exchange successful, profile:', {
      ncUserId: profile.ncUserId,
      email: profile.email,
      displayName: profile.displayName,
    });

    const normalizedEmail = profile.email?.toLowerCase() ?? null;

    const existingByNc = await prisma.nextcloudToken.findFirst({
      where: { ncUserId: profile.ncUserId },
      include: { user: true },
    });
    console.log('[OAuth Callback] Existing user by NC ID:', existingByNc?.user?.username || 'none');

    let user = existingByNc?.user ?? null;

    if (!user) {
      let generatedUsername = normalizedEmail || `${profile.ncUserId}@nextcloud.local`;
      const usernameTaken = await prisma.user.findUnique({ where: { username: generatedUsername } });
      if (usernameTaken) {
        generatedUsername = `${profile.ncUserId}@nextcloud.local`;
      }
      console.log('[OAuth Callback] Creating new user:', generatedUsername);
      user = await prisma.user.create({
        data: {
          username: generatedUsername,
          name: nameFromProfile(normalizedEmail, profile.displayName, profile.ncUserId),
          passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
        },
      });
      console.log('[OAuth Callback] User created:', user.id);
    }

    await upsertOAuthTokenForUser(user.id, token as { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string }, profile.ncUserId);
    console.log('[OAuth Callback] OAuth token stored');

    const sessionToken = await createSession(user.id);
    console.log('[OAuth Callback] Session created');

    await setSessionCookie(sessionToken);
    console.log('[OAuth Callback] Session cookie set');

    const redirectUrl = new URL('/?nc=connected', baseUrl);
    console.log('[OAuth Callback] Redirecting to:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);
  } catch (err: unknown) {
    console.error('[OAuth Callback] Error during OAuth flow:', err);
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.redirect(
      new URL(`/?nc=error&message=${encodeURIComponent(message)}`, baseUrl)
    );
  }
}
