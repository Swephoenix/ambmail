import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// Get all groups for the user (including global system groups)
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get global system groups
  const globalGroups = await prisma.contactGroup.findMany({
    where: { userId: null, isSystem: true },
    include: {
      contacts: {
        include: {
          contact: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Get user's personal groups
  const userGroups = await prisma.contactGroup.findMany({
    where: { userId: user.id },
    include: {
      contacts: {
        include: {
          contact: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Get all contacts for counting
  const allContacts = await prisma.contact.findMany({
    where: { userId: user.id },
  });
  
  const activeContacts = allContacts.filter(c => c.isActive);

  // Build result with global groups first, then user groups
  const result = [
    // Global system groups
    ...globalGroups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      isSystem: true,
      isGlobal: true,
      contactCount: g.contacts.filter(cgc => cgc.contact.userId === user.id).length,
    })),
    // Dynamic system views (not stored in DB)
    {
      id: 'all-active',
      name: 'Alla aktiva',
      description: 'Alla aktiva kontakter',
      isSystem: true,
      isGlobal: true,
      contactCount: activeContacts.length,
    },
    {
      id: 'all',
      name: 'Alla kontakter',
      description: 'Alla kontakter',
      isSystem: true,
      isGlobal: true,
      contactCount: allContacts.length,
    },
    // User's personal groups
    ...userGroups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      isSystem: g.isSystem,
      isGlobal: false,
      contactCount: g.contacts.length,
    })),
  ];

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await req.json();
    const { name, description, isGlobal = false } = data;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Only admins can create global groups
    if (isGlobal && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can create global groups' }, { status: 403 });
    }

    const group = await prisma.contactGroup.create({
      data: {
        name,
        description,
        userId: isGlobal ? null : user.id,
        isSystem: isGlobal,
      },
    });

    return NextResponse.json(group);
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    const group = await prisma.contactGroup.findFirst({
      where: { id },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Only allow deleting user's own groups or if admin
    if (group.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Cannot delete this group' }, { status: 403 });
    }

    if (group.isSystem && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Cannot delete system groups' }, { status: 403 });
    }

    await prisma.contactGroup.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
