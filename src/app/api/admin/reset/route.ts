import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accountIds = await prisma.account.findMany({
    select: { id: true },
  });
  const accountIdList = accountIds.map((item) => item.id);

  await prisma.$transaction([
    prisma.userSession.deleteMany({}),
    ...(accountIdList.length > 0
      ? [
          prisma.emailMessage.deleteMany({ where: { accountId: { in: accountIdList } } }),
          prisma.mailSyncState.deleteMany({ where: { accountId: { in: accountIdList } } }),
        ]
      : []),
    prisma.account.deleteMany({}),
    prisma.contact.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  return NextResponse.json({ success: true });
}
