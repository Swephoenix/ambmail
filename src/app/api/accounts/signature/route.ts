import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { accountId, signature, senderName } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: { signature, senderName },
    });

    return NextResponse.json({
      success: true,
      signature: updatedAccount.signature,
      senderName: updatedAccount.senderName,
    });
  } catch (error: unknown) {
    console.error('Update signature error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
      select: { signature: true, senderName: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({
      signature: account.signature,
      senderName: account.senderName,
    });
  } catch (error: unknown) {
    console.error('Get signature error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
