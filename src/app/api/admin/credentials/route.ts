import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { rotateAdminCredentialsIfNeeded } from '@/lib/admin-credentials';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminCredentials = await rotateAdminCredentialsIfNeeded(admin.id);
  if (!adminCredentials) {
    return NextResponse.json({ shouldShow: false });
  }

  return NextResponse.json({
    shouldShow: true,
    ...adminCredentials,
  });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { adminCredentialsShownAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
