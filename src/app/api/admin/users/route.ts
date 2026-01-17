import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { prefetchUserAccounts } from '@/lib/mail-cache';

type AccountInput = {
  id?: string;
  email: string;
  password?: string;
  imapHost: string;
  smtpHost: string;
  imapPort?: number;
  smtpPort?: number;
};

async function serializeUsers() {
  const users = await prisma.user.findMany({
    include: {
      accounts: true,
    },
    orderBy: { name: 'asc' },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    department: user.department,
    username: user.username,
    mailQuotaMb: user.mailQuotaMb,
    password: user.passwordEncrypted
      ? (() => {
        try {
          return decrypt(user.passwordEncrypted);
        } catch {
          return '';
        }
      })()
      : '',
    role: user.role,
    accounts: user.accounts.map((account) => ({
      id: account.id,
      email: account.email,
      imapHost: account.imapHost,
      smtpHost: account.smtpHost,
      imapPort: account.imapPort,
      smtpPort: account.smtpPort,
      hasPassword: Boolean(account.password),
    })),
  }));
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const users = await serializeUsers();
  return NextResponse.json({ profiles: users });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await req.json();
  const { name, department, username, password, accounts = [], mailQuotaMb } = data;

  if (!name || !username || !password) {
    return NextResponse.json({ error: 'name, username, and password are required' }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      department,
      username,
      mailQuotaMb: Number.isFinite(Number(mailQuotaMb)) ? Number(mailQuotaMb) : undefined,
      passwordHash: hashPassword(password),
      passwordEncrypted: encrypt(password),
      role: 'USER',
      accounts: {
        create: accounts.map((account: AccountInput) => ({
          email: account.email,
          password: encrypt(account.password || ''),
          imapHost: account.imapHost,
          smtpHost: account.smtpHost,
          imapPort: account.imapPort || 993,
          smtpPort: account.smtpPort || 465,
        })),
      },
    },
  });

  void prefetchUserAccounts(user.id);
  return NextResponse.json({ id: user.id, prefetchStarted: true });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await req.json();
  const { id, name, department, username, password, accounts = [], mailQuotaMb } = data;

  if (!id || !name || !username) {
    return NextResponse.json({ error: 'id, name, and username are required' }, { status: 400 });
  }

  const existingAccounts = await prisma.account.findMany({ where: { userId: id } });
  const existingAccountIds = new Set(existingAccounts.map((account) => account.id));
  const incomingIds = new Set(accounts.map((account: AccountInput) => account.id).filter(Boolean));

  const toDelete = existingAccounts.filter((account) => !incomingIds.has(account.id));

  const accountOps = accounts.map((account: AccountInput) => {
    const accountData = {
      email: account.email,
      imapHost: account.imapHost,
      smtpHost: account.smtpHost,
      imapPort: account.imapPort || 993,
      smtpPort: account.smtpPort || 465,
    };

    const passwordUpdate = account.password ? { password: encrypt(account.password) } : {};

    if (account.id && existingAccountIds.has(account.id)) {
      return prisma.account.update({
        where: { id: account.id },
        data: {
          ...accountData,
          ...passwordUpdate,
        },
      });
    }

    return prisma.account.create({
      data: {
        ...accountData,
        password: encrypt(account.password || ''),
        userId: id,
      },
    });
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        name,
        department,
        username,
        ...(Number.isFinite(Number(mailQuotaMb)) ? { mailQuotaMb: Number(mailQuotaMb) } : {}),
        ...(password
          ? {
            passwordHash: hashPassword(password),
            passwordEncrypted: encrypt(password),
          }
          : {}),
      },
    }),
    ...accountOps,
    ...toDelete.map((account) => prisma.account.delete({ where: { id: account.id } })),
  ]);

  void prefetchUserAccounts(id);
  return NextResponse.json({ id, prefetchStarted: true });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await req.json();
  const { ids } = data;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 });
  }

  await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ success: true });
}
