import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthorizeUrl, getClientId, startOAuthState } from '@/lib/nextcloud';

export async function GET(req: Request) {
  const ncAuthUrl = process.env.NCAUTH_URL?.replace(/\/+$/, '');
  if (ncAuthUrl) {
    const requestUrl = new URL(req.url);
    const returnToBase = process.env.AMBMAIL_PUBLIC_URL?.replace(/\/+$/, '') || requestUrl.origin;
    const returnTo = `${returnToBase}/api/nextcloud/external/callback`;
    const externalUrl = new URL(`${ncAuthUrl}/auth/start`);
    externalUrl.searchParams.set('return_to', returnTo);
    return NextResponse.redirect(externalUrl.toString());
  }

  const state = await startOAuthState();
  const cookieStore = await cookies();
  cookieStore.set('ambmail_nc_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });

  const clientId = await getClientId();
  const authUrl = buildAuthorizeUrl(req.url, state, clientId);
  return NextResponse.redirect(authUrl);
}
