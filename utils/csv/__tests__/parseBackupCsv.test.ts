import { describe, it, expect } from 'vitest';
import { parseBackupCsv } from '../parseBackupCsv';

describe('parseBackupCsv', () => {
  it('returns empty data for empty input', () => {
    const result = parseBackupCsv('');
    expect(result.vehicle).toBeUndefined();
    expect(result.fillUps).toEqual([]);
    expect(result.expenses).toEqual([]);
    expect(result.tireSets).toEqual([]);
    expect(result.changeLogs).toEqual([]);
  });

  it('parses vehicle section', () => {
    const csv = `[VEHICLE]
Id;Name;Make;Model;Year;LicensePlate;InspectionDueDate;InspectionIntervalMonths;InitialOdometer
abc123;My Car;Toyota;Corolla;2020;ABC-123;2025-06-01;12;50000`;

    const result = parseBackupCsv(csv);
    expect(result.vehicle).toBeDefined();
    expect(result.vehicle?.name).toBe('My Car');
    expect(result.vehicle?.make).toBe('Toyota');
    expect(result.vehicle?.model).toBe('Corolla');
    expect(result.vehicle?.year).toBe(2020);
    expect(result.vehicle?.licensePlate).toBe('ABC-123');
    expect(result.vehicle?.inspectionDueDate).toBe('2025-06-01');
    expect(result.vehicle?.inspectionIntervalMonths).toBe(12);
    expect(result.vehicle?.initialOdometer).toBe(50000);
    expect(result.vehicle?.valid).toBe(true);
  });

  it('parses fillups section', () => {
    const csv = `[FILLUPS]
Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes
f1;2025-01-15;10000;45.5;1.65;75.08;1;Full tank`;

    const result = parseBackupCsv(csv);
    expect(result.fillUps).toHaveLength(1);
    expect(result.fillUps[0].date).toBe('2025-01-15');
    expect(result.fillUps[0].odometerKm).toBe(10000);
    expect(result.fillUps[0].liters).toBe(45.5);
    expect(result.fillUps[0].pricePerLiter).toBe(1.65);
    expect(result.fillUps[0].totalCost).toBe(75.08);
    expect(result.fillUps[0].isFull).toBe(true);
    expect(result.fillUps[0].notes).toBe('Full tank');
    expect(result.fillUps[0].valid).toBe(true);
  });

  it('parses expenses section', () => {
    const csv = `[EXPENSES]
Id;Date;Km;Amount;Category;Vendor;Liters;OilConsumption;Notes
e1;2025-02-01;12000;150.00;MAINTENANCE;AutoShop;;;Oil change`;

    const result = parseBackupCsv(csv);
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0].date).toBe('2025-02-01');
    expect(result.expenses[0].odometerKm).toBe(12000);
    expect(result.expenses[0].amount).toBe(150);
    expect(result.expenses[0].category).toBe('MAINTENANCE');
    expect(result.expenses[0].vendor).toBe('AutoShop');
    expect(result.expenses[0].notes).toBe('Oil change');
    expect(result.expenses[0].valid).toBe(true);
  });

  it('parses tire sets section', () => {
    const csv = `[TIRE_SETS]
Id;Name;Type;Status;TotalKm;PurchaseDate;Notes;CreatedAt;UpdatedAt
ts1;Summer Tires;SUMMER;ACTIVE;5000;2024-06-01;;2024-06-01T00:00:00Z;2024-06-01T00:00:00Z
ts2;Winter Tires;WINTER;STORED;3000;2024-11-01;;2024-11-01T00:00:00Z;2024-11-01T00:00:00Z`;

    const result = parseBackupCsv(csv);
    expect(result.tireSets).toHaveLength(2);
    expect(result.tireSets[0].name).toBe('Summer Tires');
    expect(result.tireSets[0].type).toBe('SUMMER');
    expect(result.tireSets[0].status).toBe('ACTIVE');
    expect(result.tireSets[0].exportId).toBe('ts1');
    expect(result.tireSets[0].valid).toBe(true);

    expect(result.tireSets[1].name).toBe('Winter Tires');
    expect(result.tireSets[1].type).toBe('WINTER');
    expect(result.tireSets[1].status).toBe('STORED');
    expect(result.tireSets[1].valid).toBe(true);
  });

  it('parses change logs section', () => {
    const csv = `[CHANGE_LOGS]
Id;TireSetId;Date;OdometerKm;Notes;CreatedAt
cl1;ts1;2024-06-15;10000;Mounted summer tires;2024-06-15T00:00:00Z`;

    const result = parseBackupCsv(csv);
    expect(result.changeLogs).toHaveLength(1);
    expect(result.changeLogs[0].tireSetId).toBe('ts1');
    expect(result.changeLogs[0].date).toBe('2024-06-15');
    expect(result.changeLogs[0].odometerKm).toBe(10000);
    expect(result.changeLogs[0].notes).toBe('Mounted summer tires');
    expect(result.changeLogs[0].valid).toBe(true);
  });

  it('parses complete backup with all sections', () => {
    const csv = `[VEHICLE]
Id;Name;Make;Model;Year;LicensePlate;InspectionDueDate;InspectionIntervalMonths;InitialOdometer
v1;Test Car;Honda;Civic;2021;TEST-123;2025-12-01;12;0

[FILLUPS]
Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes
f1;2025-01-10;1000;40;1.50;60.00;1;

[EXPENSES]
Id;Date;Km;Amount;Category;Vendor;Liters;OilConsumption;Notes
e1;2025-01-15;1500;50.00;MAINTENANCE;;;

[TIRE_SETS]
Id;Name;Type;Status;TotalKm;PurchaseDate;Notes;CreatedAt;UpdatedAt
ts1;All Season;ALL_SEASON;ACTIVE;0;;;2025-01-01T00:00:00Z;2025-01-01T00:00:00Z

[CHANGE_LOGS]
Id;TireSetId;Date;OdometerKm;Notes;CreatedAt
cl1;ts1;2025-01-01;0;;2025-01-01T00:00:00Z`;

    const result = parseBackupCsv(csv);
    expect(result.vehicle?.name).toBe('Test Car');
    expect(result.vehicle?.valid).toBe(true);
    expect(result.fillUps).toHaveLength(1);
    expect(result.expenses).toHaveLength(1);
    expect(result.tireSets).toHaveLength(1);
    expect(result.tireSets[0].type).toBe('ALL_SEASON');
    expect(result.changeLogs).toHaveLength(1);
  });

  it('handles quoted fields with semicolons', () => {
    const csv = `[FILLUPS]
Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes
f1;2025-01-10;1000;40;1.50;60.00;1;"Note with; semicolon"`;

    const result = parseBackupCsv(csv);
    expect(result.fillUps[0].notes).toBe('Note with; semicolon');
  });

  it('handles quoted fields with newlines', () => {
    const csv = `[EXPENSES]
Id;Date;Km;Amount;Category;Vendor;Liters;OilConsumption;Notes
e1;2025-10-20;193683;0.00;OTHER;;;;"Line 1

Line 3"`;

    const result = parseBackupCsv(csv);
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0].notes).toContain('Line 1');
    expect(result.expenses[0].notes).toContain('Line 3');
  });

  it('skips invalid rows without dates', () => {
    const csv = `[FILLUPS]
Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes
f1;invalid;1000;40;1.50;60.00;1;
f2;2025-01-10;2000;50;1.50;75.00;1;`;

    const result = parseBackupCsv(csv);
    expect(result.fillUps).toHaveLength(1);
    expect(result.fillUps[0].odometerKm).toBe(2000);
  });

  it('marks rows with missing required fields as invalid', () => {
    const csv = `[FILLUPS]
Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes
f1;2025-01-10;;40;1.50;60.00;1;`;

    const result = parseBackupCsv(csv);
    expect(result.fillUps).toHaveLength(1);
    expect(result.fillUps[0].valid).toBe(false);
    expect(result.fillUps[0].include).toBe(false);
  });
});
