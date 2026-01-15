import { prisma } from '@/lib/prisma';
import { fetchEmails, getImapConnection, MailAccount } from '@/lib/mail-service';

const SYNC_INTERVAL_MS = 30 * 1000;
const DEFAULT_LIST_LIMIT = 50;

export async function getCachedEmailList(accountId: string, folder: string, limit = DEFAULT_LIST_LIMIT) {
  return prisma.emailMessage.findMany({
    where: { accountId, folder },
    orderBy: { uid: 'desc' },
    take: limit,
  });
}

export async function getSyncState(accountId: string, folder: string) {
  return prisma.mailSyncState.findUnique({
    where: {
      account_folder_sync: { accountId, folder },
    },
  });
}

export async function shouldSyncFolder(accountId: string, folder: string) {
  const state = await getSyncState(accountId, folder);
  if (!state?.lastSyncAt) return true;
  return Date.now() - state.lastSyncAt.getTime() > SYNC_INTERVAL_MS;
}

export async function syncFolderFromImap(account: MailAccount, folder: string, limit = DEFAULT_LIST_LIMIT) {
  let connection;
  try {
    connection = await getImapConnection(account);
    const emails = await fetchEmails(connection, folder, limit);

    await prisma.$transaction([
      ...emails.map(email =>
        prisma.emailMessage.upsert({
          where: {
            account_folder_uid: {
              accountId: account.id,
              folder,
              uid: email.uid,
            },
          },
          create: {
            accountId: account.id,
            folder,
            uid: email.uid,
            messageId: email.messageId || null,
            subject: email.subject || null,
            from: email.from || null,
            to: email.to || null,
            date: email.date || null,
            flags: email.flags || [],
            preview: email.preview || null,
            inReplyTo: email.inReplyTo || null,
            references: email.references || null,
          },
          update: {
            messageId: email.messageId || null,
            subject: email.subject || null,
            from: email.from || null,
            to: email.to || null,
            date: email.date || null,
            flags: email.flags || [],
            preview: email.preview || null,
            inReplyTo: email.inReplyTo || null,
            references: email.references || null,
          },
        })
      ),
      prisma.mailSyncState.upsert({
        where: {
          account_folder_sync: { accountId: account.id, folder },
        },
        create: {
          accountId: account.id,
          folder,
          lastUid: emails.length > 0 ? emails[0].uid : null,
          lastSyncAt: new Date(),
        },
        update: {
          lastUid: emails.length > 0 ? emails[0].uid : null,
          lastSyncAt: new Date(),
        },
      }),
    ]);
  } finally {
    if (connection) {
      connection.end();
    }
  }
}

export function mapCachedEmail(email: {
  uid: number;
  date: Date | null;
  flags: string[];
  subject: string | null;
  from: string | null;
  to: string | null;
  preview: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
}) {
  return {
    uid: email.uid,
    date: email.date,
    flags: email.flags || [],
    subject: email.subject || 'No Subject',
    from: email.from || 'Unknown',
    to: email.to || '',
    preview: email.preview || '',
    messageId: email.messageId || '',
    inReplyTo: email.inReplyTo || '',
    references: email.references || '',
  };
}
