import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

const UPLOAD_DIR = path.join('/tmp', 'uxmail-uploads');

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll('files').filter((value) => value instanceof File) as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: 'files required' }, { status: 400 });
  }

  await ensureUploadDir();

  const uploaded: Array<{ token: string; name: string; size: number; type: string }> = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const token = crypto.randomBytes(16).toString('hex');
    const filePath = path.join(UPLOAD_DIR, token);
    const metaPath = path.join(UPLOAD_DIR, `${token}.json`);

    await fs.writeFile(filePath, buffer);
    await fs.writeFile(
      metaPath,
      JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type,
      })
    );

    uploaded.push({
      token,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  }

  return NextResponse.json({ files: uploaded });
}
