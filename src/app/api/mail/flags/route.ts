import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, isFolderAlias, openMailbox, resolveFolderAlias } from '@/lib/mail-service';
import type { MailAccount } from '@/lib/mail-service';
import type { ImapSimple } from 'imap-simple';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { accountId, uid, folder, action, flag } = await req.json();

    if (!accountId || !uid || !action || !flag) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

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

    const requestedFolder = folder || 'INBOX';
    let resolvedFolder = requestedFolder;
    let connection: ImapSimple | null = null;
    if (isFolderAlias(requestedFolder)) {
      connection = await getImapConnection(mailAccount);
      resolvedFolder = await resolveFolderAlias(connection, requestedFolder);
    }
    if (!connection) {
      connection = await getImapConnection(mailAccount);
    }
    await openMailbox(connection, resolvedFolder);

    if (action === 'add') {
      await connection!.addFlags(uid, flag);
    } else if (action === 'remove') {
      await connection!.delFlags(uid, flag);
    }

    connection!.end();
    const cached = await prisma.emailMessage.findUnique({
      where: {
        account_folder_uid: {
          accountId,
          folder: resolvedFolder,
          uid,
        },
      },
    });
    if (cached) {
      const nextFlags = new Set<string>(cached.flags || []);
      if (action === 'add') {
        nextFlags.add(flag);
      } else {
        nextFlags.delete(flag);
      }
      await prisma.emailMessage.update({
        where: {
          account_folder_uid: {
            accountId,
            folder: resolvedFolder,
            uid,
          },
        },
        data: {
          flags: Array.from(nextFlags),
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Flag Update Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
