import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'username and password required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    let adminCredentials: { adminUsername: string; adminPassword: string } | null = null;
    if (user.role === 'ADMIN' && !user.adminCredentialsShownAt) {
      adminCredentials = {
        adminUsername: process.env.ADMIN_USERNAME || user.username,
        adminPassword: process.env.ADMIN_PASSWORD || '',
      };
    }

    const token = await createSession(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      department: user.department,
      role: user.role,
      needsAdminCredentials: Boolean(adminCredentials),
      adminCredentials,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
