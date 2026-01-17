import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, getTrashFolder, openMailbox } from '@/lib/mail-service';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  let connection;
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    connection = await getImapConnection(account as any);
    const trashFolder = await getTrashFolder(connection);
    await openMailbox(connection, trashFolder);

    const messages = await connection.search(['ALL'], { bodies: [], struct: false });
    const uids = messages.map((message) => message.attributes.uid).filter(Boolean);

    if (uids.length === 0) {
      connection.end();
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

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
        folder: trashFolder,
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

    return NextResponse.json({ success: true, deletedCount: uids.length });
  } catch (error: any) {
    if (connection) connection.end();
    console.error('Empty Trash Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
