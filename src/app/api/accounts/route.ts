import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      senderName: true,
      signature: true,
      imapHost: true,
      imapPort: true,
      smtpHost: true,
      smtpPort: true,
    },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await req.json();
    const { email, password, name, imapHost, imapPort, smtpHost, smtpPort } = data;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        password: encrypt(password),
        adminManaged: false,
        name,
        imapHost,
        imapPort: parseInt(imapPort),
        smtpHost,
        smtpPort: parseInt(smtpPort),
      },
    });

    return NextResponse.json({ id: account.id, email: account.email });
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
    const data = await req.json();
    const { accountId } = data;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await prisma.account.delete({ where: { id: accountId } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
