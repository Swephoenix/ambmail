import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Local login is disabled. Use Nextcloud authentication.' },
    { status: 403 },
  );
}
