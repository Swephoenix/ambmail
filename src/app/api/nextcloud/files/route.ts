import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getValidToken, listNextcloudFiles } from '@/lib/nextcloud';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getValidToken(user.id);
  if (!token || !token.ncUserId) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '';

  try {
    const entries = await listNextcloudFiles(token.accessToken, token.ncUserId, path);
    return NextResponse.json({ path, entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list files';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
