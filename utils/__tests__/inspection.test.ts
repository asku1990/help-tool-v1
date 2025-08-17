import {
  addMonths,
  diffDays,
  computeInspectionDueDate,
  computeInspectionStatus,
  pickLastInspectionDateFromExpenses,
  formatDateISO,
  formatDateFi,
} from '@/utils/inspection';

it('addMonths clamps end-of-month forward and backward', () => {
  expect(formatDateISO(addMonths(new Date('2024-01-31'), 1))).toMatch(/^2024-02-2[8-9]$/);
  expect(formatDateISO(addMonths(new Date('2024-03-31'), -1))).toMatch(/^2024-02-2[8-9]$/);
});

it('diffDays normalizes to midnight and handles negatives', () => {
  const a = new Date('2024-01-01T10:00:00Z');
  const b = new Date('2024-01-03T01:00:00Z');
  expect(diffDays(a, b)).toBe(2);
  expect(diffDays(b, a)).toBe(-2);
});

it('formatDateFi renders dd.MM.yyyy', () => {
  const d = new Date('2024-01-05T12:00:00Z');
  const s = formatDateFi(d);
  expect(s).toMatch(/^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/);
});

it('computeInspectionDueDate precedence and default interval', () => {
  const explicit = new Date('2024-06-01');
  expect(computeInspectionDueDate({ inspectionDueDate: explicit })).toEqual(explicit);
  const last = new Date('2024-01-01');
  expect(formatDateISO(computeInspectionDueDate({ lastInspectionDate: last })!)).toBe('2025-01-01');
  expect(
    formatDateISO(
      computeInspectionDueDate({ lastInspectionDate: last, inspectionIntervalMonths: 6 })!
    )
  ).toBe('2024-07-01');
});

it('computeInspectionStatus states: unknown, overdue, dueSoon, ok', () => {
  const today = new Date('2024-01-01');
  expect(computeInspectionStatus({ today })).toEqual({
    state: 'unknown',
    daysRemaining: null,
    dueDate: null,
  });
  expect(computeInspectionStatus({ today, inspectionDueDate: new Date('2023-12-31') }).state).toBe(
    'overdue'
  );
  expect(computeInspectionStatus({ today, inspectionDueDate: new Date('2024-01-31') }).state).toBe(
    'dueSoon'
  );
  expect(computeInspectionStatus({ today, inspectionDueDate: new Date('2024-03-01') }).state).toBe(
    'ok'
  );
});

it('pickLastInspectionDateFromExpenses matches vendor or notes and ignores invalid dates', () => {
  const d = pickLastInspectionDateFromExpenses([
    { date: 'invalid', category: 'MAINTENANCE', vendor: 'nope' },
    { date: '2024-01-10', category: 'MAINTENANCE', notes: 'annual inspection' },
    { date: '2024-02-05', category: 'MAINTENANCE', vendor: 'ITV Center' },
  ]);
  expect(formatDateISO(d!)).toBe('2024-02-05');
});
