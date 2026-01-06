import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, openMailbox } from '@/lib/mail-service';

export async function POST(req: Request) {
  try {
    const { accountId, uids, sourceFolder, targetFolder } = await req.json();

    if (!accountId || !uids || !sourceFolder || !targetFolder) {
      return NextResponse.json({ 
        error: 'accountId, uids, sourceFolder, and targetFolder are required' 
      }, { status: 400 });
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const connection = await getImapConnection(account as any);
    
    // Open the source folder
    await openMailbox(connection, sourceFolder);

    // Copy messages to the target folder
    await new Promise((resolve, reject) => {
      connection.imap.copy(uids, targetFolder, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
    
    // Delete messages from the source folder (this moves them)
    await connection.addFlags(uids, '\\Deleted');
    await new Promise((resolve, reject) => {
      connection.imap.expunge((err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
    
    connection.end();

    return NextResponse.json({ 
      success: true, 
      movedCount: uids.length,
      message: `Moved ${uids.length} message(s) from ${sourceFolder} to ${targetFolder}`
    });
  } catch (error: any) {
    console.error('Move Email Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}