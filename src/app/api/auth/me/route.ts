import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createSession,
  getAdminSessionUser,
  getSessionUser,
  setSessionCookie,
  sessionCookies,
  verifyPassword,
} from '@/lib/auth';
import { rotateAdminCredentialsIfNeeded } from '@/lib/admin-credentials';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const allowAutoLogin = searchParams.get('admin') === '1';
  const user = allowAutoLogin ? await getAdminSessionUser() : await getSessionUser();
  if (!user) {
    const autoLoginEnabled = process.env.ADMIN_AUTO_LOGIN !== '0';
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (allowAutoLogin && autoLoginEnabled && adminUsername && adminPassword) {
      const admin = await prisma.user.findUnique({ where: { username: adminUsername } });
      if (
        admin &&
        admin.role === 'ADMIN' &&
        !admin.adminCredentialsShownAt &&
        verifyPassword(adminPassword, admin.passwordHash)
      ) {
        const adminCredentials = await rotateAdminCredentialsIfNeeded(admin.id);
        const token = await createSession(admin.id);
        await setSessionCookie(token, { cookieName: sessionCookies.admin });
        return NextResponse.json({
          id: admin.id,
          username: adminCredentials?.adminUsername ?? admin.username,
          name: admin.name,
          department: admin.department,
          role: admin.role,
          needsAdminCredentials: Boolean(adminCredentials),
          adminCredentials,
        });
      }
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let adminCredentials: { adminUsername: string; adminPassword: string } | null = null;
  if (user.role === 'ADMIN') {
    adminCredentials = await rotateAdminCredentialsIfNeeded(user.id);
  }

  return NextResponse.json({
    id: user.id,
    username: adminCredentials?.adminUsername ?? user.username,
    name: user.name,
    department: user.department,
    role: user.role,
    needsAdminCredentials: Boolean(adminCredentials),
    adminCredentials,
  });
}
