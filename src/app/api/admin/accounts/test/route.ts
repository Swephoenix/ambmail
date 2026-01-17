import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { getImapConnection, openMailbox } from '@/lib/mail-service';

type TestRequest = {
  accountId?: string;
  email?: string;
  password?: string;
  imapHost?: string;
  imapPort?: number | string;
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = (await req.json()) as TestRequest;
  const { accountId } = data;

  const storedAccount = accountId
    ? await prisma.account.findUnique({ where: { id: accountId } })
    : null;

  const email = data.email || storedAccount?.email;
  const password = data.password || storedAccount?.password;
  const imapHost = data.imapHost || storedAccount?.imapHost;
  const imapPortRaw = data.imapPort ?? storedAccount?.imapPort ?? 993;
  const imapPort = Number.isNaN(Number(imapPortRaw)) ? 993 : Number(imapPortRaw);

  if (!email || !password || !imapHost) {
    return NextResponse.json(
      { error: 'email, password, and imapHost are required' },
      { status: 400 }
    );
  }

  let connection: Awaited<ReturnType<typeof getImapConnection>> | null = null;
  let login = false;
  let fetch = false;
  let error: string | null = null;

  try {
    connection = await getImapConnection({
      id: accountId || 'test-account',
      email,
      password,
      imapHost,
      imapPort,
      smtpHost: 'localhost',
      smtpPort: 465,
    });
    login = true;
    await openMailbox(connection, 'INBOX');
    await connection.search(['ALL'], { bodies: ['HEADER'], struct: false, markSeen: false });
    fetch = true;
  } catch (err: any) {
    error = err?.message || 'IMAP test failed';
  } finally {
    if (connection) {
      try {
        connection.end();
      } catch (closeError) {
        // ignore cleanup errors
      }
    }
  }

  return NextResponse.json({ login, fetch, error });
}
