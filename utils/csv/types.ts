import type { TireType, TireStatus } from '@/queries/tires';
import type { ExpenseDto } from '@/queries/expenses';

export type ParsedVehicle = {
  id?: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  inspectionDueDate?: string;
  inspectionIntervalMonths?: number;
  initialOdometer?: number;
  valid: boolean;
};

export type ParsedFillUp = {
  id: string;
  include: boolean;
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  isFull: boolean;
  notes?: string;
  valid: boolean;
};

export type ParsedExpense = {
  id: string;
  include: boolean;
  date: string;
  odometerKm?: number;
  amount: number;
  category: ExpenseDto['category'];
  vendor?: string;
  liters?: number;
  oilConsumption?: number;
  notes?: string;
  valid: boolean;
};

export type ParsedTireSet = {
  id: string;
  include: boolean;
  exportId?: string;
  name: string;
  type: TireType;
  status?: TireStatus;
  purchaseDate?: string;
  notes?: string;
  valid: boolean;
};

export type ParsedChangeLog = {
  id: string;
  include: boolean;
  tireSetId: string;
  date: string;
  odometerKm: number;
  notes?: string;
  valid: boolean;
};

export type ParsedBackupData = {
  vehicle?: ParsedVehicle;
  fillUps: ParsedFillUp[];
  expenses: ParsedExpense[];
  tireSets: ParsedTireSet[];
  changeLogs: ParsedChangeLog[];
};
