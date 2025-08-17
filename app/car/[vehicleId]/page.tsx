'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import FillUpForm from '@/components/car/FillUpForm';
import ExpenseForm from '@/components/car/ExpenseForm';
import CostSummary from '@/components/car/CostSummary';
import FillUpList from '@/components/car/FillUpList';
import ExpenseList from '@/components/car/ExpenseList';
import ConsumptionBadges from '@/components/car/ConsumptionBadges';
import ConsumptionChart from '@/components/car/ConsumptionChart';
import LicensePlate from '@/components/car/LicensePlate';
import InspectionBadge from '@/components/car/InspectionBadge';
import { useExpenses, useFillUps, useVehicle, useVehicles, useUpdateVehicle } from '@/hooks';
import { pickLastInspectionDateFromExpenses, computeInspectionStatus } from '@/utils/inspection';
import { useUiStore } from '@/stores/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function VehiclePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const vehicleId = Array.isArray(params?.vehicleId)
    ? params?.vehicleId[0]
    : (params?.vehicleId as string | undefined);

  const [isDemo] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return (
      document.cookie
        .split('; ')
        .find(c => c.startsWith('demo='))
        ?.split('=')[1] === '1'
    );
  });

  // Server state via TanStack Query, derived locally with useMemo (no duplication to local state)
  const vehicleQuery = useVehicle(vehicleId);
  const vehicleName = useMemo(() => vehicleQuery.data?.vehicle?.name || '', [vehicleQuery.data]);
  const licensePlate = useMemo(
    () => vehicleQuery.data?.vehicle?.licensePlate || null,
    [vehicleQuery.data]
  );
  const inspectionDueDate = useMemo(
    () => vehicleQuery.data?.vehicle?.inspectionDueDate || null,
    [vehicleQuery.data]
  );
  const inspectionIntervalMonths = useMemo(
    () => vehicleQuery.data?.vehicle?.inspectionIntervalMonths ?? null,
    [vehicleQuery.data]
  );
  const { data: vehiclesData } = useVehicles(true);
  const vehicles = vehiclesData?.vehicles || [];
  const { setFillUpDialogOpen, setExpenseDialogOpen } = useUiStore();
  const updateVehicleMutation = useUpdateVehicle(vehicleId || '');
  const [isEditOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    make: '',
    model: '',
    year: '',
    licensePlate: '',
    inspectionDueDate: '',
    inspectionIntervalMonths: '',
  });

  useEffect(() => {
    const v = vehicleQuery.data?.vehicle;
    if (v) {
      setEditForm({
        name: v.name || '',
        make: v.make || '',
        model: v.model || '',
        year: v.year ? String(v.year) : '',
        licensePlate: v.licensePlate || '',
        inspectionDueDate: v.inspectionDueDate ? v.inspectionDueDate.slice(0, 10) : '',
        inspectionIntervalMonths: v.inspectionIntervalMonths
          ? String(v.inspectionIntervalMonths)
          : '',
      });
    }
  }, [vehicleQuery.data]);

  const fillUpsQuery = useFillUps(vehicleId || '');
  const fillUps = useMemo(
    () =>
      (fillUpsQuery.data?.fillUps || []) as Array<{
        date: string;
        odometerKm: number;
        liters: number;
        pricePerLiter: number;
        totalCost: number;
        isFull: boolean;
      }>,
    [fillUpsQuery.data]
  );
  const segments = useMemo(() => buildSegments(fillUps), [fillUps]);

  const expensesQuery = useExpenses(vehicleId || '');
  const expenses = useMemo(
    () =>
      (expensesQuery.data?.expenses || []) as Array<{
        id: string;
        date: string;
        category: 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'OTHER';
        amount: number;
        vendor?: string | null;
        notes?: string | null;
      }>,
    [expensesQuery.data]
  );
  const lastInspectionDate = useMemo(
    () => pickLastInspectionDateFromExpenses(expenses),
    [expenses]
  );

  const inspectionStatus = useMemo(
    () =>
      computeInspectionStatus({
        inspectionDueDate: inspectionDueDate ? new Date(inspectionDueDate) : null,
        lastInspectionDate,
        inspectionIntervalMonths: inspectionIntervalMonths ?? null,
      }),
    [inspectionDueDate, lastInspectionDate, inspectionIntervalMonths]
  );

  useEffect(() => {
    if (status === 'unauthenticated' && !isDemo) {
      router.replace('/');
    }
  }, [status, isDemo, router]);

  // Redirect handling remains effectful

  if (status === 'unauthenticated' && !isDemo) {
    return null;
  }

  if (status === 'loading' && !isDemo) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <PageHeader
        title={vehicleName || `Vehicle ${vehicleId}`}
        backHref="/car"
        backLabel="Back to vehicles"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setFillUpDialogOpen(true)}>
            Add fill-up
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExpenseDialogOpen(true)}>
            Add expense
          </Button>
          <label htmlFor="vehicle-switcher" className="sr-only">
            Select vehicle
          </label>
          <select
            id="vehicle-switcher"
            className="border rounded-md px-2 py-1 text-sm"
            value={vehicleId || ''}
            onChange={e => router.push(`/car/${e.target.value}`)}
            aria-label="Select vehicle"
          >
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <Card className="mb-6">
          <CardContent className="!p-4 sm:!p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">
                  {vehicleName || `Vehicle ${vehicleId}`}
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <LicensePlate value={licensePlate} />
                  <InspectionBadge
                    inspectionDueDate={inspectionDueDate}
                    lastInspectionDate={lastInspectionDate?.toISOString() || null}
                    inspectionIntervalMonths={inspectionIntervalMonths}
                  />
                  {inspectionStatus.dueDate ? (
                    <span
                      className={
                        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ' +
                        (inspectionStatus.state === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : inspectionStatus.state === 'dueSoon'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700')
                      }
                    >
                      {inspectionStatus.state === 'overdue'
                        ? `Overdue by ${Math.abs(inspectionStatus.daysRemaining || 0)}d`
                        : `In ${inspectionStatus.daysRemaining}d`}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="text-sm px-3 py-1.5 rounded border"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </button>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <ConsumptionBadges segments={segments} />
            <ConsumptionChart
              segments={segments.map(s => ({ date: s.date, lPer100: s.lPer100 }))}
            />
            <CostSummary
              costPerKmLifetime={computeCostPerKmLifetime(segments, expenses)}
              costPerKm90d={computeCostPerKm90d(segments, expenses)}
              spendMTD={computeSpendMTD(fillUps, expenses)}
              spend30d={computeSpend30d(fillUps, expenses)}
              breakdown90d={computeBreakdown90d(fillUps, expenses)}
            />
          </div>
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardContent className="!p-4 sm:!p-6">
                <h2 className="text-lg font-semibold mb-4">Fill-ups</h2>
                <div className="mb-4">
                  {vehicleId ? (
                    <FillUpForm vehicleId={vehicleId} />
                  ) : (
                    <Button disabled>Add fill-up</Button>
                  )}
                </div>
                {vehicleId ? <FillUpList vehicleId={vehicleId} /> : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="!p-4 sm:!p-6">
                <h2 className="text-lg font-semibold mb-4">Expenses</h2>
                <div className="mb-4">
                  {vehicleId ? (
                    <ExpenseForm vehicleId={vehicleId} />
                  ) : (
                    <Button variant="outline" disabled>
                      Add expense
                    </Button>
                  )}
                </div>
                {vehicleId ? <ExpenseList vehicleId={vehicleId} /> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Dialog open={isEditOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-label="Edit vehicle dialog">
          <DialogHeader>
            <DialogTitle>Edit vehicle</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async e => {
              e.preventDefault();
              await updateVehicleMutation.mutateAsync({
                name: editForm.name || undefined,
                make: editForm.make || undefined,
                model: editForm.model || undefined,
                year: editForm.year ? parseInt(editForm.year, 10) : undefined,
                licensePlate: editForm.licensePlate || null,
                inspectionDueDate: editForm.inspectionDueDate || null,
                inspectionIntervalMonths: editForm.inspectionIntervalMonths
                  ? parseInt(editForm.inspectionIntervalMonths, 10)
                  : null,
              });
              setEditOpen(false);
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-sm">Name</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Make</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={editForm.make}
                  onChange={e => setEditForm(f => ({ ...f, make: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Model</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={editForm.model}
                  onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Year</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1900"
                  className="border rounded-md px-3 py-2"
                  value={editForm.year}
                  onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">License plate</span>
                <input
                  className="border rounded-md px-3 py-2 uppercase"
                  maxLength={16}
                  value={editForm.licensePlate}
                  onChange={e => setEditForm(f => ({ ...f, licensePlate: e.target.value }))}
                  placeholder="ABC-123"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Inspection due date</span>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2"
                  value={editForm.inspectionDueDate}
                  onChange={e => setEditForm(f => ({ ...f, inspectionDueDate: e.target.value }))}
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
                  value={editForm.inspectionIntervalMonths}
                  onChange={e =>
                    setEditForm(f => ({ ...f, inspectionIntervalMonths: e.target.value }))
                  }
                  placeholder="12"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                className="text-sm px-3 py-1.5 rounded border"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded border bg-blue-600 text-white border-blue-600"
                disabled={updateVehicleMutation.isPending}
              >
                {updateVehicleMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildSegments(
  fillUps: Array<{
    date: string;
    odometerKm: number;
    liters: number;
    pricePerLiter: number;
    totalCost: number;
    isFull: boolean;
  }>
) {
  const asc = [...fillUps].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const segments: Array<{
    date: string;
    distanceKm: number;
    litersUsed: number;
    lPer100: number;
    fuelCost: number;
    costPer100: number;
  }> = [];
  let lastFullIndex = -1;
  for (let i = 0; i < asc.length; i++) {
    if (!asc[i].isFull) continue;
    if (lastFullIndex >= 0) {
      const prev = asc[lastFullIndex];
      const curr = asc[i];
      const distanceKm = curr.odometerKm - prev.odometerKm;
      if (distanceKm > 0) {
        const slice = asc.slice(lastFullIndex + 1, i + 1);
        const litersUsed = slice.reduce((s, f) => s + f.liters, 0);
        const fuelCost = slice.reduce((s, f) => s + f.totalCost, 0);
        const lPer100 = (litersUsed / distanceKm) * 100;
        const costPer100 = (fuelCost / distanceKm) * 100;
        segments.push({ date: curr.date, distanceKm, litersUsed, lPer100, fuelCost, costPer100 });
      }
    }
    lastFullIndex = i;
  }
  return segments;
}

function computeCostPerKmLifetime(
  segments: Array<{ distanceKm: number; fuelCost: number }>,
  expenses: Array<{ date: string; category: string; amount: number }>
) {
  const distance = segments.reduce((s, seg) => s + seg.distanceKm, 0);
  if (distance <= 0) return NaN;
  const fuelCost = segments.reduce((s, seg) => s + seg.fuelCost, 0);
  const nonFuel = expenses.filter(e => e.category !== 'FUEL').reduce((s, e) => s + e.amount, 0);
  return (fuelCost + nonFuel) / distance;
}

function computeCostPerKm90d(
  segments: Array<{ date: string; distanceKm: number; fuelCost: number }>,
  expenses: Array<{ date: string; category: string; amount: number }>
) {
  const now = new Date();
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const segs = segments.filter(s => new Date(s.date) >= d90);
  const distance = segs.reduce((s, seg) => s + seg.distanceKm, 0);
  if (distance <= 0) return NaN;
  const fuelCost = segs.reduce((s, seg) => s + seg.fuelCost, 0);
  const nonFuel = expenses
    .filter(e => e.category !== 'FUEL' && new Date(e.date) >= d90)
    .reduce((s, e) => s + e.amount, 0);
  return (fuelCost + nonFuel) / distance;
}

function computeSpendMTD(
  fillUps: Array<{ date: string; totalCost: number }>,
  expenses: Array<{ date: string; amount: number }>
) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fuel = fillUps
    .filter(f => new Date(f.date) >= monthStart)
    .reduce((s, f) => s + f.totalCost, 0);
  const other = expenses
    .filter(e => new Date(e.date) >= monthStart)
    .reduce((s, e) => s + e.amount, 0);
  return fuel + other;
}

function computeSpend30d(
  fillUps: Array<{ date: string; totalCost: number }>,
  expenses: Array<{ date: string; amount: number }>
) {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fuel = fillUps.filter(f => new Date(f.date) >= d30).reduce((s, f) => s + f.totalCost, 0);
  const other = expenses.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.amount, 0);
  return fuel + other;
}

function computeBreakdown90d(
  fillUps: Array<{ date: string; totalCost: number }>,
  expenses: Array<{ date: string; category: string; amount: number }>
) {
  const now = new Date();
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const fuel = fillUps.filter(f => new Date(f.date) >= d90).reduce((s, f) => s + f.totalCost, 0);
  const maintenance = expenses
    .filter(e => e.category === 'MAINTENANCE' && new Date(e.date) >= d90)
    .reduce((s, e) => s + e.amount, 0);
  const other = expenses
    .filter(e => e.category !== 'MAINTENANCE' && e.category !== 'FUEL' && new Date(e.date) >= d90)
    .reduce((s, e) => s + e.amount, 0);
  return [
    { label: 'Fuel' as const, amount: fuel },
    { label: 'Maintenance' as const, amount: maintenance },
    { label: 'Other' as const, amount: other },
  ];
}
