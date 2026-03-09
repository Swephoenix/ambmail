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
  const groupId = searchParams.get('groupId') || '';
  const showAll = searchParams.get('showAll') === 'true';
  const forSuggestion = searchParams.get('forSuggestion') === 'true';

  // If requesting for suggestions, return both contacts and groups
  if (forSuggestion) {
    const contacts = await prisma.contact.findMany({
      where: {
        userId: user.id,
        isActive: true,
        ...(q ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    // Get groups (including global groups)
    const globalGroups = await prisma.contactGroup.findMany({
      where: { userId: null, isSystem: true },
      include: {
        contacts: {
          include: { contact: true },
        },
      },
    });

    const userGroups = await prisma.contactGroup.findMany({
      where: { userId: user.id },
      include: {
        contacts: {
          include: { contact: true },
        },
      },
    });

    // Filter groups by search query
    const allGroups = [...globalGroups, ...userGroups];
    const filteredGroups = q
      ? allGroups.filter(g => g.name.toLowerCase().includes(q.toLowerCase()))
      : allGroups;

    // Add dynamic system groups
    const allContactsCount = await prisma.contact.count({
      where: { userId: user.id },
    });
    const activeContactsCount = await prisma.contact.count({
      where: { userId: user.id, isActive: true },
    });

    // Add "Alla aktiva" and "Alla kontakter" as suggestions
    const dynamicSystemGroups = [
      {
        id: 'all-active',
        email: 'group:all-active:Alla aktiva',
        name: 'Alla aktiva',
        type: 'group' as const,
        memberCount: activeContactsCount,
        description: 'Alla aktiva kontakter',
        isGlobal: true,
      },
      {
        id: 'all',
        email: 'group:all:Alla kontakter',
        name: 'Alla kontakter',
        type: 'group' as const,
        memberCount: allContactsCount,
        description: 'Alla kontakter',
        isGlobal: true,
      },
    ];

    // Filter dynamic groups by search query
    const filteredDynamicGroups = q
      ? dynamicSystemGroups.filter(g => g.name.toLowerCase().includes(q.toLowerCase()))
      : dynamicSystemGroups;

    // Format contacts for suggestions
    const contactSuggestions = contacts.map(c => ({
      id: c.id,
      email: c.email,
      name: c.name,
      type: 'contact' as const,
    }));

    // Format groups for suggestions
    const groupSuggestions = filteredGroups.map(g => {
      const memberCount = g.userId === null
        ? g.contacts.filter(cgc => cgc.contact.userId === user.id && cgc.contact.isActive).length
        : g.contacts.length;

      return {
        id: g.id,
        email: `group:${g.id}:${g.name}`,
        name: g.name,
        type: 'group' as const,
        memberCount,
        description: g.description,
      };
    });

    // Combine and sort - dynamic groups first, then contacts and regular groups
    const allSuggestions = [
      ...filteredDynamicGroups,
      ...contactSuggestions,
      ...groupSuggestions,
    ].sort((a, b) => {
      const aName = (a.name || a.email).toLowerCase();
      const bName = (b.name || b.email).toLowerCase();
      return aName.localeCompare(bName);
    });

    return NextResponse.json(allSuggestions);
  }

  let whereClause: {
    userId: string;
    email?: { contains: string; mode: 'insensitive' };
    name?: { contains: string; mode: 'insensitive' };
    isActive?: boolean;
    groups?: { some: { groupId: string } };
    OR?: Array<{
      email: { contains: string; mode: 'insensitive' };
      name?: { contains: string; mode: 'insensitive' };
    } | {
      name: { contains: string; mode: 'insensitive' };
      email?: { contains: string; mode: 'insensitive' };
    }>;
  } = {
    userId: user.id,
  };

  if (q) {
    whereClause.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (groupId === 'all-active') {
    whereClause.isActive = true;
  } else if (groupId) {
    whereClause.groups = {
      some: { groupId },
    };
  }

  if (!showAll && !groupId) {
    whereClause.isActive = true;
  }

  const contacts = await prisma.contact.findMany({
    where: whereClause,
    include: {
      groups: {
        include: {
          group: true,
        },
      },
    },
    orderBy: { name: 'asc' },
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
    const { email, name, isActive = true } = data;
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const contact = await prisma.contact.upsert({
      where: {
        userId_email: {
          userId: user.id,
          email,
        },
      },
      update: { name, isActive },
      create: { email, name, userId: user.id, isActive },
    });
    return NextResponse.json(contact);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await prisma.contact.delete({
      where: {
        userId_email: {
          userId: user.id,
          email,
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
