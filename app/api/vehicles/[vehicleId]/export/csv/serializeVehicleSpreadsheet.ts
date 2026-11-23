import type { Expense, FuelFillUp, TireChangeLog, TireSet, Vehicle } from '@/generated/prisma';
import { decimalToNumber } from '@/lib/prisma/decimal';
import { calculateTireMileage } from '@/lib/tires';
import { escapeSpreadsheetField } from './escapeSpreadsheetField';

type SpreadsheetRecords = {
  vehicle: Pick<
    Vehicle,
    | 'id'
    | 'name'
    | 'make'
    | 'model'
    | 'year'
    | 'licensePlate'
    | 'inspectionDueDate'
    | 'inspectionIntervalMonths'
    | 'initialOdometer'
  >;
  fillUps: readonly Pick<
    FuelFillUp,
    'id' | 'date' | 'odometerKm' | 'liters' | 'pricePerLiter' | 'totalCost' | 'isFull' | 'notes'
  >[];
  expenses: readonly Pick<
    Expense,
    | 'id'
    | 'date'
    | 'odometerKm'
    | 'amount'
    | 'category'
    | 'vendor'
    | 'liters'
    | 'oilConsumption'
    | 'notes'
  >[];
  tireSets: readonly Pick<
    TireSet,
    | 'id'
    | 'name'
    | 'type'
    | 'status'
    | 'totalKm'
    | 'purchaseDate'
    | 'notes'
    | 'createdAt'
    | 'updatedAt'
  >[];
  changeLogs: readonly Pick<
    TireChangeLog,
    'id' | 'tireSetId' | 'date' | 'odometerKm' | 'odometerConfirmed' | 'notes' | 'createdAt'
  >[];
};

function optionalText(value: string | null) {
  return value ? escapeSpreadsheetField(value) : '';
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? '';
}

export function serializeVehicleSpreadsheet({
  vehicle,
  fillUps,
  expenses,
  tireSets,
  changeLogs,
}: SpreadsheetRecords): string {
  const lines: string[] = [];
  const writeRow = (...fields: (string | number)[]) => lines.push(fields.join(','));
  const startSection = (name: string, columns: string) => {
    if (lines.length > 0) lines.push('');
    lines.push(`Section: ${name}`, columns);
  };

  startSection(
    'VEHICLE',
    'Id,Name,Make,Model,Year,LicensePlate,InspectionDueDate,InspectionIntervalMonths,InitialOdometer'
  );
  writeRow(
    vehicle.id,
    escapeSpreadsheetField(vehicle.name),
    optionalText(vehicle.make),
    optionalText(vehicle.model),
    vehicle.year ?? '',
    optionalText(vehicle.licensePlate),
    dateOnly(vehicle.inspectionDueDate),
    vehicle.inspectionIntervalMonths ?? '',
    vehicle.initialOdometer ?? ''
  );

  startSection('FILLUPS', 'Id,Date,OdometerKm,Liters,PricePerLiter,TotalCost,IsFull,Notes');
  for (const fillUp of fillUps) {
    writeRow(
      fillUp.id,
      dateOnly(fillUp.date),
      fillUp.odometerKm,
      decimalToNumber(fillUp.liters).toFixed(2),
      decimalToNumber(fillUp.pricePerLiter).toFixed(3),
      decimalToNumber(fillUp.totalCost).toFixed(2),
      fillUp.isFull ? '1' : '0',
      optionalText(fillUp.notes)
    );
  }

  startSection('EXPENSES', 'Id,Date,Km,Amount,Category,Vendor,Liters,OilConsumption,Notes');
  for (const expense of expenses) {
    writeRow(
      expense.id,
      dateOnly(expense.date),
      expense.odometerKm ?? '',
      decimalToNumber(expense.amount).toFixed(2),
      expense.category,
      optionalText(expense.vendor),
      expense.liters != null ? decimalToNumber(expense.liters).toFixed(2) : '',
      expense.oilConsumption != null ? decimalToNumber(expense.oilConsumption).toFixed(2) : '',
      optionalText(expense.notes)
    );
  }

  const { bySet } = calculateTireMileage(
    changeLogs.map(change => ({
      id: change.id,
      tireSetId: change.tireSetId,
      date: change.date.toISOString(),
      createdAt: change.createdAt.toISOString(),
      odometerKm: change.odometerKm,
      odometerConfirmed: change.odometerConfirmed,
    }))
  );
  startSection(
    'TIRE_SETS',
    'Id,Name,Type,Status,PreviousTrackedKm,ConfirmedKm,PurchaseDate,Notes,CreatedAt,UpdatedAt'
  );
  for (const set of tireSets) {
    writeRow(
      set.id,
      escapeSpreadsheetField(set.name),
      set.type,
      set.status,
      set.totalKm,
      bySet.get(set.id)?.confirmedKm ?? '',
      dateOnly(set.purchaseDate),
      optionalText(set.notes),
      set.createdAt.toISOString(),
      set.updatedAt.toISOString()
    );
  }

  startSection('CHANGE_LOGS', 'Id,TireSetId,Date,OdometerKm,Notes,CreatedAt,OdometerConfirmed');
  for (const change of changeLogs) {
    writeRow(
      change.id,
      change.tireSetId,
      dateOnly(change.date),
      change.odometerKm ?? '',
      optionalText(change.notes),
      change.createdAt.toISOString(),
      change.odometerConfirmed ? '1' : '0'
    );
  }

  return `\uFEFF${lines.join('\r\n')}`;
}
