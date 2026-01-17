import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const books = await prisma.addressBook.findMany({
    include: {
      users: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    addressBooks: books.map((book) => ({
      id: book.id,
      name: book.name,
      description: book.description,
      userIds: book.users.map((user) => user.userId),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();
  const { name, description } = data;
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const book = await prisma.addressBook.create({
    data: {
      name,
      description: description || null,
    },
  });

  return NextResponse.json({ id: book.id });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();
  const { id, name, description } = data;
  if (!id || !name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }

  await prisma.addressBook.update({
    where: { id },
    data: {
      name,
      description: description || null,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();
  const { id } = data;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await prisma.addressBook.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
