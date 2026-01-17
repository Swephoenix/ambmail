import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearSessionCookie, sessionCookies } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const isAdmin = searchParams.get('admin') === '1';
  const cookieStore = await cookies();
  const tokens = isAdmin
    ? [cookieStore.get(sessionCookies.admin)?.value]
    : [cookieStore.get(sessionCookies.user)?.value];

  for (const token of tokens) {
    if (token) {
      await prisma.userSession.deleteMany({ where: { token } });
    }
  }

  if (isAdmin) {
    await clearSessionCookie({ cookieName: sessionCookies.admin });
  } else {
    await clearSessionCookie({ cookieName: sessionCookies.user });
  }
  return NextResponse.json({ success: true });
}
