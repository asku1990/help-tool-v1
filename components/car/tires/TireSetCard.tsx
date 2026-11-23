import type { MouseEventHandler } from 'react';
import { Button } from '@/components/ui';
import type { SetMileage, TireMileageEstimate } from '@/lib/tires';
import type { TireSetDto } from '@/queries/tires';
import { formatTireDate, tireTypeLabels } from './tireDisplay';

type SetActions = {
  edit: MouseEventHandler<HTMLButtonElement>;
  mount?: { label: string; primary: boolean; run: MouseEventHandler<HTMLButtonElement> };
  restore?: () => void;
  retire?: () => void;
  delete?: () => void;
  updating: boolean;
  deleting: boolean;
};

export function TireSetCard({
  set,
  stats,
  estimate,
  actions,
}: {
  set: TireSetDto;
  stats?: SetMileage;
  estimate?: TireMileageEstimate | null;
  actions?: SetActions;
}) {
  const lastMount = set.changeLogs?.[0];
  const active = set.status === 'ACTIVE';
  return (
    <li className="min-w-0 space-y-2 rounded-lg border border-surface-border p-3">
      <h3 className="font-semibold wrap-anywhere">{set.name}</h3>
      <p className="text-sm text-muted-foreground">
        {tireTypeLabels[set.type]}
        {active && lastMount && (
          <>
            {' '}
            · Installed {formatTireDate(lastMount.date)}
            {lastMount.odometerConfirmed &&
              lastMount.odometerKm != null &&
              ` at ${lastMount.odometerKm.toLocaleString()} km`}
          </>
        )}
        {!active && stats?.lastUnmountedDate && (
          <> · Last used {formatTireDate(stats.lastUnmountedDate)}</>
        )}
      </p>
      {set.purchaseDate && (
        <p className="text-sm text-muted-foreground">
          Purchased {formatTireDate(set.purchaseDate)}
        </p>
      )}
      {stats?.confirmedKm != null && (
        <p className="text-sm text-muted-foreground">
          {stats.confirmedKm.toLocaleString()} km confirmed
          {stats.untrackedStints > 0 && ' · Some stints not tracked'}
        </p>
      )}
      {stats?.confirmedKm == null && !!stats?.untrackedStints && (
        <p className="text-sm text-muted-foreground">Mileage not tracked for completed stints</p>
      )}
      {estimate ? (
        <p className="text-sm text-muted-foreground">
          ~{estimate.km.toLocaleString()} km since install · through {formatTireDate(estimate.date)}{' '}
          fill-up
        </p>
      ) : (
        active && <p className="text-sm text-muted-foreground">Mileage since install unavailable</p>
      )}
      {set.totalKm > 0 && (
        <p className="text-sm text-muted-foreground">
          Previous tracked total (unverified): {set.totalKm.toLocaleString()} km
        </p>
      )}
      {set.notes && <p className="text-sm whitespace-pre-wrap wrap-anywhere">{set.notes}</p>}
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.mount && (
            <Button
              variant={actions.mount.primary ? 'default' : 'outline'}
              className="min-h-11"
              onClick={actions.mount.run}
            >
              {actions.mount.label}
            </Button>
          )}
          <Button variant="outline" className="min-h-11" onClick={actions.edit}>
            Edit details
          </Button>
          {actions.restore && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={actions.updating}
              onClick={actions.restore}
            >
              Restore to stored
            </Button>
          )}
          {(actions.retire || actions.delete) && (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-4">
                More actions<span className="sr-only"> for {set.name}</span>
              </summary>
              <div className="flex flex-wrap gap-2">
                {actions.retire && (
                  <Button variant="ghost" disabled={actions.updating} onClick={actions.retire}>
                    Retire
                  </Button>
                )}
                {actions.delete && (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    disabled={actions.deleting}
                    onClick={actions.delete}
                  >
                    Delete set
                  </Button>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </li>
  );
}
