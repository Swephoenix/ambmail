import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, getTrashFolder, isFolderAlias, openMailbox, resolveFolderAlias } from '@/lib/mail-service';
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

    const requestedFolder = folder || 'INBOX';
    let resolvedFolder = requestedFolder;
    let connection;
    if (isFolderAlias(requestedFolder)) {
      connection = await getImapConnection(account as any);
      resolvedFolder = await resolveFolderAlias(connection, requestedFolder);
    }
    if (!connection) {
      connection = await getImapConnection(account as any);
    }
    const trashFolder = await getTrashFolder(connection);
    await openMailbox(connection, resolvedFolder);

    if (resolvedFolder === trashFolder) {
      await connection.addFlags(uids, '\\Deleted');
      await new Promise((resolve, reject) => {
        connection.imap.expunge((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        });
      });
      connection.end();

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
      connection.imap.copy(uids, trashFolder, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    await connection.addFlags(uids, '\\Deleted');
    await new Promise((resolve, reject) => {
      connection.imap.expunge((err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    connection.end();

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
  } catch (error: any) {
    console.error('Delete Email Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
