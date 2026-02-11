import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getImapConnection, isFolderAlias, resolveFolderAlias } from '@/lib/mail-service';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId, uid, folder, action, label } = await req.json();
    if (!accountId || !uid || !action || !label) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const normalizedLabel = String(label).trim();
    if (!normalizedLabel || normalizedLabel.length > 40) {
      return NextResponse.json({ error: 'Invalid label' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (action === 'add') {
      const labelDefinition = await prisma.label.findFirst({
        where: { userId: user.id, name: normalizedLabel },
      });
      if (!labelDefinition) {
        return NextResponse.json({ error: 'Label not found' }, { status: 404 });
      }
    }

    const requestedFolder = folder || 'INBOX';
    let resolvedFolder = requestedFolder;
    let connection;
    if (isFolderAlias(requestedFolder)) {
      connection = await getImapConnection(account as unknown);
      resolvedFolder = await resolveFolderAlias(connection, requestedFolder);
    }
    if (connection) connection.end();

    const cached = await prisma.emailMessage.findUnique({
      where: {
        account_folder_uid: {
          accountId,
          folder: resolvedFolder,
          uid,
        },
      },
    });

    if (!cached) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const nextLabels = new Set(cached.labels || []);
    if (action === 'add') {
      nextLabels.add(normalizedLabel);
    } else if (action === 'remove') {
      nextLabels.delete(normalizedLabel);
    }

    await prisma.emailMessage.update({
      where: {
        account_folder_uid: {
          accountId,
          folder: resolvedFolder,
          uid,
        },
      },
      data: {
        labels: Array.from(nextLabels),
      },
    });

    return NextResponse.json({ success: true, labels: Array.from(nextLabels) });
  } catch (error: unknown) {
    console.error('Label Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
