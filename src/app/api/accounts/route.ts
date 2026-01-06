import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export async function GET() {
  const accounts = await prisma.account.findMany({
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
    const data = await req.json();
    const { email, password, name, imapHost, imapPort, smtpHost, smtpPort } = data;

    const account = await prisma.account.create({
      data: {
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
