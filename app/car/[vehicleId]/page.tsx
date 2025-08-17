'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import FillUpForm from '@/components/car/FillUpForm';
import ExpenseForm from '@/components/car/ExpenseForm';
import CostSummary from '@/components/car/CostSummary';
import FillUpList from '@/components/car/FillUpList';
import ExpenseList from '@/components/car/ExpenseList';
import ConsumptionBadges from '@/components/car/ConsumptionBadges';
import ConsumptionChart from '@/components/car/ConsumptionChart';

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

  const [refreshKey, setRefreshKey] = useState(0);
  const [vehicleName, setVehicleName] = useState<string>('');
  const [segments, setSegments] = useState<
    Array<{
      date: string;
      distanceKm: number;
      litersUsed: number;
      lPer100: number;
      fuelCost: number;
      costPer100: number;
    }>
  >([]);
  const [fillUps, setFillUps] = useState<
    Array<{
      date: string;
      odometerKm: number;
      liters: number;
      pricePerLiter: number;
      totalCost: number;
      isFull: boolean;
    }>
  >([]);
  const [expenses, setExpenses] = useState<
    Array<{
      id: string;
      date: string;
      category: 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'OTHER';
      amount: number;
    }>
  >([]);

  useEffect(() => {
    if (status === 'unauthenticated' && !isDemo) {
      router.replace('/');
    }
  }, [status, isDemo, router]);

  useEffect(() => {
    async function loadVehicle() {
      if (!vehicleId) return;
      const res = await fetch(`/api/vehicles/${vehicleId}`);
      if (!res.ok) return;
      const json = await res.json();
      setVehicleName(json.data?.vehicle?.name || '');
    }
    loadVehicle();
  }, [vehicleId]);

  useEffect(() => {
    async function loadFillUps() {
      if (!vehicleId) return;
      const res = await fetch(`/api/vehicles/${vehicleId}/fillups`);
      if (!res.ok) return;
      const json = await res.json();
      const fillUpsList = (json.data?.fillUps || []) as Array<{
        date: string;
        odometerKm: number;
        liters: number;
        pricePerLiter: number;
        totalCost: number;
        isFull: boolean;
      }>;
      setFillUps(fillUpsList);
      const segs = buildSegments(fillUpsList);
      setSegments(segs);
    }
    loadFillUps();
  }, [vehicleId, refreshKey]);

  useEffect(() => {
    async function loadExpenses() {
      if (!vehicleId) return;
      const res = await fetch(`/api/vehicles/${vehicleId}/expenses`);
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.data?.expenses || []) as Array<{
        id: string;
        date: string;
        category: 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'OTHER';
        amount: number;
      }>;
      setExpenses(list);
    }
    loadExpenses();
  }, [vehicleId, refreshKey]);

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
          <h1 className="text-2xl font-bold">{vehicleName || `Vehicle ${vehicleId}`}</h1>
          <Link href="/car" className="text-sm text-blue-600 hover:underline">
            Back to vehicles
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
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
                  <FillUpForm vehicleId={vehicleId} onCreated={() => setRefreshKey(k => k + 1)} />
                ) : (
                  <Button disabled>Add fill-up</Button>
                )}
              </div>
              {vehicleId ? <FillUpList vehicleId={vehicleId} refreshKey={refreshKey} /> : null}
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">Expenses</h2>
              <div className="mb-4">
                {vehicleId ? (
                  <ExpenseForm vehicleId={vehicleId} onCreated={() => setRefreshKey(k => k + 1)} />
                ) : (
                  <Button variant="outline" disabled>
                    Add expense
                  </Button>
                )}
              </div>
              {vehicleId ? <ExpenseList vehicleId={vehicleId} refreshKey={refreshKey} /> : null}
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
