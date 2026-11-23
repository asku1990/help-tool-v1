'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardContent } from '@/components/ui';
import {
  useFillUps,
  useTireSets,
  useTireChangeHistory,
  useUpdateTireSet,
  useDeleteTireSet,
} from '@/hooks';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import { calculateTireMileage } from '@/lib/tires';
import type { TireSetDto } from '@/queries/tires';
import { TireChangeDialog, type TireChangeEditor } from './TireChangeDialog';
import { TireChangeHistory } from './TireChangeHistory';
import { TireSetCard } from './TireSetCard';
import { TireSetDialog } from './TireSetDialog';

type Editor = { kind: 'details'; set?: TireSetDto } | TireChangeEditor;

export default function TireManager({
  vehicleId,
  canWrite,
}: {
  vehicleId: string;
  canWrite: boolean;
}) {
  const setsQuery = useTireSets(vehicleId);
  const historyQuery = useTireChangeHistory(vehicleId);
  const fillUpsQuery = useFillUps(vehicleId);
  const updateSet = useUpdateTireSet(vehicleId);
  const deleteSet = useDeleteTireSet(vehicleId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const mountedHeading = useRef<HTMLHeadingElement | null>(null);

  const sets = setsQuery.data?.tireSets ?? [];
  const history = historyQuery.data?.history ?? [];
  const mounted = sets.find(set => set.status === 'ACTIVE');
  const stored = sets.filter(set => set.status === 'STORED');
  const retired = sets.filter(set => set.status === 'RETIRED');
  const setsWithHistory = new Set(history.map(log => log.tireSetId));
  const mileage = calculateTireMileage(
    history,
    mounted?.id,
    fillUpsQuery.isError ? undefined : fillUpsQuery.data?.fillUps[0]
  );

  function openEditor(event: MouseEvent<HTMLButtonElement>, next: Editor) {
    trigger.current = event.currentTarget;
    setEditor(next);
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    (trigger.current?.isConnected ? trigger.current : mountedHeading.current)?.focus();
  }

  async function changeStatus(tireSetId: string, status: 'STORED' | 'RETIRED') {
    try {
      await updateSet.mutateAsync({ tireSetId, status });
      toast.success(status === 'RETIRED' ? 'Tire set retired' : 'Tire set restored to storage');
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Could not update tire set status'));
    }
  }

  async function removeSet(set: TireSetDto) {
    if (!window.confirm(`Permanently delete ${set.name}?`)) return;
    try {
      await deleteSet.mutateAsync(set.id);
      toast.success('Tire set deleted');
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Could not delete tire set'));
    }
  }

  function renderSet(set: TireSetDto) {
    const canDelete =
      set.status !== 'ACTIVE' && !set.changeLogs?.length && !setsWithHistory.has(set.id);
    return (
      <TireSetCard
        key={set.id}
        set={set}
        stats={mileage.bySet.get(set.id)}
        estimate={set.status === 'ACTIVE' ? mileage.currentEstimate : null}
        actions={
          canWrite
            ? {
                edit: event => openEditor(event, { kind: 'details', set }),
                mount:
                  set.status === 'STORED'
                    ? {
                        label: !mounted && stored.length === 1 ? 'Mount this set' : 'Mount',
                        primary: !mounted,
                        run: event => openEditor(event, { kind: 'mount', setId: set.id }),
                      }
                    : undefined,
                restore:
                  set.status === 'RETIRED' ? () => void changeStatus(set.id, 'STORED') : undefined,
                retire:
                  set.status === 'STORED' ? () => void changeStatus(set.id, 'RETIRED') : undefined,
                delete: canDelete ? () => void removeSet(set) : undefined,
                updating: updateSet.isPending,
                deleting: deleteSet.isPending,
              }
            : undefined
        }
      />
    );
  }

  const loadError = setsQuery.error ?? historyQuery.error;
  if (loadError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2">
        {getUiErrorMessage(loadError, 'Could not load tire data')}
        <Button
          variant="outline"
          onClick={() => void Promise.all([setsQuery.refetch(), historyQuery.refetch()])}
        >
          Retry
        </Button>
      </div>
    );
  }
  if (setsQuery.isLoading || historyQuery.isLoading) return <p role="status">Loading tires…</p>;

  return (
    <div className="space-y-6">
      <Card variant="subtle">
        <CardContent className="space-y-3 !p-4 sm:!p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={mountedHeading} tabIndex={-1} className="text-lg font-semibold">
              Currently mounted
            </h2>
            {canWrite && mounted && stored.length > 0 && (
              <Button className="min-h-11" onClick={event => openEditor(event, { kind: 'mount' })}>
                Change tires
              </Button>
            )}
          </div>
          {mounted ? (
            <ul>{renderSet(mounted)}</ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tire set mounted.{' '}
              {canWrite && stored.length > 0 && 'Choose a stored set below to mount.'}
            </p>
          )}
        </CardContent>
      </Card>
      <Card variant="subtle">
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Other tire sets</h2>
            {canWrite && (
              <Button
                variant={stored.length || mounted ? 'outline' : 'default'}
                className="min-h-11"
                onClick={event => openEditor(event, { kind: 'details' })}
              >
                Add tire set
              </Button>
            )}
          </div>
          {stored.length ? (
            <ul className="space-y-2">{stored.map(renderSet)}</ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No stored tire sets. {canWrite && 'Add a set before mounting it.'}
            </p>
          )}
        </CardContent>
      </Card>
      <TireChangeHistory
        vehicleId={vehicleId}
        history={history}
        sets={sets}
        onEdit={canWrite ? (event, log) => openEditor(event, { kind: 'change', log }) : undefined}
      />
      {retired.length > 0 && (
        <Card variant="subtle">
          <CardContent>
            <details>
              <summary className="cursor-pointer text-lg font-semibold">
                Retired sets ({retired.length})
              </summary>
              <ul className="mt-3 space-y-2">{retired.map(renderSet)}</ul>
            </details>
          </CardContent>
        </Card>
      )}
      {canWrite &&
        editor &&
        (editor.kind === 'details' ? (
          <TireSetDialog
            vehicleId={vehicleId}
            set={editor.set}
            onClose={() => setEditor(null)}
            onCloseAutoFocus={restoreFocus}
          />
        ) : (
          <TireChangeDialog
            vehicleId={vehicleId}
            editor={editor}
            stored={stored}
            mountedName={mounted?.name}
            onMounted={() => {
              trigger.current = null;
            }}
            onClose={() => setEditor(null)}
            onCloseAutoFocus={restoreFocus}
          />
        ))}
    </div>
  );
}
