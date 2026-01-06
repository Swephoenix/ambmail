import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSmtpTransporter } from '@/lib/mail-service';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { accountId, to, subject, body } = data;

    console.log('Send API called with:', { accountId, to, subject });

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      console.error('Account not found:', accountId);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    console.log('Connecting to SMTP for account:', account.email);
    const transporter = await getSmtpTransporter(account as any);

    console.log('Sending email with options:', {
      from: `"${account.name || account.email}" <${account.email}>`,
      to,
      subject
    });

    await transporter.sendMail({
      from: `"${account.name || account.email}" <${account.email}>`,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'), // Simple text to html conversion
    });

    console.log('Email sent successfully');

    // Automatically add to contacts if not exists
    try {
      await prisma.contact.upsert({
        where: { email: to },
        update: {},
        create: { email: to, name: to.split('@')[0] },
      });
      console.log('Contact updated/created successfully');
    } catch (e) {
      console.error('Contact saving error:', e);
      // Ignore contact saving errors
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SMTP Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
