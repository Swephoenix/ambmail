import { createPrismaClient } from '../src/lib/prisma-client';
import type { MailAccount } from '../src/lib/mail-service';
import { fetchEmails, getImapConnection } from '../src/lib/mail-service';
import { buildContactRows, extractContactsFromHeader, uniqueContacts } from '../src/lib/contact-utils';

const { prisma } = createPrismaClient();

type ImapConnection = Awaited<ReturnType<typeof getImapConnection>>;

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_FETCH_LIMIT = Number.MAX_SAFE_INTEGER;

function extractFolders(boxList: any, parentKey = ''): string[] {
  const folders: string[] = [];
  for (const key of Object.keys(boxList)) {
    const box = boxList[key];
    const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
    folders.push(fullPath);
    if (box.children) {
      folders.push(...extractFolders(box.children, fullPath));
    }
  }
  return folders;
}

async function syncFolder(account: MailAccount, folder: string, limit: number) {
  let connection: ImapConnection | null = null;
  try {
    connection = await getImapConnection(account);
    const emails = await fetchEmails(connection, folder, limit);

    const accountUserId = (account as MailAccount & { userId?: string }).userId;
    if (accountUserId) {
      const contactCandidates = emails.flatMap((email) => ([
        ...extractContactsFromHeader(email.from || null),
        ...extractContactsFromHeader(email.to || null),
      ]));
      const unique = uniqueContacts(contactCandidates, [account.email]);
      if (unique.length > 0) {
        await prisma.contact.createMany({
          data: buildContactRows(accountUserId, unique),
          skipDuplicates: true,
        });
      }
    }

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

async function syncAccount(account: MailAccount, limit: number) {
  let connection: ImapConnection | null = null;
  try {
    connection = await getImapConnection(account);
    const boxes = await connection.getBoxes();
    const folders = extractFolders(boxes);
    connection.end();

    for (const folder of folders) {
      await syncFolder(account, folder, limit);
    }
  } catch (error) {
    console.error(`Background sync error for ${account.email}:`, error);
  } finally {
    if (connection) {
      connection.end();
    }
  }
}

async function syncAllAccounts() {
  const accounts = await prisma.account.findMany();
  if (accounts.length === 0) return;

  const rawLimit = process.env.SYNC_FETCH_LIMIT;
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_FETCH_LIMIT;

  for (const account of accounts) {
    await syncAccount(account as MailAccount, limit);
  }
}

async function start() {
  const intervalRaw = process.env.SYNC_WORKER_INTERVAL_MS;
  const parsedInterval = intervalRaw ? parseInt(intervalRaw, 10) : NaN;
  const intervalMs = Number.isFinite(parsedInterval) && parsedInterval > 0
    ? parsedInterval
    : DEFAULT_INTERVAL_MS;

  console.log(`[sync-worker] Starting background sync every ${intervalMs}ms`);

  const run = async () => {
    try {
      await syncAllAccounts();
    } catch (error) {
      console.error('[sync-worker] Unhandled sync error:', error);
    }
  };

  await run();
  setInterval(run, intervalMs);
}

start().catch((error) => {
  console.error('[sync-worker] Fatal error:', error);
  process.exitCode = 1;
});
