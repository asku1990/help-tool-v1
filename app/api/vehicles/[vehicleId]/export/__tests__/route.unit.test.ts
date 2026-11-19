// @vitest-environment node
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { Prisma } from '@/generated/prisma';
import prisma from '@/lib/db';
import { parseBackupCsv } from '@/utils/csv';
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
      notes: '  ＝Example',
      createdAt: date,
    },
  ]);
});

describe('vehicle export', () => {
  it('offers a separate spreadsheet CSV that neutralizes formula-like text, not numbers', async () => {
    const response = await request('?format=spreadsheet');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(/filename="spreadsheet_.*\.csv"/);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const csv = await response.text();
    expect(csv).toContain('vehicle-1,"Text: =Example","Text: +Example","Plain model",2020');
    expect(csv).toContain('fill-up-1,2026-01-15,100,40.00,1.500,60.00,1,"Text: -Example"');
    expect(csv).toContain(
      'expense-1,2026-01-15,-1,123.45,OTHER,"Text:   @Example",,,"note, with ""quotes""; and\nnew line"'
    );
    expect(csv).toContain(`tire-1,"Text: \tSummer",SUMMER,STORED,0,,"Text: '=Example"`);
    expect(csv).toContain('log-1,tire-1,2026-01-15,0,"Text:   ＝Example"');
    expect(parseBackupCsv(csv)).toEqual({
      fillUps: [],
      expenses: [],
      tireSets: [],
      changeLogs: [],
    });
  });

  it('keeps download backup compatible with restore and preserves original text', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(/filename="backup_.*\.csv"/);
    const csv = await response.text();
    expect(csv).toContain('vehicle-1;=Example;+Example;Plain model;2020;ABC-123;;;0');
    expect(csv).toContain(';OTHER;  @Example;;;"note, with ""quotes""; and\nnew line"');
    const backup = parseBackupCsv(csv);
    expect(backup.vehicle?.name).toBe('=Example');
    expect(backup.fillUps[0]?.notes).toBe('-Example');
    expect(backup.expenses[0]?.notes).toBe('note, with "quotes"; and\nnew line');
    expect(backup.tireSets[0]?.notes).toBe("'=Example");
  });

  it('requires access to the vehicle for the spreadsheet download', async () => {
    vi.mocked(prisma.vehicleAccess.findFirst).mockResolvedValueOnce(null);
    expect((await request('?format=spreadsheet')).status).toBe(404);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });
});
