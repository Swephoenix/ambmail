import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

const allowedColors = new Set(['emerald', 'amber', 'rose', 'sky']);

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = params.id;
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const data = await req.json();
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const location = typeof data.location === 'string' ? data.location.trim() : null;
    const startAt = parseDateParam(data.startAt ?? null);
    const endAt = parseDateParam(data.endAt ?? null);
    const color = allowedColors.has(data.color) ? data.color : existing.color;

    if (!title || !startAt || !endAt) {
      return NextResponse.json({ error: 'title, startAt, and endAt are required' }, { status: 400 });
    }
    if (endAt <= startAt) {
      return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 });
    }

    const updated = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        title,
        location: location || null,
        startAt,
        endAt,
        color,
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = params.id;
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await prisma.calendarEvent.delete({ where: { id: eventId } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
