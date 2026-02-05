'use client';

import { Button } from '@/components/ui';
import { signIn } from 'next-auth/react';

export function SignInButton() {
  return (
    <Button
      onClick={() => signIn('google')}
      className="w-full p-3 text-base bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center gap-2"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.5 12 2.5 6.9 2.5 2.7 6.7 2.7 11.8s4.2 9.3 9.3 9.3c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
        />
        <path
          fill="#34A853"
          d="M3.8 7.5l3.2 2.3C7.8 8 9.8 6.2 12 6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.5 12 2.5c-3.5 0-6.6 2-8.2 5z"
        />
        <path
          fill="#FBBC05"
          d="M12 21.1c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.8.6-2 1-3.3 1-2.2 0-4.2-1.5-4.9-3.6L3.9 16c1.6 3 4.7 5.1 8.1 5.1z"
        />
        <path
          fill="#4285F4"
          d="M21.1 12c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.2 1.1-1 2.1-2.2 2.7l3.1 2.4c1.8-1.6 2.8-4 2.8-6.4z"
        />
      </svg>
      Sign in with Google
    </Button>
  );
}
