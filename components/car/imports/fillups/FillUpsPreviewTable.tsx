'use client';

import type { ParsedFillUp } from '@/utils/csv';

type Props = {
  data: ParsedFillUp[];
  onToggle: (_index: number, _include: boolean) => void;
};

export default function FillUpsPreviewTable({ data, onToggle }: Props) {
  if (data.length === 0) {
    return <div className="p-4 text-center text-gray-400">No fill-ups in backup</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-gray-50">
        <tr>
          <th className="p-2 text-left w-12">✓</th>
          <th className="p-2 text-left">Date</th>
          <th className="p-2 text-left">Odometer</th>
          <th className="p-2 text-left">Liters</th>
          <th className="p-2 text-left">€/L</th>
          <th className="p-2 text-left">Total €</th>
          <th className="p-2 text-left">Full</th>
          <th className="p-2 text-left">Notes</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r, idx) => (
          <tr key={r.id} className={!r.valid ? 'opacity-50' : ''}>
            <td className="p-2">
              <input
                type="checkbox"
                checked={r.include}
                onChange={e => onToggle(idx, e.target.checked)}
              />
            </td>
            <td className="p-2">{r.date}</td>
            <td className="p-2">{r.odometerKm}</td>
            <td className="p-2">{r.liters.toFixed(2)}</td>
            <td className="p-2">{r.pricePerLiter.toFixed(3)}</td>
            <td className="p-2">{r.totalCost.toFixed(2)}</td>
            <td className="p-2">{r.isFull ? '✓' : ''}</td>
            <td className="p-2 truncate max-w-32">{r.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
