import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection } from '@/lib/mail-service';
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

    const connection = await getImapConnection(account as any);
    const boxes = await connection.getBoxes();
    
    // Convert the nested object structure to a flat array
    const folders: string[] = [];
    
    const extractFolders = (boxList: any, parentKey = '') => {
      for (const key of Object.keys(boxList)) {
        const box = boxList[key];
        const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
        folders.push(fullPath);
        
        if (box.children) {
          extractFolders(box.children, fullPath);
        }
      }
    };
    
    extractFolders(boxes);
    
    connection.end();
    
    return NextResponse.json(folders);
  } catch (error: any) {
    console.error('Get Folders Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    const connection = await getImapConnection(account as any);
    
    // Create the new folder
    // For subfolders, we need to use the correct delimiter (usually '.')
    await new Promise((resolve, reject) => {
      connection.imap.addBox(folderName, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
    
    connection.end();
    
    return NextResponse.json({ success: true, folderName });
  } catch (error: any) {
    console.error('Create Folder Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
