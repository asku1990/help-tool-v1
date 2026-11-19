import { z } from 'zod';
import { expenseCategories } from '@/utils/expenses';

const expenseFields = z.object({
  date: z.string(),
  category: z.enum(expenseCategories),
  amount: z.number(),
  vendor: z.string(),
  liters: z.number(),
  notes: z.string(),
});

export const createExpenseSchema = expenseFields.extend({
  date: expenseFields.shape.date.min(1),
  // Preserve the existing create contract; edits enforce the database range.
  odometerKm: z.number().int().optional(),
  vendor: expenseFields.shape.vendor.optional(),
  liters: expenseFields.shape.liters.optional(),
  notes: expenseFields.shape.notes.optional(),
});

export const updateExpenseSchema = expenseFields
  .extend({
    date: expenseFields.shape.date.min(1, 'Date cannot be empty'),
    odometerKm: z.int32().nullable(),
    vendor: expenseFields.shape.vendor.nullable(),
    liters: expenseFields.shape.liters.nullable(),
    notes: expenseFields.shape.notes.nullable(),
  })
  .partial();

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
