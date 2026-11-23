import type { MouseEvent } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardContent } from '@/components/ui';
import { useDeleteTireChangeLog } from '@/hooks';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import type { TireChangeLogDto, TireSetDto } from '@/queries/tires';
import { formatTireDate } from './tireDisplay';

export function TireChangeHistory({
  vehicleId,
  history,
  sets,
  onEdit,
}: {
  vehicleId: string;
  history: readonly TireChangeLogDto[];
  sets: readonly TireSetDto[];
  onEdit?: (_event: MouseEvent<HTMLButtonElement>, _log: TireChangeLogDto) => void;
}) {
  const deleteChange = useDeleteTireChangeLog(vehicleId);
  const setNames = new Map(sets.map(set => [set.id, set.name]));

  async function removeChange(id: string) {
    if (!window.confirm('Permanently delete this tire change?')) return;
    try {
      await deleteChange.mutateAsync(id);
      toast.success('Tire change deleted');
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Could not delete tire change'));
    }
  }

  return (
    <Card variant="subtle">
      <CardContent className="space-y-2">
        <h2 className="text-lg font-semibold">Tire change history</h2>
        {history.length ? (
          <details>
            <summary className="cursor-pointer py-3 text-sm font-medium underline underline-offset-4">
              View tire changes ({history.length})
            </summary>
            <ul className="space-y-2">
              {history.map(log => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border p-3"
                >
                  <div className="min-w-0 text-sm wrap-anywhere">
                    <p className="font-medium">
                      {setNames.get(log.tireSetId) ?? 'Unknown tire set'}
                    </p>
                    <p className="text-muted-foreground">
                      {formatTireDate(log.date)} ·{' '}
                      {log.odometerKm == null
                        ? 'Odometer not recorded'
                        : `${log.odometerKm.toLocaleString()} km${log.odometerConfirmed ? '' : ' (unverified)'}`}
                    </p>
                    {log.notes && <p className="whitespace-pre-wrap">{log.notes}</p>}
                  </div>
                  {onEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={event => onEdit(event, log)}
                      >
                        Edit change
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-11 text-destructive"
                        disabled={deleteChange.isPending}
                        onClick={() => void removeChange(log.id)}
                      >
                        Delete change
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">No tire changes recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}
