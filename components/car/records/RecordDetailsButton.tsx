'use client';

import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import type { ExpenseDto } from '@/queries/expenses';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { formatDateFi } from '@/utils';
import RecordAttachments from '../attachments/RecordAttachments';

type Props = { vehicleId: string; variant?: 'summary' | 'menu' } & (
  | { type: 'expense'; item: ExpenseDto }
  | { type: 'fillup'; item: FillUpWithSegmentDto }
);

function currency(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);
}

export default function RecordDetailsButton(props: Props) {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const menu = props.variant === 'menu';
  const title = props.type === 'expense' ? 'Expense details' : 'Fill-up details';
  const date = formatDateFi(new Date(props.item.date));
  const summary =
    props.type === 'expense'
      ? `${props.item.category.replace(/_/g, ' ')}${props.item.vendor ? ` · ${props.item.vendor}` : ''}`
      : `Odo: ${props.item.odometerKm} km`;
  const fields: [string, string][] = [['Date', formatDateFi(new Date(props.item.date))]];

  if (props.type === 'expense') {
    const { item } = props;
    fields.push(
      ['Category', item.category],
      ['Amount', currency(item.amount)],
      ['Vendor', item.vendor || '—'],
      ['Odometer', item.odometerKm != null ? `${item.odometerKm} km` : '—'],
      ['Liters', item.liters != null ? `${item.liters} L` : '—'],
      [
        'Oil consumption',
        item.oilConsumption != null ? `${item.oilConsumption.toFixed(1)} L/10k` : '—',
      ]
    );
  } else {
    const { item } = props;
    fields.push(
      ['Odometer', `${item.odometerKm} km`],
      ['Liters', `${item.liters} L`],
      ['Price per liter', `${item.pricePerLiter.toFixed(3)} €/L`],
      ['Total cost', currency(item.totalCost)],
      ['Tank', item.isFull ? 'Full tank' : 'Partial']
    );
    if (item.isFull && item.segment) {
      fields.push(
        ['Trip distance', `${item.segment.distanceKm.toFixed(0)} km`],
        ['Trip fuel used', `${item.segment.litersUsed} L`],
        ['Trip consumption', `${item.segment.lPer100.toFixed(2)} L/100km`],
        ['Trip fuel cost', currency(item.segment.fuelCost)],
        ['Trip cost per 100 km', currency(item.segment.costPer100)]
      );
      if (item.segment.prevLPer100 != null) {
        fields.push([
          'Previous trip consumption',
          `${item.segment.prevLPer100.toFixed(2)} L/100km`,
        ]);
      }
    }
  }
  fields.push(['Notes', props.item.notes || '—']);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={
            menu
              ? 'Details'
              : `View ${props.type === 'expense' ? 'expense' : 'fill-up'} details for ${date}: ${summary}`
          }
          className={
            menu
              ? 'block min-h-11 w-full cursor-pointer rounded px-3 py-2 text-left text-sm hover:bg-gray-100'
              : 'col-start-1 min-w-0 cursor-pointer rounded-md px-2 py-1 text-left hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:col-span-2'
          }
          onClick={event => {
            returnFocus.current =
              event.currentTarget.closest('details')?.querySelector('summary') ??
              event.currentTarget;
          }}
        >
          {menu ? (
            'Details'
          ) : (
            <>
              <span className="block text-sm font-medium underline decoration-dotted underline-offset-4">
                {date}
              </span>
              <span className="block break-words text-xs text-gray-600">{summary}</span>
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent
        aria-label={title}
        aria-describedby={undefined}
        onCloseAutoFocus={event => {
          if (menu) {
            event.preventDefault();
            returnFocus.current?.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-gray-500">{label}</dt>
              <dd className="whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
        </dl>
        {open ? (
          <RecordAttachments
            vehicleId={props.vehicleId}
            record={{ type: props.type, id: props.item.id }}
            readOnly
          />
        ) : null}
        <div className="flex justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="cursor-pointer">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
