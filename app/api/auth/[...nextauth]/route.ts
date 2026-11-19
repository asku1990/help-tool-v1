import { handlers } from '@/auth';
import type { NextRequest } from 'next/server';
import { getLocalTestSession, localAutoSignInEnabled } from '@/lib/auth/local-test-session';

export async function GET(request: NextRequest) {
  if (localAutoSignInEnabled() && request.nextUrl.pathname === '/api/auth/session') {
    return Response.json(await getLocalTestSession(), { headers: { 'Cache-Control': 'no-store' } });
  }
  return handlers.GET(request);
}

export const { POST } = handlers;
