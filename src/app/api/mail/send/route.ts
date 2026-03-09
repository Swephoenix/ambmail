import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appendSent, getImapConnection, getSmtpTransporter } from '@/lib/mail-service';
import type { MailAccount } from '@/lib/mail-service';
import { syncFolderFromImap } from '@/lib/mail-cache';
import { requireUser } from '@/lib/auth';
import { buildContactRows, extractContactsFromHeader, uniqueContacts } from '@/lib/contact-utils';
import fs from 'fs/promises';
import path from 'path';
import MailComposer from 'nodemailer/lib/mail-composer';

// Expand group recipients to individual emails
async function expandRecipients(recipients: string[], userId: string): Promise<string[]> {
  const expanded: string[] = [];
  
  for (const recipient of recipients) {
    // Check if this is a group (format: group:{id}:{name})
    const groupMatch = recipient.match(/^group:([^:]+):(.+)$/);
    
    if (groupMatch) {
      const groupId = groupMatch[1];
      
      // Handle dynamic system groups
      if (groupId === 'all-active') {
        // Get all active contacts for this user
        const activeContacts = await prisma.contact.findMany({
          where: { userId, isActive: true },
          select: { email: true },
        });
        expanded.push(...activeContacts.map(c => c.email));
      } else if (groupId === 'all') {
        // Get all contacts for this user
        const allContacts = await prisma.contact.findMany({
          where: { userId },
          select: { email: true },
        });
        expanded.push(...allContacts.map(c => c.email));
      } else {
        // Get regular group members
        const group = await prisma.contactGroup.findFirst({
          where: { id: groupId },
          include: {
            contacts: {
              include: {
                contact: true,
              },
            },
          },
        });
        
        if (group) {
          // Add all active contacts from the group
          const memberEmails = group.contacts
            .filter(cgc => cgc.contact.isActive && cgc.contact.userId === userId)
            .map(cgc => cgc.contact.email);
          
          expanded.push(...memberEmails);
        }
      }
    } else {
      // Regular email address
      expanded.push(recipient);
    }
  }
  
  return expanded;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await req.json();
    let { accountId, to, subject, body, attachments = [] } = data;

    console.log('Send API called with:', { accountId, to, subject });

    // Expand groups to individual emails
    const expandedTo = await expandRecipients(to, user.id);
    to = expandedTo;

    console.log('Expanded recipients:', to);

    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) {
      console.error('Account not found:', accountId);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

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

    console.log('Connecting to SMTP for account:', account.email);
    const transporter = await getSmtpTransporter(mailAccount);

    const fromName = account.senderName || account.name || account.email;
    const fromHeader = `"${fromName}" <${account.email}>`;
    console.log('Sending email with options:', {
      from: fromHeader,
      to,
      subject
    });

    const uploadDir = path.join('/tmp', 'ambmail-uploads');
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

    const bodyText = body;
    const bodyHtml = body.replace(/\n/g, '<br>');

    await transporter.sendMail({
      from: fromHeader,
      to,
      subject,
      text: bodyText,
      html: bodyHtml, // Simple text to html conversion
      attachments: mailAttachments,
    });

    console.log('Email sent successfully');

    let sentConnection;
    let appendedSentFolder: string | null = null;
    try {
      sentConnection = await getImapConnection(mailAccount);
      const mail = new MailComposer({
        from: fromHeader,
        to,
        subject,
        text: bodyText,
        html: bodyHtml,
        attachments: mailAttachments,
      });
      const raw = await mail.compile().build();
      appendedSentFolder = await appendSent(sentConnection!, (raw as Buffer).toString('utf8'));
      await syncFolderFromImap(mailAccount, appendedSentFolder, 20);
    } catch (error) {
      console.error('Failed to append sent mail:', error);
    } finally {
      if (sentConnection) {
        sentConnection.end();
      }
    }

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

    return NextResponse.json({ success: true, sentFolder: appendedSentFolder });
  } catch (error: unknown) {
    console.error('SMTP Error:', error);
    console.error('Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      code: (error as { code?: string })?.code
    });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
