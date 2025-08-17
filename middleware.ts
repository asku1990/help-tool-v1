import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/auth';

export async function middleware(req: NextRequest) {
  if (process.env.TEST_BYPASS_AUTH === '1') {
    return NextResponse.next();
  }
  return auth(req as any);
}

export const config = {
  matcher: ['/dashboard/:path*', '/car/:path*'],
};
