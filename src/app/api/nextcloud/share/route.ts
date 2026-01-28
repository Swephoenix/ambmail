import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createShareLink, getValidToken } from '@/lib/nextcloud';

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getValidToken(user.id);
  if (!token || !token.ncUserId) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 });
  }

  const data = await req.json().catch(() => ({}));
  const filePath = String(data?.path || '');
  if (!filePath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 });
  }

  try {
    const url = await createShareLink(token.accessToken, filePath);
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Share failed' }, { status: 500 });
  }
}
