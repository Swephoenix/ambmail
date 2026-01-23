import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

const allowedColors = new Set(['emerald', 'amber', 'rose', 'sky']);

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = parseDateParam(searchParams.get('start'));
  const end = parseDateParam(searchParams.get('end'));

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required ISO dates' }, { status: 400 });
  }

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId: user.id,
      startAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { startAt: 'asc' },
  });

  return NextResponse.json(events);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const location = typeof data.location === 'string' ? data.location.trim() : null;
    const startAt = parseDateParam(data.startAt ?? null);
    const endAt = parseDateParam(data.endAt ?? null);
    const color = allowedColors.has(data.color) ? data.color : 'emerald';

    if (!title || !startAt || !endAt) {
      return NextResponse.json({ error: 'title, startAt, and endAt are required' }, { status: 400 });
    }
    if (endAt <= startAt) {
      return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title,
        location: location || null,
        startAt,
        endAt,
        color,
      },
    });

    return NextResponse.json(event);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
