import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, openMailbox } from '@/lib/mail-service';
import { simpleParser } from 'mailparser';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  const uidParam = searchParams.get('uid');
  const folder = searchParams.get('folder') || 'INBOX';

  console.log(`[API] Fetching body for account ${accountId}, folder ${folder}, uid ${uidParam}`);

  if (!accountId || !uidParam) {
    return NextResponse.json({ error: 'accountId and uid required' }, { status: 400 });
  }

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const uid = parseInt(uidParam, 10);
  if (Number.isNaN(uid)) {
    return NextResponse.json({ error: 'Invalid uid' }, { status: 400 });
  }

  const cached = await prisma.emailMessage.findUnique({
    where: {
      account_folder_uid: {
        accountId,
        folder,
        uid,
      },
    },
  });

  if (cached?.hasBody && cached.attachments !== null) {
    return NextResponse.json({
      uid: cached.uid,
      subject: cached.subject,
      from: cached.from,
      to: cached.to,
      cc: '',
      toRecipients: cached.toRecipients || [],
      ccRecipients: cached.ccRecipients || [],
      date: cached.date,
      body: cached.bodyHtml || cached.bodyText || '',
      attachments: cached.attachments || [],
    });
  }

  let connection;
  try {
    connection = await getImapConnection(account as any);
    await openMailbox(connection, folder);
    
    console.log(`[API] Searching for UID ${uid} in ${folder}`);

    const messages = await connection.search([['UID', uid]], {
      bodies: [''], // Fetch full body
      struct: true
    });

    if (messages.length === 0) {
      console.log(`[API] Message with UID ${uid} not found`);
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const part = messages[0].parts.find(p => p.which === '');
    const source = part?.body;
    
    if (!source) {
       console.log(`[API] Message body source is empty`);
       return NextResponse.json({ error: 'Message body empty' }, { status: 404 });
    }

    const parsed = await simpleParser(source);

    // Helper to extract structured recipients
    const getRecipients = (addrObj: any): any[] => {
      if (!addrObj) return [];
      if (Array.isArray(addrObj)) {
        return addrObj.flatMap(obj => obj.value || []);
      }
      return addrObj.value || [];
    };

    const toRecipients = getRecipients(parsed.to);
    const ccRecipients = getRecipients(parsed.cc);

    // Handle the case where to can be an array of addresses
    let to = '';
    if (parsed.to && Array.isArray(parsed.to)) {
      to = parsed.to.map(addr => addr.text).join(', ') || '';
    } else if (parsed.to) {
      to = parsed.to.text || '';
    }

    // Handle CC field
    let cc = '';
    if (parsed.cc && Array.isArray(parsed.cc)) {
      cc = parsed.cc.map(addr => addr.text).join(', ') || '';
    } else if (parsed.cc) {
      cc = parsed.cc.text || '';
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
    }));

    await prisma.emailMessage.upsert({
      where: {
        account_folder_uid: {
          accountId,
          folder,
          uid,
        },
      },
      create: {
        accountId,
        folder,
        uid,
        messageId: null,
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

    return NextResponse.json({
      uid: messages[0].attributes.uid,
      subject: parsed.subject,
      from: parsed.from?.text,
      to,
      cc,
      toRecipients,
      ccRecipients,
      date: parsed.date,
      body,
      attachments: attachmentsMeta,
    });
  } catch (error: any) {
    console.error('[API] IMAP Body Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) {
      connection.end();
    }
  }
}
