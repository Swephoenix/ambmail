import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, isFolderAlias, openMailbox, resolveFolderAlias } from '@/lib/mail-service';
import { simpleParser } from 'mailparser';
import { requireUser } from '@/lib/auth';
import type { MailAccount } from '@/lib/mail-service';
import type { ImapSimple } from 'imap-simple';

function sanitizeFilename(filename: string) {
  return filename.replace(/["\\]/g, '_');
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  const uidParam = searchParams.get('uid');
  const requestedFolder = searchParams.get('folder') || 'INBOX';
  const indexParam = searchParams.get('index');
  const inlineParam = searchParams.get('inline');

  if (!accountId || !uidParam || indexParam === null) {
    return NextResponse.json({ error: 'accountId, uid, and index are required' }, { status: 400 });
  }

  const uid = parseInt(uidParam, 10);
  const index = parseInt(indexParam, 10);
  if (Number.isNaN(uid) || Number.isNaN(index) || index < 0) {
    return NextResponse.json({ error: 'Invalid uid or index' }, { status: 400 });
  }

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  let connection: ImapSimple | null = null;
  try {
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
    connection = await getImapConnection(mailAccount);
    const resolvedFolder = isFolderAlias(requestedFolder)
      ? await resolveFolderAlias(connection, requestedFolder)
      : requestedFolder;
    await openMailbox(connection, resolvedFolder);

    const messages = await connection!.search([['UID', uid]], {
      bodies: [''],
      struct: true,
    });

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const part = messages[0].parts.find(p => p.which === '');
    const source = part?.body;
    if (!source) {
      return NextResponse.json({ error: 'Message body empty' }, { status: 404 });
    }

    const parsed = await simpleParser(source);
    const attachment = parsed.attachments[index];
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const filename = sanitizeFilename(attachment.filename || `attachment-${index}`);
    const contentType = attachment.contentType || 'application/octet-stream';
    const disposition = inlineParam === '1' ? 'inline' : (attachment.contentDisposition || 'attachment');

    // Convert Buffer to Uint8Array for NextResponse
    const content = attachment.content as Buffer;
    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('[API] Attachment Fetch Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    if (connection) {
      connection.end();
    }
  }
}
