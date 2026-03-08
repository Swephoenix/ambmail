import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, groupEmailsIntoConversations, isFolderAlias, resolveFolderAlias } from '@/lib/mail-service';
import type { MailAccount } from '@/lib/mail-service';
import type { ImapSimple } from 'imap-simple';
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
  const forceSync = searchParams.get('forceSync') === 'true'; // Force immediate sync

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

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

  try {
    let folder = requestedFolder;
    if (isFolderAlias(requestedFolder)) {
      let connection: ImapSimple | null = null;
      try {
        connection = await getImapConnection(mailAccount);
        folder = await resolveFolderAlias(connection!, requestedFolder);
      } catch (error) {
        console.error('Folder alias resolution failed:', error);
      } finally {
        if (connection) connection.end();
      }
    }

    let cachedEmails = await getCachedEmailList(accountId, folder);
    const needsSync = cachedEmails.length === 0 || await shouldSyncFolder(accountId, folder);
    const hasMissingDates = cachedEmails.some((email: { date: Date | null }) => !email.date);
    
    // Force sync waits for completion before returning
    if (forceSync) {
      await syncFolderFromImap(mailAccount, folder);
      cachedEmails = await getCachedEmailList(accountId, folder);
    } else if (needsSync) {
      if (cachedEmails.length === 0) {
        await syncFolderFromImap(mailAccount, folder);
        cachedEmails = await getCachedEmailList(accountId, folder);
      } else {
        void syncFolderFromImap(mailAccount, folder).catch((error) => {
          console.error('Background sync error:', error);
        });
      }
    } else if (hasMissingDates) {
      console.info(`[mail] Resyncing ${account.email} ${folder} because cached dates are missing.`);
      await syncFolderFromImap(mailAccount, folder);
      cachedEmails = await getCachedEmailList(accountId, folder);
    }

    const emails = cachedEmails.map((email: {
      uid: number;
      date: Date | null;
      flags: string[];
      labels?: string[];
      subject: string | null;
      from: string | null;
      to: string | null;
      preview: string | null;
      messageId: string | null;
      inReplyTo: string | null;
      references: string | null;
    }) => mapCachedEmail(email));

    if (view === 'conversation') {
      const conversations = groupEmailsIntoConversations(emails);
      return NextResponse.json(conversations);
    }

    return NextResponse.json(emails);
  } catch (error: unknown) {
    console.error('Mail cache error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
