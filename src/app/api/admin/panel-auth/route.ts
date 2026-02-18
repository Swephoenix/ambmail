import { NextResponse } from 'next/server';
import {
  clearAdminPanelCookie,
  isAdminSecretConfigured,
  setAdminPanelCookie,
  verifyAdminPanelPassword,
} from '@/lib/admin-access';

export async function POST(req: Request) {
  if (!isAdminSecretConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_PANEL_SECRET is not configured on server.' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  if (!verifyAdminPanelPassword(password)) {
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 401 });
  }

  await setAdminPanelCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearAdminPanelCookie();
  return NextResponse.json({ ok: true });
}
