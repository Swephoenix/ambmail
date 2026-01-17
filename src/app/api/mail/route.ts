import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, groupEmailsIntoConversations, isFolderAlias, resolveFolderAlias } from '@/lib/mail-service';
import { getCachedEmailList, mapCachedEmail, shouldSyncFolder, syncFolderFromImap } from '@/lib/mail-cache';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  const requestedFolder = searchParams.get('folder') || 'INBOX';
  const view = searchParams.get('view') || 'list'; // 'list' or 'conversation'

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  try {
    let folder = requestedFolder;
    if (isFolderAlias(requestedFolder)) {
      let connection;
      try {
        connection = await getImapConnection(account as any);
        folder = await resolveFolderAlias(connection, requestedFolder);
      } catch (error) {
        console.error('Folder alias resolution failed:', error);
      } finally {
        if (connection) connection.end();
      }
    }

    let cachedEmails = await getCachedEmailList(accountId, folder);
    const needsSync = cachedEmails.length === 0 || await shouldSyncFolder(accountId, folder);
    const hasMissingDates = cachedEmails.some((email) => !email.date);
    if (needsSync) {
      if (cachedEmails.length === 0) {
        await syncFolderFromImap(account as any, folder);
        cachedEmails = await getCachedEmailList(accountId, folder);
      } else {
        void syncFolderFromImap(account as any, folder).catch((error) => {
          console.error('Background sync error:', error);
        });
      }
    } else if (hasMissingDates) {
      console.info(`[mail] Resyncing ${account.email} ${folder} because cached dates are missing.`);
      await syncFolderFromImap(account as any, folder);
      cachedEmails = await getCachedEmailList(accountId, folder);
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
