import type { ExpenseDto } from '@/queries/expenses';
import type { FillUpWithSegmentDto } from '@/queries/fillups';
import { formatDateFi } from '@/utils';

function currency(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);
}

export function recordFields(
  props: { type: 'expense'; item: ExpenseDto } | { type: 'fillup'; item: FillUpWithSegmentDto }
) {
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
