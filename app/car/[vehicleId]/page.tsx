'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function VehiclePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const vehicleId = Array.isArray(params?.vehicleId)
    ? params?.vehicleId[0]
    : (params?.vehicleId as string | undefined);

  if (status === 'unauthenticated') {
    router.replace('/');
    return null;
  }

  if (status === 'loading') {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Vehicle {vehicleId}</h1>
          <Link href="/car" className="text-sm text-blue-600 hover:underline">
            Back to vehicles
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">Fill-ups</h2>
              <div className="text-sm text-gray-500">No fill-ups yet.</div>
              <div className="mt-4">
                <Button>Add fill-up</Button>
              </div>
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">Expenses</h2>
              <div className="text-sm text-gray-500">No expenses yet.</div>
              <div className="mt-4">
                <Button variant="outline">Add expense</Button>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="text-base font-semibold mb-2">Stats</h3>
              <div className="text-sm text-gray-500">L/100km, cost/km coming soon.</div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
