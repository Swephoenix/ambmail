import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { handleOAuthCallback } from '@/lib/nextcloud';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error');

  const user = await requireUser();
  if (!user) {
    return NextResponse.redirect(new URL('/?nc=unauthorized', req.url));
  }

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
    await handleOAuthCallback(user.id, code, req.url);
    return NextResponse.redirect(new URL('/?nc=connected', req.url));
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/?nc=error&message=${encodeURIComponent(err.message || 'failed')}`, req.url)
    );
  }
}
