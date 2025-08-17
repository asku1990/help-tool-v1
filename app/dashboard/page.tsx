'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SignOutButton } from '@/components/buttons/SignOutButton';
import { Toaster } from '@/components/ui/sonner';
import Link from 'next/link';
import { Car, Dumbbell, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
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

  // Redirect to home if not authenticated (client-safe)
  useEffect(() => {
    if (status === 'unauthenticated' && !isDemo) {
      router.replace('/');
    }
  }, [status, isDemo, router]);

  if (status === 'unauthenticated' && !isDemo) {
    return null;
  }

  if (status === 'loading' && !isDemo) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="text-gray-600 max-w-[50vw] truncate">
              Welcome, {session?.user?.name || session?.user?.email || (isDemo ? 'Demo' : '')}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">Choose an app</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Car Expenses App */}
          <Link
            href="/car"
            className="group block bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold">Car Expenses</div>
                <div className="text-sm text-gray-500">Track fuel and costs</div>
              </div>
            </div>
          </Link>

          {/* Workout App (coming later) */}
          <div
            className="bg-white p-6 rounded-xl shadow-sm border opacity-60 cursor-not-allowed"
            aria-disabled
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gray-50 text-gray-600">
                <Dumbbell className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  Workout
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">Coming later</span>
                </div>
                <div className="text-sm text-gray-500">Sets, weights, and notes</div>
              </div>
            </div>
          </div>

          {/* Reserved/locked */}
          <div
            className="bg-white p-6 rounded-xl shadow-sm border opacity-60 cursor-not-allowed"
            aria-disabled
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gray-50 text-gray-600">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  More Apps
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">Coming later</span>
                </div>
                <div className="text-sm text-gray-500">New tools planned</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
