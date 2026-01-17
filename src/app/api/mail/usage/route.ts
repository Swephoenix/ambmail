import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await prisma.$queryRaw<{ bytes: bigint }[]>`
    SELECT COALESCE(SUM(pg_column_size(em)), 0) AS bytes
    FROM "EmailMessage" em
    JOIN "Account" a ON em."accountId" = a.id
    WHERE a."userId" = ${user.id}
  `;

  const usedBytes = result[0]?.bytes ?? BigInt(0);

  return NextResponse.json({
    usedBytes: usedBytes.toString(),
    quotaMb: user.mailQuotaMb,
  });
}
