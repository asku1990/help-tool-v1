'use client';

import Link from 'next/link';
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
import { useExpenses, useFillUps, useVehicle, useVehicles } from '@/hooks';
import { useUiStore } from '@/stores/ui';

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
  const { data: vehiclesData } = useVehicles(true);
  const vehicles = vehiclesData?.vehicles || [];
  const { setFillUpDialogOpen, setExpenseDialogOpen } = useUiStore();

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
      }>,
    [expensesQuery.data]
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
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold truncate">
            {vehicleName || `Vehicle ${vehicleId}`}
          </h1>
          <Link href="/car" className="text-sm text-blue-600 hover:underline">
            Back to vehicles
          </Link>
        </div>
      </header>

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
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">Fill-ups</h2>
              <div className="mb-4">
                {vehicleId ? (
                  <FillUpForm vehicleId={vehicleId} />
                ) : (
                  <Button disabled>Add fill-up</Button>
                )}
              </div>
              {vehicleId ? <FillUpList vehicleId={vehicleId} /> : null}
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border">
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
            </section>
          </div>
        </div>
      </main>
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
