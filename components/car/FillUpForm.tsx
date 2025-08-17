'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export type FillUpFormProps = {
  vehicleId: string;
  onCreated?: () => void;
};

export default function FillUpForm({ vehicleId, onCreated }: FillUpFormProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [odometerKm, setOdometerKm] = useState<string>('');
  const [liters, setLiters] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('');
  const [isFull, setIsFull] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const totalCost = useMemo(() => {
    const l = parseFloat(liters || '0');
    const p = parseFloat(pricePerLiter || '0');
    const t = l * p;
    return Number.isFinite(t) ? t.toFixed(2) : '0.00';
  }, [liters, pricePerLiter]);

  const isValid =
    !!vehicleId &&
    !!date &&
    !!odometerKm &&
    parseInt(odometerKm, 10) >= 0 &&
    parseFloat(liters) > 0 &&
    parseFloat(pricePerLiter) > 0;

  async function submit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/fillups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          odometerKm: parseInt(odometerKm, 10),
          liters: parseFloat(liters),
          pricePerLiter: parseFloat(pricePerLiter),
          totalCost: parseFloat(totalCost),
          isFull,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create fill-up');
      onCreated?.();
      setOpen(false);
      setOdometerKm('');
      setLiters('');
      setPricePerLiter('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add fill-up</Button>
      </DialogTrigger>
      <DialogContent aria-label="Add fill-up dialog">
        <DialogHeader>
          <DialogTitle>Add fill-up</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border rounded-md px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Odometer km</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={odometerKm}
                onChange={e => setOdometerKm(e.target.value)}
                className="border rounded-md px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Liters</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={liters}
                onChange={e => setLiters(e.target.value)}
                className="border rounded-md px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Price per liter</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={pricePerLiter}
                onChange={e => setPricePerLiter(e.target.value)}
                className="border rounded-md px-3 py-2"
                required
              />
            </label>
            <div className="flex items-center gap-2">
              <input
                id="isFull"
                type="checkbox"
                checked={isFull}
                onChange={e => setIsFull(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="isFull" className="text-sm">
                Full tank?
              </label>
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="border rounded-md px-3 py-2"
              rows={3}
            />
          </label>
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-500">Total: {totalCost}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || submitting}>
                {submitting ? 'Saving…' : 'Save fill-up'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
