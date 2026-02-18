import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearSessionCookie } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('ambmail_session')?.value;

  if (token) {
    await prisma.userSession.deleteMany({ where: { token } });
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
