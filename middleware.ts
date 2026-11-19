import { NextResponse, type NextRequest } from 'next/server';
import { authMiddleware } from '@/auth';
import { localAutoSignInEnabled } from '@/lib/auth/local-test-session';

export function middleware(req: NextRequest) {
  if (process.env.TEST_BYPASS_AUTH === '1' || localAutoSignInEnabled()) {
    return NextResponse.next();
  }
  // Auth.js supports a NextRequest at runtime but omits this overload from its types.
  return (authMiddleware as unknown as (_request: NextRequest) => Promise<Response>)(req);
}

export const config = {
  matcher: ['/dashboard/:path*', '/car/:path*'],
};
