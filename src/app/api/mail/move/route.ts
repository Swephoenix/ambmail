import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, isFolderAlias, openMailbox, resolveFolderAlias } from '@/lib/mail-service';
import type { MailAccount } from '@/lib/mail-service';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { accountId, uids, sourceFolder, targetFolder } = await req.json();

    if (!accountId || !uids || !sourceFolder || !targetFolder) {
      return NextResponse.json({
        error: 'accountId, uids, sourceFolder, and targetFolder are required'
      }, { status: 400 });
    }

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

    const connection = await getImapConnection(mailAccount);
    const resolvedSource = isFolderAlias(sourceFolder)
      ? await resolveFolderAlias(connection, sourceFolder)
      : sourceFolder;
    const resolvedTarget = isFolderAlias(targetFolder)
      ? await resolveFolderAlias(connection, targetFolder)
      : targetFolder;
    
    // Open the source folder
    await openMailbox(connection, resolvedSource);

    // Copy messages to the target folder
    await new Promise((resolve, reject) => {
      connection!.imap.copy(uids, resolvedTarget, (err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    // Delete messages from the source folder (this moves them)
    await connection!.addFlags(uids, '\\Deleted');
    await new Promise((resolve, reject) => {
      connection!.imap.expunge((err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    connection!.end();

    await prisma.emailMessage.deleteMany({
      where: {
        accountId,
        folder: resolvedSource,
        uid: { in: uids },
      },
    });
    await prisma.mailSyncState.updateMany({
      where: {
        accountId,
        folder: resolvedTarget,
      },
      data: {
        lastSyncAt: null,
      },
    });

    return NextResponse.json({ 
      success: true, 
      movedCount: uids.length,
      message: `Moved ${uids.length} message(s) from ${sourceFolder} to ${targetFolder}`
    });
  } catch (error: unknown) {
    console.error('Move Email Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
