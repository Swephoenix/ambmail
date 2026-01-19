import { prisma } from '@/lib/prisma';
import { fetchEmails, getImapConnection, MailAccount, openMailbox } from '@/lib/mail-service';
import { simpleParser } from 'mailparser';
import { buildContactRows, extractContactsFromHeader, uniqueContacts } from '@/lib/contact-utils';

const SYNC_INTERVAL_MS = 30 * 1000;
const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_BODY_PREFETCH_LIMIT = 20;

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

function extractFolders(boxList: any, parentKey = ''): string[] {
  const folders: string[] = [];
  for (const key of Object.keys(boxList || {})) {
    const box = boxList[key];
    const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
    folders.push(fullPath);
    if (box.children) {
      folders.push(...extractFolders(box.children, fullPath));
    }
  }
  return folders;
}

function getRecipients(addrObj: any): any[] {
  if (!addrObj) return [];
  if (Array.isArray(addrObj)) {
    return addrObj.flatMap(obj => obj.value || []);
  }
  return addrObj.value || [];
}

async function prefetchBodiesForFolder(account: MailAccount, folder: string, limit: number) {
  const messages = await prisma.emailMessage.findMany({
    where: {
      accountId: account.id,
      folder,
      OR: [{ hasBody: false }, { attachments: null }],
    },
    orderBy: { uid: 'desc' },
    take: limit,
  });

  if (messages.length === 0) return;

  let connection;
  try {
    connection = await getImapConnection(account);
    await openMailbox(connection, folder);

    for (const message of messages) {
      const results = await connection.search([['UID', message.uid]], {
        bodies: [''],
        struct: true,
      });

      if (results.length === 0) continue;
      const part = results[0].parts.find(p => p.which === '');
      const source = part?.body;
      if (!source) continue;

      const parsed = await simpleParser(source);
      const toRecipients = getRecipients(parsed.to);
      const ccRecipients = getRecipients(parsed.cc);
      const bccRecipients = getRecipients(parsed.bcc);
      const fromRecipients = getRecipients(parsed.from);

      let to = '';
      if (parsed.to && Array.isArray(parsed.to)) {
        to = parsed.to.map(addr => addr.text).join(', ') || '';
      } else if (parsed.to) {
        to = parsed.to.text || '';
      }

      const bodyHtml = parsed.html || parsed.textAsHtml || null;
      const bodyText = parsed.text || null;
      const body = bodyHtml || bodyText || '';
      const preview = bodyText
        ? bodyText.trim().substring(0, 100).replace(/\s+/g, ' ')
        : body.replace(/<[^>]*>?/gm, ' ').trim().substring(0, 100).replace(/\s+/g, ' ');

      const attachmentsMeta = parsed.attachments.map((attachment) => ({
        filename: attachment.filename || 'attachment',
        contentType: attachment.contentType,
        size: attachment.size,
        contentId: attachment.contentId || null,
        contentDisposition: attachment.contentDisposition || null,
        isInline: attachment.contentDisposition === 'inline' || Boolean(attachment.contentId),
      }));

      await prisma.emailMessage.upsert({
        where: {
          account_folder_uid: {
            accountId: account.id,
            folder,
            uid: message.uid,
          },
        },
        create: {
          accountId: account.id,
          folder,
          uid: message.uid,
          messageId: parsed.messageId || null,
          subject: parsed.subject || null,
          from: parsed.from?.text || null,
          to,
          date: parsed.date || null,
          preview: preview || null,
          bodyHtml,
          bodyText,
          hasBody: true,
          attachments: attachmentsMeta,
          toRecipients,
          ccRecipients,
        },
        update: {
          subject: parsed.subject || null,
          from: parsed.from?.text || null,
          to,
          date: parsed.date || null,
          preview: preview || null,
          bodyHtml,
          bodyText,
          hasBody: true,
          attachments: attachmentsMeta,
          toRecipients,
          ccRecipients,
        },
      });

      const accountUserId = (account as MailAccount & { userId?: string }).userId;
      if (accountUserId) {
        const contactCandidates = [
          ...fromRecipients,
          ...toRecipients,
          ...ccRecipients,
          ...bccRecipients,
        ].map((entry) => ({
          email: entry.address,
          name: entry.name || null,
        }));
        const unique = uniqueContacts(contactCandidates, [account.email]);
        if (unique.length > 0) {
          await prisma.contact.createMany({
            data: buildContactRows(accountUserId, unique),
            skipDuplicates: true,
          });
        }
      }
    }
  } finally {
    if (connection) {
      connection.end();
    }
  }
}

export async function prefetchUserAccounts(userId: string) {
  await prisma.prefetchStatus.upsert({
    where: { userId },
    create: {
      userId,
      status: 'running',
      startedAt: new Date(),
    },
    update: {
      status: 'running',
      error: null,
      startedAt: new Date(),
      completedAt: null,
    },
  });

  try {
    const accounts = await prisma.account.findMany({ where: { userId } });
    for (const account of accounts) {
      await prefetchAccountData(account as MailAccount);
    }
    await prisma.prefetchStatus.update({
      where: { userId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  } catch (error: any) {
    await prisma.prefetchStatus.update({
      where: { userId },
      data: {
        status: 'failed',
        error: error?.message || 'Prefetch failed',
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function prefetchAccountData(account: MailAccount) {
  const listLimit = Number.parseInt(process.env.PREFETCH_LIST_LIMIT || '', 10);
  const bodyLimit = Number.parseInt(process.env.PREFETCH_BODY_LIMIT || '', 10);
  const effectiveListLimit = Number.isFinite(listLimit) && listLimit > 0 ? listLimit : DEFAULT_LIST_LIMIT;
  const effectiveBodyLimit = Number.isFinite(bodyLimit) && bodyLimit > 0 ? bodyLimit : DEFAULT_BODY_PREFETCH_LIMIT;

  let folders: string[] = ['INBOX'];
  let connection;
  try {
    connection = await getImapConnection(account);
    const boxes = await connection.getBoxes();
    folders = extractFolders(boxes);
  } catch (error) {
    console.error('[prefetch] Failed to list folders, defaulting to INBOX:', error);
  } finally {
    if (connection) {
      connection.end();
    }
  }

  for (const folder of folders) {
    try {
      await syncFolderFromImap(account, folder, effectiveListLimit);
      await prefetchBodiesForFolder(account, folder, effectiveBodyLimit);
    } catch (error) {
      console.error(`[prefetch] Failed for ${account.email} (${folder}):`, error);
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
