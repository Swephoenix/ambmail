import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection } from '@/lib/mail-service';
import type { MailAccount } from '@/lib/mail-service';
import { requireUser } from '@/lib/auth';

// Get all folders for an account
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  try {
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
    const boxes = await connection!.getBoxes();

    // Convert the nested object structure to a flat array
    const folders: string[] = [];

    const extractFolders = (boxList: Record<string, any>, parentKey = '') => {
      for (const key of Object.keys(boxList)) {
        const box = boxList[key];
        const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
        folders.push(fullPath);

        if (box.children) {
          extractFolders(box.children, fullPath);
        }
      }
    };

    extractFolders(boxes as Record<string, any>);

    connection!.end();
    
    return NextResponse.json(folders);
  } catch (error: unknown) {
    console.error('Get Folders Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// Create a new folder
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { accountId, folderName } = await req.json();

    if (!accountId || !folderName) {
      return NextResponse.json({ error: 'accountId and folderName are required' }, { status: 400 });
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

    // Create the new folder
    // For subfolders, we need to use the correct delimiter (usually '.')
    await new Promise((resolve, reject) => {
      connection!.imap.addBox(folderName, (err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    connection!.end();
    
    return NextResponse.json({ success: true, folderName });
  } catch (error: unknown) {
    console.error('Create Folder Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
