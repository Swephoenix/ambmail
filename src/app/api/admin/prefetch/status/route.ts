import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const status = await prisma.prefetchStatus.findUnique({ where: { userId } });
  if (!status) {
    return NextResponse.json({ status: 'none' });
  }

  return NextResponse.json({
    status: status.status,
    error: status.error,
    startedAt: status.startedAt,
    completedAt: status.completedAt,
  });
}
