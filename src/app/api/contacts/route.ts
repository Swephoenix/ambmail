import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    },
    take: 10,
  });
  return NextResponse.json(contacts);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { email, name } = data;
    const contact = await prisma.contact.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });
    return NextResponse.json(contact);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
