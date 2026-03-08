import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, isFolderAlias, openMailbox, resolveFolderAlias } from '@/lib/mail-service';
import type { MailAccount } from '@/lib/mail-service';
import type { ImapSimple } from 'imap-simple';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  const uidParam = searchParams.get('uid');
  const requestedFolder = searchParams.get('folder') || 'INBOX';

  if (!accountId || !uidParam) {
    return NextResponse.json({ error: 'accountId and uid required' }, { status: 400 });
  }

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const uid = parseInt(uidParam, 10);
  if (Number.isNaN(uid)) {
    return NextResponse.json({ error: 'Invalid uid' }, { status: 400 });
  }

  const mailAccount: MailAccount = {
    id: account.id,
    email: account.email,
    password: account.password,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    signature: account.signature,
    name: account.name,
  };

  let connection: ImapSimple | null = null;
  try {
    let resolvedFolder = requestedFolder;
    if (isFolderAlias(requestedFolder)) {
      connection = await getImapConnection(mailAccount);
      resolvedFolder = await resolveFolderAlias(connection, requestedFolder);
    }

    if (!connection) {
      connection = await getImapConnection(mailAccount);
    }
    await openMailbox(connection, resolvedFolder);

    const messages = await connection!.search([['UID', uid]], {
      bodies: [''],
      struct: true,
    });

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const part = messages[0].parts.find(p => p.which === '');
    const source = part?.body;

    if (!source) {
      return NextResponse.json({ error: 'Message body empty' }, { status: 404 });
    }

    const mimeText = typeof source === 'string' ? source : source.toString('utf8');
    return new Response(mimeText, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    if (typeof connection !== 'undefined' && connection) {
      connection.end();
    }
  }
}
