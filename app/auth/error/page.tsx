'use client';

import { useSearchParams } from 'next/navigation';
import { SignInButton } from '@/components/buttons/SignInButton';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    // Log authentication error using our logger
    logger.error('Authentication Error', {
      error,
      path: window.location.pathname,
      search: window.location.search,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-6">
            {error || 'An error occurred during authentication.'}
          </p>
          <div className="flex justify-center">
            <SignInButton />
          </div>
        </div>
      </div>
    </div>
  );
}
