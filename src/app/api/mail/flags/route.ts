import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, openMailbox } from '@/lib/mail-service';

export async function POST(req: Request) {
  try {
    const { accountId, uid, folder, action, flag } = await req.json();

    if (!accountId || !uid || !action || !flag) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const connection = await getImapConnection(account as any);
    await openMailbox(connection, folder);

    if (action === 'add') {
      await connection.addFlags(uid, flag);
    } else if (action === 'remove') {
      await connection.delFlags(uid, flag);
    }

    connection.end();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Flag Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
