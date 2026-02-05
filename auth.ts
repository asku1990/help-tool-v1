import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Google from 'next-auth/providers/google';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface GoogleProfile {
  email: string;
  email_verified?: boolean;
  name?: string;
}

type AuthToken = JWT & { userId?: string };

function toSafeUsername(email: string): string {
  const base = email.split('@')[0] ?? 'user';
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'user';
}

async function getUniqueUsername(email: string): Promise<string> {
  const base = toSafeUsername(email);
  const existing = await prisma.user.findUnique({ where: { username: base } });
  if (!existing) return base;

  for (let i = 1; i <= 50; i += 1) {
    const candidate = `${base}-${i}`;
    const user = await prisma.user.findUnique({ where: { username: candidate } });
    if (!user) return candidate;
  }

  return `${base}-${Date.now()}`;
}

// Support legacy NEXTAUTH_SECRET by falling back to it if AUTH_SECRET is unset
if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
}

// Fail fast in production if required environment variables are missing
const REQUIRED_ENV_VARS_IN_PROD = ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'ALLOWED_EMAILS'];
if (process.env.NODE_ENV === 'production') {
  const hasSecret = Boolean(process.env.AUTH_SECRET);
  if (!hasSecret) {
    throw new Error('Missing required environment variable: AUTH_SECRET (or NEXTAUTH_SECRET)');
  }
  for (const key of REQUIRED_ENV_VARS_IN_PROD) {
    const value = process.env[key];
    if (!value || (key === 'ALLOWED_EMAILS' && value.trim().length === 0)) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

// Get allowed emails from environment variable
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(',').map(email => email.trim().toLowerCase())
  : [];

// Validate ALLOWED_EMAILS configuration
if (ALLOWED_EMAILS.length === 0) {
  logger.error('No allowed emails configured. Please set ALLOWED_EMAILS environment variable.');
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: '/',
    signOut: '/',
    error: '/auth/error', // Add error page
  },
  experimental: {
    enableWebAuthn: false,
  },
  callbacks: {
    authorized({ auth: sessionAuth }) {
      if (process.env.TEST_BYPASS_AUTH === '1') {
        return true;
      }
      // Only allow access when a user is authenticated. Middleware matcher scopes this to protected routes.
      return !!sessionAuth?.user;
    },
    async signIn({ user, account, profile }) {
      if (!user.email) {
        throw new Error('No email found from Google');
      }

      try {
        if (account?.provider !== 'google') {
          throw new Error('Unsupported authentication provider');
        }

        const googleProfile = profile as unknown as GoogleProfile;
        if (!googleProfile?.email) {
          throw new Error('No email found from Google');
        }

        if (googleProfile.email_verified === false) {
          throw new Error('Email address is not verified');
        }

        const userEmail = user.email.toLowerCase();

        // Log sign-in attempt
        logger.info('Sign-in attempt', {
          email: userEmail,
        });

        // Strict check for ALLOWED_EMAILS (Google provider only)
        if (ALLOWED_EMAILS.length === 0) {
          throw new Error('No allowed emails configured. Please contact the administrator.');
        }

        if (!ALLOWED_EMAILS.includes(userEmail)) {
          logger.warn('Unauthorized sign-in attempt', {
            email: userEmail,
          });
          throw new Error(`User ${userEmail} is not authorized to sign in`);
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: userEmail },
        });

        // If user doesn't exist, create a new one
        if (!existingUser) {
          try {
            const username = await getUniqueUsername(userEmail);
            const newUser = await prisma.user.create({
              data: {
                email: userEmail,
                username,
                passwordHash: '', // Empty for OAuth users
                userType: 'REGULAR',
              },
            });
            logger.info('New user created', {
              userId: newUser.id,
              username,
              email: userEmail,
            });
          } catch (error) {
            logger.error('Failed to create user', {
              error,
              email: userEmail,
            });
            throw new Error('Failed to create user account. Please try again later.');
          }
        } else {
          logger.info('Existing user signed in', {
            userId: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
          });
        }

        return true;
      } catch (error) {
        logger.error('Error in signIn callback', {
          error,
          email: user.email,
        });
        // Return error message to be displayed to user
        return `/auth/error?error=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`;
      }
    },
    async jwt({ token }) {
      const typedToken = token as AuthToken;
      if (!typedToken.userId && token.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
        });
        if (existingUser) {
          typedToken.userId = existingUser.id;
        }
      }
      return typedToken;
    },
    async session({ session, token }) {
      const typedToken = token as AuthToken;
      if (session.user && typedToken.userId) {
        (session.user as typeof session.user & { id?: string }).id = typedToken.userId;
      }
      return session;
    },
  },
});
