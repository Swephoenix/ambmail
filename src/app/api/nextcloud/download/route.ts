import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { downloadNextcloudFile, getValidToken } from '@/lib/nextcloud';

const UPLOAD_DIR = path.join('/tmp', 'uxmail-uploads');

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getValidToken(user.id);
  if (!token || !token.ncUserId) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 });
  }

  const data = await req.json().catch(() => ({}));
  const filePath = String(data?.path || '');
  if (!filePath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 });
  }

  try {
    const file = await downloadNextcloudFile(token.accessToken, token.ncUserId, filePath);
    await ensureUploadDir();

    const tokenId = crypto.randomBytes(16).toString('hex');
    const destPath = path.join(UPLOAD_DIR, tokenId);
    const metaPath = path.join(UPLOAD_DIR, `${tokenId}.json`);

    await fs.writeFile(destPath, file.buffer);
    await fs.writeFile(
      metaPath,
      JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.contentType,
      })
    );

    return NextResponse.json({
      token: tokenId,
      name: file.name,
      size: file.size,
      type: file.contentType,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message || 'Download failed' }, { status: 500 });
  }
}
