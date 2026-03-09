import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// Add contact to group
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await req.json();
    const { groupId, contactEmail } = data;

    if (!groupId || !contactEmail) {
      return NextResponse.json({ error: 'groupId and contactEmail are required' }, { status: 400 });
    }

    // Handle dynamic system groups
    if (groupId === 'all-active' || groupId === 'all') {
      return NextResponse.json({ success: true });
    }

    // Find the contact (must belong to current user)
    const contact = await prisma.contact.findFirst({
      where: { userId: user.id, email: contactEmail },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Find the group (can be global or user's own)
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        OR: [
          { userId: null }, // Global group
          { userId: user.id }, // User's own group
        ],
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if already assigned
    const existing = await prisma.contactGroupContact.findFirst({
      where: {
        contactId: contact.id,
        groupId: group.id,
      },
    });

    if (existing) {
      return NextResponse.json({ success: true, alreadyAssigned: true });
    }

    // Add contact to group
    const assignment = await prisma.contactGroupContact.create({
      data: {
        contactId: contact.id,
        groupId: group.id,
      },
    });

    return NextResponse.json(assignment);
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
    const groupId = searchParams.get('groupId');
    const contactEmail = searchParams.get('contactEmail');

    if (!groupId || !contactEmail) {
      return NextResponse.json({ error: 'groupId and contactEmail are required' }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { userId: user.id, email: contactEmail },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await prisma.contactGroupContact.delete({
      where: {
        contactId_groupId: {
          contactId: contact.id,
          groupId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
