import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, fetchEmails, groupEmailsIntoConversations } from '@/lib/mail-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  const folder = searchParams.get('folder') || 'INBOX';
  const view = searchParams.get('view') || 'list'; // 'list' or 'conversation'

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  try {
    const connection = await getImapConnection(account as any);
    const emails = await fetchEmails(connection, folder);
    connection.end();

    if (view === 'conversation') {
      const conversations = groupEmailsIntoConversations(emails);
      return NextResponse.json(conversations);
    } else {
      return NextResponse.json(emails);
    }
  } catch (error: any) {
    console.error('IMAP Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
