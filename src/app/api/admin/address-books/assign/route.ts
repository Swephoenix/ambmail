import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();
  const { id, userIds } = data as { id?: string; userIds?: string[] };

  if (!id || !Array.isArray(userIds)) {
    return NextResponse.json({ error: 'id and userIds are required' }, { status: 400 });
  }

  const existing = await prisma.addressBookUser.findMany({
    where: { addressBookId: id },
  });
  const existingUserIds = new Set(existing.map((row) => row.userId));
  const incomingUserIds = new Set(userIds);

  const toAdd = userIds.filter((userId) => !existingUserIds.has(userId));
  const toRemove = existing.filter((row) => !incomingUserIds.has(row.userId));

  await prisma.$transaction([
    ...toAdd.map((userId) =>
      prisma.addressBookUser.create({
        data: {
          addressBookId: id,
          userId,
        },
      }),
    ),
    ...toRemove.map((row) =>
      prisma.addressBookUser.delete({
        where: {
          userId_addressBookId: {
            userId: row.userId,
            addressBookId: row.addressBookId,
          },
        },
      }),
    ),
  ]);

  return NextResponse.json({ success: true });
}
