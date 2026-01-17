import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSmtpTransporter } from '@/lib/mail-service';
import { requireUser } from '@/lib/auth';
import { buildContactRows, extractContactsFromHeader, uniqueContacts } from '@/lib/contact-utils';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await req.json();
    const { accountId, to, subject, body, attachments = [] } = data;

    console.log('Send API called with:', { accountId, to, subject });

    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) {
      console.error('Account not found:', accountId);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    console.log('Connecting to SMTP for account:', account.email);
    const transporter = await getSmtpTransporter(account as any);

    console.log('Sending email with options:', {
      from: `"${account.name || account.email}" <${account.email}>`,
      to,
      subject
    });

    const uploadDir = path.join('/tmp', 'uxmail-uploads');
    const mailAttachments = [];
    for (const attachment of attachments) {
      if (!attachment?.token || !attachment?.filename) continue;
      const token = String(attachment.token);
      if (!/^[a-f0-9]+$/i.test(token)) continue;
      const filePath = path.join(uploadDir, token);
      try {
        await fs.access(filePath);
      } catch {
        continue;
      }

      const metaPath = path.join(uploadDir, `${token}.json`);
      let meta: { type?: string } = {};
      try {
        const metaRaw = await fs.readFile(metaPath, 'utf8');
        meta = JSON.parse(metaRaw);
      } catch {
        meta = {};
      }

      const inline = Boolean(attachment.inline);
      const cid = attachment.cid || (inline ? `inline-${token}` : undefined);

      mailAttachments.push({
        filename: attachment.filename,
        path: filePath,
        contentType: attachment.contentType || meta.type || undefined,
        cid: inline ? cid : undefined,
      });
    }

    await transporter.sendMail({
      from: `"${account.name || account.email}" <${account.email}>`,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'), // Simple text to html conversion
      attachments: mailAttachments,
    });

    console.log('Email sent successfully');

    // Automatically add recipients to contacts
    try {
      const contactCandidates = extractContactsFromHeader(to || null);
      const unique = uniqueContacts(contactCandidates);
      if (unique.length > 0) {
        await prisma.contact.createMany({
          data: buildContactRows(user.id, unique),
          skipDuplicates: true,
        });
      }
      console.log('Contacts updated/created successfully');
    } catch (e) {
      console.error('Contact saving error:', e);
      // Ignore contact saving errors
    }

    if (mailAttachments.length > 0) {
      await Promise.all(
        mailAttachments.map(async (item) => {
          if (!item.path) return;
          try {
            await fs.unlink(item.path);
          } catch {
            return;
          }
          try {
            await fs.unlink(`${item.path}.json`);
          } catch {
            return;
          }
        })
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SMTP Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
