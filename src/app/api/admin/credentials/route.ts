import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (admin.adminCredentialsShownAt) {
    return NextResponse.json({ shouldShow: false });
  }

  const payload = {
    shouldShow: true,
    adminUsername: process.env.ADMIN_USERNAME || admin.username,
    adminPassword: process.env.ADMIN_PASSWORD || '',
  };

  return NextResponse.json(payload);
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
