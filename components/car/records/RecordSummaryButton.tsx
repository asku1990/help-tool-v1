'use client';

import { ChevronRight } from 'lucide-react';
import type { ExpenseDto } from '@/queries/expenses';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { formatDateFi } from '@/utils';

type Props = { vehicleId: string } & (
  | { type: 'expense'; item: ExpenseDto }
  | { type: 'fillup'; item: FillUpWithSegmentDto }
);

function currency(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);
}

export function RecordSummaryButton(props: Props & { onOpen: (_trigger: HTMLElement) => void }) {
  const date = formatDateFi(new Date(props.item.date));
  const odometer = props.item.odometerKm != null ? `${props.item.odometerKm} km` : '—';
  const category = props.type === 'expense' ? props.item.category.replace(/_/g, ' ') : '';
  const summary =
    props.type === 'expense'
      ? [category, props.item.vendor, props.item.odometerKm != null ? odometer : null]
          .filter(Boolean)
          .join(' · ')
      : odometer;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={e => props.onOpen(e.currentTarget)}
      aria-label={`View ${props.type === 'expense' ? 'expense' : 'fill-up'} details for ${date}: ${summary}`}
      className="flex min-h-11 min-w-0 cursor-pointer flex-col items-start justify-center rounded-sm py-1 text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="inline-flex items-center gap-1 text-sm font-medium">
        {date}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </span>
      {props.item.odometerKm != null && (
        <span className="max-w-full wrap-anywhere text-xs text-muted-foreground lg:hidden">
          {odometer}
        </span>
      )}
    </button>
  );
}

export function recordFields(props: Props) {
  const date = formatDateFi(new Date(props.item.date));
  const odometer = props.item.odometerKm != null ? `${props.item.odometerKm} km` : '—';
  const fields: [string, string][] = [
    ['Date', date],
    ['Odometer', odometer],
  ];

  if (props.type === 'expense') {
    const { item } = props;
    fields.push(
      ['Category', item.category.replace(/_/g, ' ')],
      ['Amount', currency(item.amount)],
      ['Vendor', item.vendor || '—'],
      ['Liters', item.liters != null ? `${item.liters} L` : '—'],
      [
        'Oil consumption',
        item.oilConsumption != null ? `${item.oilConsumption.toFixed(1)} L/10,000 km` : '—',
      ]
    );
  } else {
    const { item } = props;
    fields.push(
      ['Liters', `${item.liters} L`],
      ['Price per liter', `${item.pricePerLiter.toFixed(3)} €/L`],
      ['Total cost', currency(item.totalCost)],
      ['Tank', item.isFull ? 'Full tank' : 'Partial']
    );
    if (item.isFull && item.segment) {
      fields.push(
        ['Trip distance', `${item.segment.distanceKm.toFixed(0)} km`],
        ['Trip fuel used', `${item.segment.litersUsed} L`],
        ['Trip consumption', `${item.segment.lPer100.toFixed(2)} L/100 km`],
        ['Trip fuel cost', currency(item.segment.fuelCost)],
        ['Trip cost per 100 km', currency(item.segment.costPer100)]
      );
      if (item.segment.prevLPer100 != null) {
        fields.push([
          'Previous trip consumption',
          `${item.segment.prevLPer100.toFixed(2)} L/100 km`,
        ]);
      }
    }
  }
  fields.push(['Notes', props.item.notes || '—']);
  return fields;
}
