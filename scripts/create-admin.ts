import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!username || !password) {
    console.log('[admin] ADMIN_USERNAME and ADMIN_PASSWORD not set, skipping admin bootstrap.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  let adminId = existing?.id;
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN' },
      });
    }
    adminId = existing.id;
    console.log('[admin] Admin user already exists.');
  } else {
    const created = await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        name,
        role: 'ADMIN',
      },
    });
    adminId = created.id;
    console.log('[admin] Admin user created.');
  }

  if (process.env.ADMIN_ATTACH_EXISTING === '1' && adminId) {
    const accountResult = await prisma.account.updateMany({
      where: { userId: null },
      data: { userId: adminId },
    });
    const contactResult = await prisma.contact.updateMany({
      where: { userId: null },
      data: { userId: adminId },
    });
    console.log(`[admin] Attached ${accountResult.count} accounts and ${contactResult.count} contacts to admin.`);
  }
}

main()
  .catch((error) => {
    console.error('[admin] Failed to create admin user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
