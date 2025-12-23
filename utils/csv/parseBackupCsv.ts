import { splitSemicolonCsv } from './splitSemicolonCsv';
import { tryParseDate } from './tryParseDate';
import { toNum } from './toNum';
import { toBool } from './toBool';
import { parseTireType } from './parseTireType';
import { parseTireStatus } from './parseTireStatus';
import { parseExpenseCategory } from './parseExpenseCategory';
import type {
  ParsedBackupData,
  ParsedVehicle,
  ParsedFillUp,
  ParsedExpense,
  ParsedTireSet,
  ParsedChangeLog,
} from './types';

type Section = 'VEHICLE' | 'FILLUPS' | 'EXPENSES' | 'TIRE_SETS' | 'CHANGE_LOGS' | null;

function splitCsvRecords(input: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && input[i + 1] === '\n') {
        i++;
      }
      records.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  records.push(current);
  return records;
}

/**
 * Parses a unified backup CSV with section markers into structured data.
 */
export function parseBackupCsv(input: string): ParsedBackupData {
  const lines = splitCsvRecords(input)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return { fillUps: [], expenses: [], tireSets: [], changeLogs: [] };
  }

  let vehicle: ParsedVehicle | undefined;
  const fillUps: ParsedFillUp[] = [];
  const expenses: ParsedExpense[] = [];
  const tireSets: ParsedTireSet[] = [];
  const changeLogs: ParsedChangeLog[] = [];

  let currentSection: Section = null;
  let headerTokens: string[] = [];

  for (const line of lines) {
    // Check for section headers
    if (line.startsWith('[VEHICLE]')) {
      currentSection = 'VEHICLE';
      headerTokens = [];
      continue;
    }
    if (line.startsWith('[FILLUPS]')) {
      currentSection = 'FILLUPS';
      headerTokens = [];
      continue;
    }
    if (line.startsWith('[EXPENSES]')) {
      currentSection = 'EXPENSES';
      headerTokens = [];
      continue;
    }
    if (line.startsWith('[TIRE_SETS]')) {
      currentSection = 'TIRE_SETS';
      headerTokens = [];
      continue;
    }
    if (line.startsWith('[CHANGE_LOGS]')) {
      currentSection = 'CHANGE_LOGS';
      headerTokens = [];
      continue;
    }

    const tokens = splitSemicolonCsv(line);
    const lowerTokens = tokens.map(t => t.toLowerCase());

    // Parse vehicle section
    if (currentSection === 'VEHICLE') {
      if (headerTokens.length === 0 && lowerTokens.includes('name')) {
        headerTokens = lowerTokens;
        continue;
      }
      if (headerTokens.length > 0 && !vehicle) {
        vehicle = parseVehicleRow(tokens, headerTokens);
      }
      continue;
    }

    // Detect headers
    if (currentSection === 'FILLUPS' && headerTokens.length === 0 && lowerTokens.includes('date')) {
      headerTokens = lowerTokens;
      continue;
    }
    if (
      currentSection === 'EXPENSES' &&
      headerTokens.length === 0 &&
      lowerTokens.includes('date')
    ) {
      headerTokens = lowerTokens;
      continue;
    }
    if (
      currentSection === 'TIRE_SETS' &&
      headerTokens.length === 0 &&
      lowerTokens.includes('name')
    ) {
      headerTokens = lowerTokens;
      continue;
    }
    if (
      currentSection === 'CHANGE_LOGS' &&
      headerTokens.length === 0 &&
      lowerTokens.includes('tiresetid')
    ) {
      headerTokens = lowerTokens;
      continue;
    }

    // Parse data rows
    if (currentSection === 'FILLUPS' && headerTokens.length > 0) {
      const row = parseFillUpRow(tokens, headerTokens, fillUps.length);
      if (row) fillUps.push(row);
    }

    if (currentSection === 'EXPENSES' && headerTokens.length > 0) {
      const row = parseExpenseRow(tokens, headerTokens, expenses.length);
      if (row) expenses.push(row);
    }

    if (currentSection === 'TIRE_SETS' && headerTokens.length > 0) {
      const row = parseTireSetRow(tokens, headerTokens, tireSets.length);
      if (row) tireSets.push(row);
    }

    if (currentSection === 'CHANGE_LOGS' && headerTokens.length > 0) {
      const row = parseChangeLogRow(tokens, headerTokens, changeLogs.length);
      if (row) changeLogs.push(row);
    }
  }

  return { vehicle, fillUps, expenses, tireSets, changeLogs };
}

function getToken(tokens: string[], idx: number): string | undefined {
  if (idx < 0) return undefined;
  return idx < tokens.length ? tokens[idx] : undefined;
}

function parseFillUpRow(
  tokens: string[],
  headerTokens: string[],
  index: number
): ParsedFillUp | null {
  const idx = {
    date: headerTokens.indexOf('date'),
    odometerKm: headerTokens.indexOf('odometerkm'),
    liters: headerTokens.indexOf('liters'),
    pricePerLiter: headerTokens.indexOf('priceperliter'),
    totalCost: headerTokens.indexOf('totalcost'),
    isFull: headerTokens.indexOf('isfull'),
    notes: headerTokens.indexOf('notes'),
  };

  const date = idx.date >= 0 ? tryParseDate(getToken(tokens, idx.date)) : undefined;
  if (!date) return null;

  const odometerToken = getToken(tokens, idx.odometerKm);
  const odometerKm = odometerToken
    ? parseInt(odometerToken.replace(/[^0-9-]/g, ''), 10)
    : Number.NaN;
  const liters = toNum(getToken(tokens, idx.liters));
  const pricePerLiter = toNum(getToken(tokens, idx.pricePerLiter));
  const totalCost = toNum(getToken(tokens, idx.totalCost));
  const isFull = toBool(getToken(tokens, idx.isFull));
  const notes = getToken(tokens, idx.notes);

  const valid =
    Number.isFinite(odometerKm) &&
    Number.isFinite(liters) &&
    Number.isFinite(pricePerLiter) &&
    Number.isFinite(totalCost);

  return {
    id: `fu-${index}`,
    include: valid,
    date,
    odometerKm,
    liters: liters ?? 0,
    pricePerLiter: pricePerLiter ?? 0,
    totalCost: totalCost ?? 0,
    isFull,
    notes,
    valid,
  };
}

function parseExpenseRow(
  tokens: string[],
  headerTokens: string[],
  index: number
): ParsedExpense | null {
  const idx = {
    date: headerTokens.indexOf('date'),
    km: headerTokens.indexOf('km'),
    amount: headerTokens.indexOf('amount'),
    category: headerTokens.indexOf('category'),
    vendor: headerTokens.indexOf('vendor'),
    liters: headerTokens.indexOf('liters'),
    oilConsumption: headerTokens.indexOf('oilconsumption'),
    notes: headerTokens.indexOf('notes'),
  };

  const date = idx.date >= 0 ? tryParseDate(getToken(tokens, idx.date)) : undefined;
  if (!date) return null;

  const kmToken = getToken(tokens, idx.km);
  const km = kmToken ? parseInt(kmToken.replace(/[^0-9-]/g, ''), 10) : undefined;
  const amount = toNum(getToken(tokens, idx.amount));
  const category = parseExpenseCategory(getToken(tokens, idx.category) ?? '');
  const vendor = getToken(tokens, idx.vendor);
  const liters = toNum(getToken(tokens, idx.liters));
  const oilConsumption = toNum(getToken(tokens, idx.oilConsumption));
  const notes = getToken(tokens, idx.notes);

  const valid = amount !== undefined && Number.isFinite(amount);

  return {
    id: `ex-${index}`,
    include: valid,
    date,
    odometerKm: Number.isFinite(km) ? km : undefined,
    amount: amount ?? 0,
    category,
    vendor,
    liters,
    oilConsumption,
    notes,
    valid,
  };
}

function parseTireSetRow(
  tokens: string[],
  headerTokens: string[],
  index: number
): ParsedTireSet | null {
  const idx = {
    id: headerTokens.indexOf('id'),
    name: headerTokens.indexOf('name'),
    type: headerTokens.indexOf('type'),
    status: headerTokens.indexOf('status'),
    purchaseDate: headerTokens.indexOf('purchasedate'),
    notes: headerTokens.indexOf('notes'),
  };

  const exportId = getToken(tokens, idx.id);
  const name = getToken(tokens, idx.name) ?? '';
  const type = parseTireType(getToken(tokens, idx.type) ?? '');
  const status = parseTireStatus(getToken(tokens, idx.status) ?? '');
  const purchaseDate = tryParseDate(getToken(tokens, idx.purchaseDate));
  const notes = getToken(tokens, idx.notes);

  const valid = !!name && !!type;

  return {
    id: `ts-${index}`,
    include: valid,
    exportId,
    name,
    type: type ?? 'SUMMER',
    status,
    purchaseDate,
    notes,
    valid,
  };
}

function parseChangeLogRow(
  tokens: string[],
  headerTokens: string[],
  index: number
): ParsedChangeLog | null {
  const idx = {
    tireSetId: headerTokens.indexOf('tiresetid'),
    date: headerTokens.indexOf('date'),
    odometerKm: headerTokens.indexOf('odometerkm'),
    notes: headerTokens.indexOf('notes'),
  };

  const tireSetId = getToken(tokens, idx.tireSetId) ?? '';
  const date = tryParseDate(getToken(tokens, idx.date));
  const odometerKmStr = getToken(tokens, idx.odometerKm);
  const odometerKm = odometerKmStr
    ? parseInt(odometerKmStr.replace(/[^0-9-]/g, ''), 10)
    : Number.NaN;
  const notes = getToken(tokens, idx.notes);

  const valid = !!tireSetId && !!date && Number.isFinite(odometerKm);

  return {
    id: `cl-${index}`,
    include: valid,
    tireSetId,
    date: date ?? '',
    odometerKm,
    notes,
    valid,
  };
}

function parseVehicleRow(tokens: string[], headerTokens: string[]): ParsedVehicle {
  const idx = {
    id: headerTokens.indexOf('id'),
    name: headerTokens.indexOf('name'),
    make: headerTokens.indexOf('make'),
    model: headerTokens.indexOf('model'),
    year: headerTokens.indexOf('year'),
    licensePlate: headerTokens.indexOf('licenseplate'),
    inspectionDueDate: headerTokens.indexOf('inspectionduedate'),
    inspectionIntervalMonths: headerTokens.indexOf('inspectionintervalmonths'),
    initialOdometer: headerTokens.indexOf('initialodometer'),
  };

  const id = idx.id >= 0 ? tokens[idx.id] : undefined;
  const name = idx.name >= 0 ? tokens[idx.name] : '';
  const make = idx.make >= 0 && tokens[idx.make] ? tokens[idx.make] : undefined;
  const model = idx.model >= 0 && tokens[idx.model] ? tokens[idx.model] : undefined;
  const yearStr = idx.year >= 0 ? tokens[idx.year] : '';
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  const licensePlate =
    idx.licensePlate >= 0 && tokens[idx.licensePlate] ? tokens[idx.licensePlate] : undefined;
  const inspectionDueDate = tryParseDate(
    idx.inspectionDueDate >= 0 ? tokens[idx.inspectionDueDate] : ''
  );
  const intervalStr = idx.inspectionIntervalMonths >= 0 ? tokens[idx.inspectionIntervalMonths] : '';
  const inspectionIntervalMonths = intervalStr ? parseInt(intervalStr, 10) : undefined;
  const odometerStr = idx.initialOdometer >= 0 ? tokens[idx.initialOdometer] : '';
  const initialOdometer = odometerStr ? parseInt(odometerStr, 10) : undefined;

  const valid = !!name;

  return {
    id,
    name,
    make,
    model,
    year: Number.isFinite(year) ? year : undefined,
    licensePlate,
    inspectionDueDate,
    inspectionIntervalMonths: Number.isFinite(inspectionIntervalMonths)
      ? inspectionIntervalMonths
      : undefined,
    initialOdometer: Number.isFinite(initialOdometer) ? initialOdometer : undefined,
    valid,
  };
}
