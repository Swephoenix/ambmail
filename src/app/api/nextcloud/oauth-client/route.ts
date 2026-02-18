import { NextResponse } from 'next/server';
import { readRuntimeOAuthConfig, writeRuntimeOAuthConfig } from '@/lib/nextcloud-oauth-config';

export async function GET() {
  const envClientId = process.env.NC_OAUTH_CLIENT_ID?.trim() || '';
  const envClientSecret = process.env.NC_OAUTH_CLIENT_SECRET?.trim() || '';
  const runtime = await readRuntimeOAuthConfig();

  const source = envClientId && envClientSecret ? 'env' : runtime ? 'runtime' : 'missing';
  const clientId = source === 'env' ? envClientId : runtime?.clientId || '';

  return NextResponse.json({
    source,
    clientId,
    hasSecret: source !== 'missing',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : '';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'clientId and clientSecret are required' },
        { status: 400 }
      );
    }

    await writeRuntimeOAuthConfig(clientId, clientSecret);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save OAuth client credentials' },
      { status: 500 }
    );
  }
}
