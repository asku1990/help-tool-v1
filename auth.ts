import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface GitHubProfile {
  login: string;
  email: string;
  name: string;
}

// Support legacy NEXTAUTH_SECRET by falling back to it if AUTH_SECRET is unset
if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
}

// Fail fast in production if required environment variables are missing
const REQUIRED_ENV_VARS_IN_PROD = ['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'ALLOWED_USERS'];
if (process.env.NODE_ENV === 'production') {
  const hasSecret = Boolean(process.env.AUTH_SECRET);
  if (!hasSecret) {
    throw new Error('Missing required environment variable: AUTH_SECRET (or NEXTAUTH_SECRET)');
  }
  for (const key of REQUIRED_ENV_VARS_IN_PROD) {
    const value = process.env[key];
    if (!value || (key === 'ALLOWED_USERS' && value.trim().length === 0)) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

// Get allowed users from environment variable
const ALLOWED_USERS = process.env.ALLOWED_USERS
  ? process.env.ALLOWED_USERS.split(',').map(user => user.trim())
  : [];

// Validate ALLOWED_USERS configuration
if (ALLOWED_USERS.length === 0) {
  logger.error('No allowed users configured. Please set ALLOWED_USERS environment variable.');
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  pages: {
    signIn: '/',
    signOut: '/',
    error: '/auth/error', // Add error page
  },
  experimental: {
    enableWebAuthn: false,
  },
  callbacks: {
    authorized({ auth, request }) {
      if (process.env.TEST_BYPASS_AUTH === '1') {
        return true;
      }
      // Only allow access when a user is authenticated. Middleware matcher scopes this to protected routes.
      return !!auth?.user;
    },
    async signIn({ user, account, profile }) {
      if (!user.email) {
        throw new Error('No email found from GitHub');
      }

      try {
        const githubProfile = profile as unknown as GitHubProfile;
        if (!githubProfile?.login) {
          throw new Error('No GitHub username found');
        }

        // Log sign-in attempt
        logger.info('Sign-in attempt', {
          username: githubProfile.login,
          email: user.email,
        });

        // Strict check for ALLOWED_USERS (GitHub provider only)
        if (ALLOWED_USERS.length === 0) {
          throw new Error('No allowed users configured. Please contact the administrator.');
        }

        if (!ALLOWED_USERS.includes(githubProfile.login)) {
          logger.warn('Unauthorized sign-in attempt', {
            username: githubProfile.login,
            email: user.email,
          });
          throw new Error(`User ${githubProfile.login} is not authorized to sign in`);
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // If user doesn't exist, create a new one
        if (!existingUser) {
          try {
            const newUser = await prisma.user.create({
              data: {
                email: user.email,
                username: githubProfile.login,
                passwordHash: '', // Empty for OAuth users
                userType: 'REGULAR',
              },
            });
            logger.info('New user created', {
              userId: newUser.id,
              username: githubProfile.login,
              email: user.email,
            });
          } catch (error) {
            logger.error('Failed to create user', {
              error,
              username: githubProfile.login,
              email: user.email,
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
  },
});
