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

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        email,
        password: encrypt(password),
        name,
        imapHost,
        imapPort: parseInt(imapPort),
        smtpHost,
        smtpPort: parseInt(smtpPort),
      },
    });

    return NextResponse.json({ id: account.id, email: account.email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
