import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/auth';

export function middleware(req: NextRequest) {
  // @ts-expect-error next-auth edge types
  return auth(req);
}

export const config = {
  matcher: ['/dashboard/:path*', '/car/:path*'],
};
