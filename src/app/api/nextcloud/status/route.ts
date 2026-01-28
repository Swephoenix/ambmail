import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getValidToken } from '@/lib/nextcloud';

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const token = await getValidToken(user.id);
  if (!token) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    ncUserId: token.ncUserId,
  });
}
