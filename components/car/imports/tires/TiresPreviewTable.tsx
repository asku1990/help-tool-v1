'use client';

import type { ParsedTireSet, ParsedChangeLog } from '@/utils/csv';

type Props = {
  tireSets: ParsedTireSet[];
  changeLogs: ParsedChangeLog[];
  onToggleTireSet: (_index: number, _include: boolean) => void;
  onToggleChangeLog: (_index: number, _include: boolean) => void;
};

export default function TiresPreviewTable({
  tireSets,
  changeLogs,
  onToggleTireSet,
  onToggleChangeLog,
}: Props) {
  return (
    <div className="space-y-4 p-2">
      <div>
        <h4 className="font-medium text-sm mb-2">
          Tire Sets ({tireSets.filter(r => r.include && r.valid).length})
        </h4>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left w-12">✓</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Purchase Date</th>
              <th className="p-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {tireSets.map((r, idx) => (
              <tr key={r.id} className={!r.valid ? 'opacity-50' : ''}>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={e => onToggleTireSet(idx, e.target.checked)}
                  />
                </td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.purchaseDate}</td>
                <td className="p-2 truncate max-w-32">{r.notes}</td>
              </tr>
            ))}
            {tireSets.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  No tire sets in backup
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        <h4 className="font-medium text-sm mb-2">
          Change Logs ({changeLogs.filter(r => r.include && r.valid).length})
        </h4>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left w-12">✓</th>
              <th className="p-2 text-left">Tire Set</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Odometer</th>
              <th className="p-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {changeLogs.map((r, idx) => {
              const matchingTireSet = tireSets.find(ts => ts.exportId === r.tireSetId);
              return (
                <tr key={r.id} className={!r.valid ? 'opacity-50' : ''}>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={e => onToggleChangeLog(idx, e.target.checked)}
                    />
                  </td>
                  <td className="p-2">
                    {matchingTireSet?.name ?? <span className="text-gray-400">{r.tireSetId}</span>}
                  </td>
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{r.odometerKm}</td>
                  <td className="p-2 truncate max-w-32">{r.notes}</td>
                </tr>
              );
            })}
            {changeLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400">
                  No change logs in backup
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
