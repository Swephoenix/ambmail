import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, getTrashFolder, isFolderAlias, openMailbox, resolveFolderAlias } from '@/lib/mail-service';
import type { MailAccount } from '@/lib/mail-service';
import type { ImapSimple } from 'imap-simple';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { accountId, uids, folder } = await req.json();

    if (!accountId || !uids || !Array.isArray(uids) || uids.length === 0) {
      return NextResponse.json({ error: 'accountId and uids array are required' }, { status: 400 });
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
    const trashFolder = await getTrashFolder(connection);
    await openMailbox(connection, resolvedFolder);

    if (resolvedFolder === trashFolder) {
      await connection!.addFlags(uids, '\\Deleted');
      await new Promise((resolve, reject) => {
        connection!.imap.expunge((err: unknown) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        });
      });
      connection!.end();

      await prisma.emailMessage.deleteMany({
        where: {
          accountId,
          folder: resolvedFolder,
          uid: { in: uids },
        },
      });

      return NextResponse.json({ success: true, deletedCount: uids.length });
    }

    await new Promise((resolve, reject) => {
      connection!.imap.copy(uids, trashFolder, (err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    await connection!.addFlags(uids, '\\Deleted');
    await new Promise((resolve, reject) => {
      connection!.imap.expunge((err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    connection!.end();

    await prisma.emailMessage.deleteMany({
      where: {
        accountId,
        folder: resolvedFolder,
        uid: { in: uids },
      },
    });
    await prisma.mailSyncState.updateMany({
      where: {
        accountId,
        folder: trashFolder,
      },
      data: {
        lastSyncAt: null,
      },
    });

    return NextResponse.json({ success: true, deletedCount: uids.length, movedTo: trashFolder });
  } catch (error: unknown) {
    console.error('Delete Email Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
