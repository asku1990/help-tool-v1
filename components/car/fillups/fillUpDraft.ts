import type { UpdateFillUpInput } from '@/lib/fillups';
import type { FillUpDto } from '@/queries/fillups';
import { parseRecordDecimal } from '../records/parseRecordDecimal';
import { parseRecordOdometer } from '../records/parseRecordOdometer';

export function toFillUpDraft(item: FillUpDto) {
  return {
    date: item.date.slice(0, 10),
    odometerKm: String(item.odometerKm),
    liters: String(item.liters),
    pricePerLiter: item.pricePerLiter.toFixed(3),
    isFull: item.isFull,
    notes: item.notes || '',
  };
}

export function getFillUpDraftChanges(item: FillUpDto, draft: ReturnType<typeof toFillUpDraft>) {
  const odometerKm = parseRecordOdometer(draft.odometerKm) ?? undefined;
  const invalidOdometer = odometerKm === undefined;
  const liters = parseRecordDecimal(draft.liters);
  const pricePerLiter = parseRecordDecimal(draft.pricePerLiter);
  const patch: UpdateFillUpInput = {
    date: draft.date !== item.date.slice(0, 10) ? draft.date : undefined,
    odometerKm: odometerKm !== item.odometerKm ? odometerKm : undefined,
    liters: liters !== item.liters ? liters : undefined,
    pricePerLiter: pricePerLiter !== item.pricePerLiter ? pricePerLiter : undefined,
    isFull: draft.isFull !== item.isFull ? draft.isFull : undefined,
    notes: draft.notes !== (item.notes || '') ? draft.notes || null : undefined,
  };

  return {
    patch,
    invalidOdometer,
    hasChanges: invalidOdometer || Object.values(patch).some(value => value !== undefined),
    total: liters * pricePerLiter,
  };
}
