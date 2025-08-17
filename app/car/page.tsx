'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Car, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useVehicles } from '@/hooks';
import { apiPost } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function CarHomePage() {
  const { status } = useSession();
  const router = useRouter();
  const [isDemo] = useState<boolean>(() => false);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<
    Array<{
      id: string;
      name: string;
      make?: string | null;
      model?: string | null;
      year?: number | null;
    }>
  >([]);
  const { isVehicleDialogOpen: open, setVehicleDialogOpen: setOpen } = useUiStore();
  const [form, setForm] = useState<{ name: string; make: string; model: string; year: string }>({
    name: '',
    make: '',
    model: '',
    year: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const { data: vehiclesData, refetch: refetchVehicles } = useVehicles(
    status === 'authenticated' || isDemo
  );

  useEffect(() => {
    if (vehiclesData?.vehicles) setVehicles(vehiclesData.vehicles);
  }, [vehiclesData]);

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
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add vehicle
            </Button>
          </div>
          <div className="mt-6 space-y-3">
            {loading && <div className="text-sm text-gray-500">Loading vehicles…</div>}
            {!loading && vehicles.length === 0 && (
              <div className="text-gray-600 text-sm">No vehicles yet.</div>
            )}
            {!loading && vehicles.length > 0 && (
              <ul className="divide-y">
                {vehicles.map(v => (
                  <li key={v.id}>
                    <Link
                      href={`/car/${v.id}`}
                      className="flex items-center justify-between py-3 px-2 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div>
                        <div className="font-medium">{v.name}</div>
                        <div className="text-xs text-gray-500">
                          {[v.make, v.model, v.year ?? ''].filter(Boolean).join(' ')}
                        </div>
                      </div>
                      <span className="text-sm text-blue-600">Open</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent aria-label="Add vehicle dialog">
            <DialogHeader>
              <DialogTitle>Add vehicle</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async e => {
                e.preventDefault();
                setLoading(true);
                try {
                  await apiPost<{ id: string }>('/*/api/vehicles'.replace('/*', ''), {
                    name: form.name,
                    make: form.make || undefined,
                    model: form.model || undefined,
                    year: form.year ? parseInt(form.year, 10) : undefined,
                  });
                  setOpen(false);
                  setForm({ name: '', make: '', model: '', year: '' });
                  await refetchVehicles();
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-sm">Name</span>
                  <input
                    className="border rounded-md px-3 py-2"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Make</span>
                  <input
                    className="border rounded-md px-3 py-2"
                    value={form.make}
                    onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Model</span>
                  <input
                    className="border rounded-md px-3 py-2"
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Year</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1900"
                    className="border rounded-md px-3 py-2"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!form.name.trim() || loading}>
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
