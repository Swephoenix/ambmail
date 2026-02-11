import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const nextcloudConnection = await prisma.nextcloudToken.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!nextcloudConnection) {
    return NextResponse.json({ error: 'Nextcloud authentication required' }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.username,
    username: user.username,
    name: user.name,
    department: user.department,
    role: user.role,
  });
}
