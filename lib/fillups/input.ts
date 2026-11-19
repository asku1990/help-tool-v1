import { z } from 'zod';

const fillUpFields = z.object({
  date: z.string(),
  liters: z.number(),
  pricePerLiter: z.number(),
  isFull: z.boolean(),
  notes: z.string(),
});

export const createFillUpSchema = fillUpFields.extend({
  date: fillUpFields.shape.date.min(1),
  // Preserve the existing create contract; edits enforce the database range.
  odometerKm: z.number().int(),
  totalCost: z.number(),
  isFull: fillUpFields.shape.isFull.optional(),
  notes: fillUpFields.shape.notes.optional(),
});

export const updateFillUpSchema = fillUpFields
  .extend({
    date: fillUpFields.shape.date.min(1, 'Date cannot be empty'),
    odometerKm: z.int32(),
    notes: fillUpFields.shape.notes.nullable(),
  })
  .partial();

export type CreateFillUpInput = z.input<typeof createFillUpSchema>;
export type UpdateFillUpInput = z.input<typeof updateFillUpSchema>;
