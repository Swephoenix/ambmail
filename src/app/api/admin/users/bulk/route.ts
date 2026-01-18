import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { prefetchUserAccounts } from '@/lib/mail-cache';

type BulkAccount = {
  email: string;
  password?: string;
  imapHost: string;
  smtpHost: string;
  imapPort?: number;
  smtpPort?: number;
};

type BulkProfile = {
  name: string;
  department?: string;
  username: string;
  password: string;
  accounts: BulkAccount[];
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await req.json();
  const { profiles } = data;

  if (!Array.isArray(profiles) || profiles.length === 0) {
    return NextResponse.json({ error: 'profiles array required' }, { status: 400 });
  }

  for (const profile of profiles as BulkProfile[]) {
    if (!profile.name || !profile.username || !profile.password) {
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { username: profile.username } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: profile.name,
          department: profile.department,
          ...(profile.password
            ? {
              passwordHash: hashPassword(profile.password),
              passwordEncrypted: encrypt(profile.password),
            }
            : {}),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name: profile.name,
          department: profile.department,
          username: profile.username,
          passwordHash: hashPassword(profile.password),
          passwordEncrypted: encrypt(profile.password),
          role: 'USER',
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { username: profile.username } });
    if (!user) continue;
    void prefetchUserAccounts(user.id);

    for (const account of profile.accounts || []) {
      if (!account.email) continue;
      await prisma.account.upsert({
        where: {
          userId_email: {
            userId: user.id,
            email: account.email,
          },
        },
        create: {
          userId: user.id,
          email: account.email,
          password: encrypt(account.password || ''),
          adminManaged: true,
          imapHost: account.imapHost,
          smtpHost: account.smtpHost,
          imapPort: account.imapPort || 993,
          smtpPort: account.smtpPort || 465,
        },
        update: {
          imapHost: account.imapHost,
          smtpHost: account.smtpHost,
          imapPort: account.imapPort || 993,
          smtpPort: account.smtpPort || 465,
          adminManaged: true,
          ...(account.password ? { password: encrypt(account.password) } : {}),
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
