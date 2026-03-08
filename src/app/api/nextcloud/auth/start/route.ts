import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthorizeUrl, getClientId, startOAuthState } from '@/lib/nextcloud';

export async function GET(req: Request) {
  const hostHeader = req.headers.get('host');
  const isLocalhost = hostHeader?.includes('localhost') || hostHeader?.includes('127.0.0.1');
  
  // Write to stderr to ensure it shows in logs
  console.error('[OAuth Start] Host header:', hostHeader, 'isLocalhost:', isLocalhost);
  console.error('[OAuth Start] Will use:', isLocalhost ? 'LOCALHOST client' : 'EXTERNAL client');
  
  console.log('[OAuth Start] === OAuth Start Request ===');
  console.log('[OAuth Start] Request URL:', req.url);
  console.log('[OAuth Start] Headers:', JSON.stringify({
    host: hostHeader,
    origin: req.headers.get('origin'),
    referer: req.headers.get('referer'),
  }, null, 2));

  const ncAuthUrl = process.env.NCAUTH_URL?.replace(/\/+$/, '');
  if (ncAuthUrl) {
    const requestUrl = new URL(req.url);
    const returnToBase = process.env.AMBMAIL_PUBLIC_URL?.replace(/\/+$/, '') || requestUrl.origin;
    const returnTo = `${returnToBase}/api/nextcloud/external/callback`;
    const externalUrl = new URL(`${ncAuthUrl}/auth/start`);
    externalUrl.searchParams.set('return_to', returnTo);
    console.log('[OAuth Start] Using external auth URL:', externalUrl.toString());
    return NextResponse.redirect(externalUrl.toString());
  }

  const state = await startOAuthState();
  console.log('[OAuth Start] Generated state:', state);
  
  const cookieStore = await cookies();
  cookieStore.set('ambmail_nc_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });
  console.log('[OAuth Start] Set state cookie');

  const clientId = await getClientId(req.url, req.headers.get('host') || undefined);
  console.log('[OAuth Start] Using client ID:', clientId.substring(0, 20) + '...');
  
  const authUrl = buildAuthorizeUrl(req.url, state, clientId);
  console.log('[OAuth Start] Redirecting to:', authUrl);
  
  return NextResponse.redirect(authUrl);
}
