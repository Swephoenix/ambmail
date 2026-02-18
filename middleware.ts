import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const REALM = 'Ambmail';

function getBasicAuthCredentials(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  try {
    const decoded = atob(authHeader.slice(6));
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return null;
    return {
      user: decoded.slice(0, separatorIndex),
      pass: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !pass) {
    return NextResponse.next();
  }

  const credentials = getBasicAuthCredentials(req.headers.get('authorization'));
  if (!credentials || credentials.user !== user || credentials.pass !== pass) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${REALM}"`,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
