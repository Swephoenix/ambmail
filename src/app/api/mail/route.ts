import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { groupEmailsIntoConversations } from '@/lib/mail-service';
import { getCachedEmailList, mapCachedEmail, shouldSyncFolder, syncFolderFromImap } from '@/lib/mail-cache';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  const folder = searchParams.get('folder') || 'INBOX';
  const view = searchParams.get('view') || 'list'; // 'list' or 'conversation'

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  try {
    let cachedEmails = await getCachedEmailList(accountId, folder);
    const needsSync = cachedEmails.length === 0 || await shouldSyncFolder(accountId, folder);
    if (needsSync) {
      if (cachedEmails.length === 0) {
        await syncFolderFromImap(account as any, folder);
        cachedEmails = await getCachedEmailList(accountId, folder);
      } else {
        void syncFolderFromImap(account as any, folder).catch((error) => {
          console.error('Background sync error:', error);
        });
      }
    }

    const emails = cachedEmails.map(mapCachedEmail);

    if (view === 'conversation') {
      const conversations = groupEmailsIntoConversations(emails);
      return NextResponse.json(conversations);
    }

    return NextResponse.json(emails);
  } catch (error: any) {
    console.error('Mail cache error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
