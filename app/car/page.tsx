'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Card,
  CardContent,
} from '@/components/ui';
import { Car, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useVehicles } from '@/hooks';
import { apiPost } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui';
import PageHeader from '@/components/layout/PageHeader';
import { computeInspectionStatus } from '@/utils';
import { VehicleListSkeleton } from '@/components/car';

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
      licensePlate?: string | null;
      inspectionDueDate?: string | null;
      inspectionIntervalMonths?: number | null;
    }>
  >([]);
  const { isVehicleDialogOpen: open, setVehicleDialogOpen: setOpen } = useUiStore();
  const [form, setForm] = useState<{
    name: string;
    make: string;
    model: string;
    year: string;
    licensePlate: string;
    inspectionDueDate: string;
    inspectionIntervalMonths: string;
  }>({
    name: '',
    make: '',
    model: '',
    year: '',
    licensePlate: '',
    inspectionDueDate: '',
    inspectionIntervalMonths: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const {
    data: vehiclesData,
    isLoading: isVehiclesLoading,
    refetch: refetchVehicles,
  } = useVehicles(status === 'authenticated' || isDemo);

  const isVehiclesPending = isVehiclesLoading;

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
      <PageHeader
        title="Car Expenses"
        icon={<Car className="w-6 h-6" />}
        backHref="/dashboard"
        backLabel="Back to dashboard"
      />

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="!p-4 sm:!p-6">
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
            <div className="mt-6 space-y-3" aria-busy={isVehiclesPending}>
              {isVehiclesPending && <VehicleListSkeleton rows={3} />}
              {!isVehiclesPending && vehicles.length === 0 && (
                <div className="text-gray-600 text-sm">No vehicles yet.</div>
              )}
              {!isVehiclesPending && vehicles.length > 0 && (
                <ul className="divide-y">
                  {vehicles.map(v => (
                    <li key={v.id}>
                      <Link
                        href={`/car/${v.id}`}
                        className="flex items-center justify-between py-3 px-2 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{v.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {[v.make, v.model, v.year ?? ''].filter(Boolean).join(' ')}
                          </div>
                          {v.licensePlate ? (
                            <div className="mt-1">
                              <span className="inline-block rounded-md border bg-white px-2 py-0.5 text-[10px] tracking-widest [letter-spacing:.12em]">
                                {v.licensePlate.toUpperCase()}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const inspStatus = computeInspectionStatus({
                              inspectionDueDate: v.inspectionDueDate
                                ? new Date(v.inspectionDueDate)
                                : null,
                              lastInspectionDate: null,
                              inspectionIntervalMonths: v.inspectionIntervalMonths ?? null,
                            });
                            return inspStatus.dueDate ? (
                              <span
                                className={
                                  'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ' +
                                  (inspStatus.state === 'overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : inspStatus.state === 'dueSoon'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-gray-100 text-gray-700')
                                }
                              >
                                {inspStatus.state === 'overdue'
                                  ? `-${Math.abs(inspStatus.daysRemaining || 0)}d`
                                  : `${inspStatus.daysRemaining}d`}
                              </span>
                            ) : null;
                          })()}
                          <span className="text-sm text-blue-600">Open</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

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
                    licensePlate: form.licensePlate || undefined,
                    inspectionDueDate: form.inspectionDueDate || undefined,
                    inspectionIntervalMonths: form.inspectionIntervalMonths
                      ? parseInt(form.inspectionIntervalMonths, 10)
                      : undefined,
                  });
                  setOpen(false);
                  setForm({
                    name: '',
                    make: '',
                    model: '',
                    year: '',
                    licensePlate: '',
                    inspectionDueDate: '',
                    inspectionIntervalMonths: '',
                  });
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
                <label className="flex flex-col gap-1">
                  <span className="text-sm">License plate</span>
                  <input
                    className="border rounded-md px-3 py-2 uppercase"
                    maxLength={16}
                    value={form.licensePlate}
                    onChange={e => setForm(f => ({ ...f, licensePlate: e.target.value }))}
                    placeholder="ABC-123"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Inspection due date</span>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2"
                    value={form.inspectionDueDate}
                    onChange={e => setForm(f => ({ ...f, inspectionDueDate: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Inspection interval (months)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="60"
                    className="border rounded-md px-3 py-2"
                    value={form.inspectionIntervalMonths}
                    onChange={e =>
                      setForm(f => ({ ...f, inspectionIntervalMonths: e.target.value }))
                    }
                    placeholder="12"
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
