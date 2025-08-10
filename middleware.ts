import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/auth';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const wantsDemo = url.searchParams.get('demo') === '1';
  const hasDemoCookie = req.cookies.get('demo')?.value === '1';

  if (wantsDemo || hasDemoCookie) {
    const res = NextResponse.next();
    if (!hasDemoCookie) {
      res.cookies.set('demo', '1', { path: '/', maxAge: 60 * 60, sameSite: 'lax' });
    }
    if (wantsDemo) {
      url.searchParams.delete('demo');
      return NextResponse.redirect(url, { headers: res.headers });
    }
    return res;
  }

  // Fall back to NextAuth protection
  // @ts-expect-error next-auth edge types
  return auth(req);
}

export const config = {
  matcher: ['/dashboard/:path*', '/car/:path*'],
};
