import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { buildAuthorizeUrl, getClientId, startOAuthState } from '@/lib/nextcloud';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.redirect(new URL('/?nc=unauthorized', req.url));
  }

  const state = await startOAuthState();
  const cookieStore = await cookies();
  cookieStore.set('uxmail_nc_state', state, {
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
