import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, appendDraft, getDraftsFolder, openMailbox } from '@/lib/mail-service';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { accountId, to, subject, body, uid } = await req.json();

    console.log('Draft API called with:', { accountId, to, subject, body: body?.substring(0, 100), uid });

    if (!accountId) {
      console.error('AccountId is required');
      return NextResponse.json({ error: 'AccountId is required' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) {
      console.error('Account not found:', accountId);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    console.log('Connecting to IMAP for account:', account.email);
    const connection = await getImapConnection(account as unknown);

    // Create raw email message manually with proper MIME structure
    const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${account.email.split('@')[1]}>`;

    // Add the recipient as visible text in the email body
    const bodyWithRecipient = `<p><strong>To:</strong> ${to}</p><br>${body}`;
    const plainBodyWithRecipient = `To: ${to}\n\n${body.replace(/<[^>]*>/g, '')}`;

    const rawEmail = [
      `From: "${account.name || account.email}" <${account.email}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="boundary"',
      '',
      '--boundary',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      plainBodyWithRecipient, // Plain text version with recipient
      '',
      '--boundary',
      'Content-Type: text/html; charset=UTF-8',
      '',
      bodyWithRecipient, // HTML version with recipient
      '',
      '--boundary--',
      ''
    ].join('\r\n');

    const draftsFolder = await getDraftsFolder(connection);
    console.log('Drafts folder identified as:', draftsFolder);

    // Get the current highest UID before appending
    await openMailbox(connection, draftsFolder);
    const existingMessages = await connection.search(['ALL'], {
        bodies: ['HEADER'],
        markSeen: false
    });

    const maxExistingUid = existingMessages.length > 0
      ? Math.max(...existingMessages.map(msg => msg.attributes.uid))
      : 0;

    // Append the new draft
    console.log('Appending draft to IMAP');
    await appendDraft(connection, rawEmail);

    // Wait briefly to ensure the message is processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Search for the message with the specific Message-ID to get its UID
    // This is more reliable than trying to guess which message is the new one
    const messageSearch = await connection.search([['HEADER', 'MESSAGE-ID', messageId]], {
        bodies: ['HEADER'],
        markSeen: false
    });

    let newUid: number | undefined;
    if (messageSearch.length > 0) {
        // We found the message with our specific Message-ID
        newUid = messageSearch[0].attributes.uid;
        console.log('New draft UID found by Message-ID:', newUid);
    } else {
        console.log('Message with specific Message-ID not found, trying UIDs greater than previous max');
        // Fallback: search for messages with UID greater than the previous max
        const newMessages = await connection.search([['UID', `${maxExistingUid + 1}:*`]], {
            bodies: ['HEADER'],
            markSeen: false
        });

        if (newMessages.length > 0) {
            // Sort by UID descending to get the highest (most recently added) UID
            newMessages.sort((a, b) => b.attributes.uid - a.attributes.uid);
            newUid = newMessages[0].attributes.uid;
            console.log('New draft UID found by UID comparison:', newUid);
        } else {
            console.log('No new messages found in drafts folder after append');
            // Final fallback: get all messages and find the highest UID
            const allMessages = await connection.search(['ALL'], {
                bodies: ['HEADER'],
                markSeen: false
            });
            if (allMessages.length > 0) {
                allMessages.sort((a, b) => b.attributes.uid - a.attributes.uid);
                newUid = allMessages[0].attributes.uid;
                console.log('Fallback: New draft UID found:', newUid);
            }
        }
    }

    // If updating an existing draft (uid provided), delete the old one
    if (uid && newUid && uid !== newUid) {
        console.log('Deleting old draft with UID:', uid);
        try {
            await connection.addFlags(uid, '\\Deleted');
            await connection.imap.expunge(uid);
        } catch (e) {
            console.error('Failed to delete old draft:', e);
        }
    }

    connection.end();
    console.log('Draft saved successfully with UID:', newUid);
    return NextResponse.json({ success: true, uid: newUid });
  } catch (error: unknown) {
    console.error('Draft Save Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
