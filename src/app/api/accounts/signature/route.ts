import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request) {
  try {
    const { accountId, signature } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: { signature },
    });

    return NextResponse.json({ 
      success: true, 
      signature: updatedAccount.signature 
    });
  } catch (error: any) {
    console.error('Update signature error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { signature: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ signature: account.signature });
  } catch (error: any) {
    console.error('Get signature error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}