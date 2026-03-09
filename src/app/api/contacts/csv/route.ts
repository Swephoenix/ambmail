import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// Export contacts as CSV
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId') || '';

  let contacts;
  if (groupId === 'all-active') {
    contacts = await prisma.contact.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { name: 'asc' },
    });
  } else if (groupId && groupId !== 'all') {
    contacts = await prisma.contact.findMany({
      where: {
        userId: user.id,
        groups: { some: { groupId } },
      },
      orderBy: { name: 'asc' },
    });
  } else {
    contacts = await prisma.contact.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });
  }

  // Create CSV content
  const csvRows = contacts.map(c => {
    const name = c.name ? `"${c.name.replace(/"/g, '""')}"` : '';
    const email = `"${c.email.replace(/"/g, '""')}"`;
    const isActive = c.isActive ? 'active' : 'inactive';
    return `${name},${email},${isActive}`;
  });

  const csvContent = [
    'Name,Email,Status',
    ...csvRows,
  ].join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contacts.csv"',
    },
  });
}

// Import contacts from CSV
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const text = await req.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    // Skip header row
    const dataLines = lines.slice(1);
    const imported: { email: string; name?: string; isActive: boolean }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted values)
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length < 2) {
        errors.push(`Line ${i + 2}: Invalid format`);
        continue;
      }

      let name: string | undefined;
      let email: string;
      let isActive = true;

      // Handle different CSV formats
      if (matches.length >= 3) {
        name = matches[0]?.replace(/^"|"$/g, '').replace(/""/g, '"');
        email = matches[1]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        const status = matches[2]?.replace(/^"|"$/g, '').toLowerCase() || 'active';
        isActive = status !== 'inactive';
      } else {
        // Assume format: email,name or just email
        const first = matches[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        const second = matches[1]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
        
        if (first.includes('@')) {
          email = first;
          name = second || undefined;
        } else {
          name = first;
          email = second;
        }
      }

      if (!email || !email.includes('@')) {
        errors.push(`Line ${i + 2}: Invalid email`);
        continue;
      }

      imported.push({ email, name, isActive });
    }

    // Import contacts
    const results = await Promise.all(
      imported.map(async ({ email, name, isActive }) => {
        try {
          const contact = await prisma.contact.upsert({
            where: {
              userId_email: {
                userId: user.id,
                email,
              },
            },
            update: { name, isActive },
            create: { email, name: name || undefined, userId: user.id, isActive },
          });
          return { success: true, email, contact };
        } catch (error) {
          return { success: false, email, error: (error as Error).message };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      imported: successCount,
      failed: failCount,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
