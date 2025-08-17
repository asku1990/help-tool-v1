'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Car, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CarHomePage() {
  const { status } = useSession();
  const router = useRouter();
  const [isDemo] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return (
      document.cookie
        .split('; ')
        .find(c => c.startsWith('demo='))
        ?.split('=')[1] === '1'
    );
  });

  useEffect(() => {
    if (status === 'unauthenticated' && !isDemo) {
      router.replace('/');
    }
  }, [status, isDemo, router]);

  if (status === 'unauthenticated' && !isDemo) {
    return null;
  }

  if (status === 'loading' && !isDemo) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-6 h-6" /> Car Expenses
          </h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Vehicles</h2>
              <p className="text-sm text-gray-500">
                Add your first vehicle to start tracking fuel and expenses.
              </p>
            </div>
            <Button disabled={isDemo} title={isDemo ? 'Disabled in demo' : undefined}>
              <Plus className="w-4 h-4 mr-2" /> Add vehicle
            </Button>
          </div>
          <div className="mt-6 text-gray-600 text-sm">
            {isDemo ? 'Sample data will be added in demo later.' : 'No vehicles yet.'}
          </div>
        </div>
      </main>
    </div>
  );
}
