import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, openMailbox } from '@/lib/mail-service';

export async function POST(req: Request) {
  try {
    const { accountId, uids, folder } = await req.json();

    if (!accountId || !uids || !Array.isArray(uids) || uids.length === 0) {
      return NextResponse.json({ error: 'accountId and uids array are required' }, { status: 400 });
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const connection = await getImapConnection(account as any);
    await openMailbox(connection, folder || 'INBOX');

    // Add \Deleted flag to all specified messages
    await connection.addFlags(uids, '\\Deleted');

    // Expunge to permanently remove the messages
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

    return NextResponse.json({ success: true, deletedCount: uids.length });
  } catch (error: any) {
    console.error('Delete Email Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}