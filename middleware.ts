export { auth as middleware } from '@/auth';

// Protect specific routes with NextAuth middleware
export const config = {
  matcher: ['/dashboard/:path*'],
};
