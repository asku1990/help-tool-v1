// Cookie-only public demo; no env toggle required
export const demoEnabled = true;

export function isDemoClient(): boolean {
  if (!demoEnabled) return false;
  if (typeof document === 'undefined') return false;
  const cookie = document.cookie
    .split('; ')
    .find(c => c.startsWith('demo='))
    ?.split('=')[1];
  return cookie === '1';
}

export type DemoVehicle = {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
};

export const demoVehicles: DemoVehicle[] = [
  { id: 'demo-1', name: 'Toyota Corolla', make: 'Toyota', model: 'Corolla', year: 2015 },
  { id: 'demo-2', name: 'Tesla Model 3', make: 'Tesla', model: 'Model 3', year: 2021 },
];

export function getDemoVehicleById(vehicleId: string | undefined): DemoVehicle | undefined {
  if (!vehicleId) return undefined;
  return demoVehicles.find(v => v.id === vehicleId);
}

export type DemoFillUp = {
  id: string;
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  isFull: boolean;
  notes?: string;
};

export type DemoExpense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  vendor?: string;
  odometerKm?: number;
  notes?: string;
};

export const demoFillUpsByVehicleId: Record<string, DemoFillUp[]> = {
  'demo-1': [
    {
      id: 'f1',
      date: '2025-07-01',
      odometerKm: 85000,
      liters: 40.2,
      pricePerLiter: 1.45,
      totalCost: 58.29,
      isFull: true,
      notes: 'Highway trip',
    },
  ],
  'demo-2': [
    {
      id: 'f2',
      date: '2025-07-15',
      odometerKm: 12000,
      liters: 20.0,
      pricePerLiter: 0.25,
      totalCost: 5.0,
      isFull: true,
      notes: 'Supercharger equivalent (mock)',
    },
  ],
};

export const demoExpensesByVehicleId: Record<string, DemoExpense[]> = {
  'demo-1': [
    {
      id: 'e1',
      date: '2025-06-20',
      category: 'MAINTENANCE',
      amount: 120.0,
      vendor: 'OilChange Co.',
    },
  ],
  'demo-2': [
    { id: 'e2', date: '2025-07-05', category: 'INSURANCE', amount: 65.5, vendor: 'SafeInsure' },
  ],
};
