// @vitest-environment node
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { Prisma } from '@/generated/prisma';
import prisma from '@/lib/db';
import { GET } from '../route';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  default: {
    vehicleAccess: { findFirst: vi.fn() },
    fuelFillUp: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    tireSet: { findMany: vi.fn() },
    tireChangeLog: { findMany: vi.fn() },
  },
}));

const date = new Date('2026-01-15T00:00:00.000Z');
const vehicleId = 'vehicle-1';
const request = (format = '') =>
  GET(new NextRequest(`http://localhost/api/vehicles/${vehicleId}/export${format}`), {
    params: Promise.resolve({ vehicleId }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({
    user: { id: 'reader-1', email: 'reader@example.test' },
    expires: '2026-12-01T00:00:00.000Z',
  });
  const access = {
    id: 'access-1',
    vehicleId,
    userId: 'reader-1',
    role: 'VIEWER' as const,
    createdAt: date,
    vehicle: {
      id: vehicleId,
      userId: 'owner-1',
      name: '=Example',
      make: '+Example',
      model: 'Plain model',
      year: 2020,
      licensePlate: 'ABC-123',
      inspectionDueDate: null,
      inspectionIntervalMonths: null,
      initialOdometer: 0,
      createdAt: date,
      updatedAt: date,
    },
  };
  vi.mocked(prisma.vehicleAccess.findFirst).mockResolvedValue(access);
  vi.mocked(prisma.fuelFillUp.findMany).mockResolvedValue([
    {
      id: 'fill-up-1',
      vehicleId,
      date,
      odometerKm: 100,
      liters: new Prisma.Decimal(40),
      pricePerLiter: new Prisma.Decimal(1.5),
      totalCost: new Prisma.Decimal(60),
      isFull: true,
      notes: '-Example',
    },
  ]);
  vi.mocked(prisma.expense.findMany).mockResolvedValue([
    {
      id: 'expense-1',
      vehicleId,
      date,
      amount: new Prisma.Decimal(123.45),
      category: 'OTHER',
      vendor: '  @Example',
      odometerKm: -1,
      notes: 'note, with "quotes"; and\nnew line',
      liters: null,
      oilConsumption: null,
    },
  ]);
  vi.mocked(prisma.tireSet.findMany).mockResolvedValue([
    {
      id: 'tire-1',
      vehicleId,
      name: '\tSummer',
      type: 'SUMMER',
      status: 'STORED',
      totalKm: 0,
      purchaseDate: null,
      notes: "'=Example",
      createdAt: date,
      updatedAt: date,
    },
  ]);
  vi.mocked(prisma.tireChangeLog.findMany).mockResolvedValue([
    {
      id: 'log-1',
      vehicleId,
      tireSetId: 'tire-1',
      date,
      odometerKm: 0,
      odometerConfirmed: true,
      notes: '  ＝Example',
      createdAt: date,
    },
    {
      id: 'log-2',
      vehicleId,
      tireSetId: 'tire-1',
      date,
      odometerKm: null,
      odometerConfirmed: false,
      notes: null,
      createdAt: date,
    },
  ]);
});

describe('vehicle export', () => {
  it('downloads spreadsheet CSV by default and neutralizes formula-like text, not numbers', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(/filename="spreadsheet_.*\.csv"/);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const csv = await response.text();
    expect(csv).toContain('vehicle-1,"Text: =Example","Text: +Example","Plain model",2020');
    expect(csv).toContain('fill-up-1,2026-01-15,100,40.00,1.500,60.00,1,"Text: -Example"');
    expect(csv).toContain(
      'expense-1,2026-01-15,-1,123.45,OTHER,"Text:   @Example",,,"note, with ""quotes""; and\nnew line"'
    );
    expect(csv).toContain(`tire-1,"Text: \tSummer",SUMMER,STORED,0,,,"Text: '=Example"`);
    expect(csv).toContain('log-1,tire-1,2026-01-15,0,"Text:   ＝Example"');
    expect(csv).toContain('log-2,tire-1,2026-01-15,,');
    expect(csv).toContain('Section: CHANGE_LOGS\r\n');
  });

  it.each([0, 5000])(
    'exports %i confirmed km separately from the previous tracked total',
    async confirmedKm => {
      const set = {
        id: 'tire-1',
        vehicleId,
        name: 'Summer tires',
        type: 'SUMMER',
        status: 'STORED',
        totalKm: 8000,
        purchaseDate: null,
        notes: null,
        createdAt: date,
        updatedAt: date,
      } as const;
      vi.mocked(prisma.tireSet.findMany).mockResolvedValueOnce([
        set,
        { ...set, id: 'tire-2', name: 'Winter tires', status: 'ACTIVE', totalKm: 0 },
      ]);
      vi.mocked(prisma.tireChangeLog.findMany).mockResolvedValueOnce([
        {
          id: 'swap',
          vehicleId,
          tireSetId: 'tire-2',
          date: new Date('2026-01-20'),
          odometerKm: 10000 + confirmedKm,
          odometerConfirmed: true,
          notes: null,
          createdAt: date,
        },
        {
          id: 'mount',
          vehicleId,
          tireSetId: 'tire-1',
          date,
          odometerKm: 10000,
          odometerConfirmed: true,
          notes: null,
          createdAt: date,
        },
      ]);

      const csv = await (await request()).text();
      expect(csv).toContain('Status,PreviousTrackedKm,ConfirmedKm,PurchaseDate');
      expect(csv).toContain(`tire-1,"Summer tires",SUMMER,STORED,8000,${confirmedKm},`);
      expect(csv).toContain('tire-2,"Winter tires",SUMMER,ACTIVE,0,,,');
    }
  );

  it('no longer serves a backup format even if the old format is requested', async () => {
    const response = await request('?format=backup');
    expect(response.headers.get('content-disposition')).toMatch(/filename="spreadsheet_.*\.csv"/);
    expect(await response.text()).toContain('Section: VEHICLE');
  });

  it('requires access to the vehicle for the spreadsheet download', async () => {
    vi.mocked(prisma.vehicleAccess.findFirst).mockResolvedValueOnce(null);
    expect((await request()).status).toBe(404);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });
});
