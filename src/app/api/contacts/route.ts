import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  const contacts = await prisma.contact.findMany({
    where: {
      userId: user.id,
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 10,
  });
  return NextResponse.json(contacts);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await req.json();
    const { email, name } = data;
    const contact = await prisma.contact.upsert({
      where: {
        userId_email: {
          userId: user.id,
          email,
        },
      },
      update: { name },
      create: { email, name, userId: user.id },
    });
    return NextResponse.json(contact);
  } catch (error: unknown) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
