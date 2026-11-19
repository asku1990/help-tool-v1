'use client';

import { useRef, useState } from 'react';
import { Button, Dialog, DialogTrigger } from '@/components/ui';
import type { ExpenseDto } from '@/queries/expenses';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { formatDateFi } from '@/utils';
import RecordAttachments from '../attachments/RecordAttachments';
import DetailsDialogContent from './DetailsDialogContent';
import { recordActionClass } from './RecordActions';

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
  const Trigger = menu ? Button : 'button';
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
        <Trigger
          type="button"
          {...(menu ? { variant: 'ghost' as const } : {})}
          aria-label={
            menu
              ? 'Details'
              : `View ${props.type === 'expense' ? 'expense' : 'fill-up'} details for ${date}: ${summary}`
          }
          className={
            menu
              ? recordActionClass
              : 'col-start-1 min-w-0 cursor-pointer rounded-md py-1 text-left hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:col-span-2'
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
        </Trigger>
      </DialogTrigger>
      <DetailsDialogContent
        title={title}
        fields={fields}
        onCloseAutoFocus={event => {
          if (menu) {
            event.preventDefault();
            returnFocus.current?.focus();
          }
        }}
      >
        {open ? (
          <RecordAttachments
            vehicleId={props.vehicleId}
            record={{ type: props.type, id: props.item.id }}
            readOnly
          />
        ) : null}
      </DetailsDialogContent>
    </Dialog>
  );
}
