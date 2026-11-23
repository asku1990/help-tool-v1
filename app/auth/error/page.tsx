'use client';

import { useSearchParams } from 'next/navigation';
import { SignInButton } from '@/components/buttons/SignInButton';
import { Card } from '@/components/ui';
import { useEffect, Suspense } from 'react';
import { logger } from '@/lib/logger';

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas">
          <div className="max-w-md w-full mx-auto p-6">
            <Card variant="subtle" className="p-8">
              <h1 className="mb-4 text-2xl font-bold text-muted-foreground">Loading...</h1>
            </Card>
          </div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}

// This component is just for using useSearchParams
function ErrorContent() {
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
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="max-w-md w-full mx-auto p-6">
        <Card variant="subtle" className="p-8">
          <h1 className="mb-4 text-2xl font-bold text-destructive">Authentication Error</h1>
          <p className="mb-6 text-muted-foreground">
            {error || 'An error occurred during authentication.'}
          </p>
          <div className="flex justify-center">
            <SignInButton />
          </div>
        </Card>
      </div>
    </div>
  );
}
