import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

const DEFAULT_LABELS = [
  { name: 'Viktigt', color: '#DC2626' },
  { name: 'Kund', color: '#D97706' },
  { name: 'Intern', color: '#2563EB' },
  { name: 'Projekt', color: '#059669' },
  { name: 'Ekonomi', color: '#9333EA' },
  { name: 'HR', color: '#DB2777' },
];

function normalizeLabelName(value: string) {
  return value.trim();
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.label.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });

    if (existing.length === 0) {
      await prisma.label.createMany({
        data: DEFAULT_LABELS.map(label => ({
          userId: user.id,
          name: label.name,
          color: label.color,
        })),
        skipDuplicates: true,
      });
      const seeded = await prisma.label.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      });
      return NextResponse.json(seeded);
    }

    return NextResponse.json(existing);
  } catch (error: unknown) {
    console.error('Label Definitions Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, color } = await req.json();
    const normalizedName = normalizeLabelName(String(name || ''));
    if (!normalizedName || normalizedName.length > 40) {
      return NextResponse.json({ error: 'Invalid label name' }, { status: 400 });
    }

    const created = await prisma.label.create({
      data: {
        userId: user.id,
        name: normalizedName,
        color: String(color || 'gray'),
      },
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Label already exists' }, { status: 409 });
    }
    console.error('Label Create Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, color } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const normalizedName = normalizeLabelName(String(name || ''));
    if (!normalizedName || normalizedName.length > 40) {
      return NextResponse.json({ error: 'Invalid label name' }, { status: 400 });
    }

    const existing = await prisma.label.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 });
    }

    const updated = await prisma.label.update({
      where: { id },
      data: {
        name: normalizedName,
        color: String(color || existing.color),
      },
    });

    if (existing.name !== normalizedName) {
      const accounts = await prisma.account.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const accountIds = accounts.map(account => account.id);
      if (accountIds.length > 0) {
        await prisma.$executeRaw(
          Prisma.sql`UPDATE "EmailMessage" SET "labels" = array_replace("labels", ${existing.name}, ${normalizedName}) WHERE "accountId" IN (${Prisma.join(accountIds)}) AND ${existing.name} = ANY("labels")`
        );
      }
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Label already exists' }, { status: 409 });
    }
    console.error('Label Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const existing = await prisma.label.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 });
    }

    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    const accountIds = accounts.map(account => account.id);
    if (accountIds.length > 0) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "EmailMessage" SET "labels" = array_remove("labels", ${existing.name}) WHERE "accountId" IN (${Prisma.join(accountIds)}) AND ${existing.name} = ANY("labels")`
      );
    }

    await prisma.label.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Label Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
