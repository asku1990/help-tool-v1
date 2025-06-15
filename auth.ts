import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { prisma } from '@/lib/db';

interface GitHubProfile {
  login: string;
  email: string;
  name: string;
}

// Get allowed users from environment variable
const ALLOWED_USERS = process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  pages: {
    signIn: '/',
    signOut: '/',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        console.error('No email found from GitHub');
        return false;
      }

      try {
        const githubProfile = profile as unknown as GitHubProfile;
        if (!githubProfile?.login) {
          console.error('No GitHub username found');
          return false;
        }

        // Check if user is in allowed list
        if (!ALLOWED_USERS.includes(githubProfile.login)) {
          console.error(`User ${githubProfile.login} is not authorized to sign in`);
          return false;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // If user doesn't exist, create a new one
        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email,
              username: githubProfile.login,
              passwordHash: '', // Empty for OAuth users
              userType: 'REGULAR',
            },
          });
          console.log(`Created new user: ${githubProfile.login}`);
        } else {
          console.log(`Existing user signed in: ${existingUser.username}`);
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after sign in
      return `${baseUrl}/dashboard`;
    },
  },
});
