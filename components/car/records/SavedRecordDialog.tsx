'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ListRefresh } from './useListedRecordDialog';
import { Button } from '@/components/ui';
import type { AttachmentRecord } from '@/queries/attachments';
import RecordAttachments from '../attachments/RecordAttachments';
import RecordEditForm from './RecordEditForm';
import SavedRecordDialogShell, { type SavedRecordMode } from './SavedRecordDialogShell';

type Props = {
  name: string;
  vehicleId: string;
  record: AttachmentRecord;
  identifier: string;
  summary: ReactNode;
  listRefresh?: ListRefresh;
  entry: 'view' | 'edit';
  edit: {
    writable: boolean;
    available: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    saved: boolean;
    reset: () => void;
    save: () => Promise<void>;
  };
  children: ReactNode;
  onClose: () => void;
  restoreFocus: (_saved: boolean) => void;
};

export default function SavedRecordDialog({
  name,
  vehicleId,
  record,
  identifier,
  summary,
  listRefresh,
  entry,
  edit,
  children,
  onClose,
  restoreFocus,
}: Props) {
  const [mode, setMode] = useState<SavedRecordMode>(entry);
  const [fileBusy, setFileBusy] = useState(false);
  const savedFromShortcut = useRef(false);
  // Mutation completion can render before the list observer publishes its invalidation.
  const [beforeSave, setBeforeSave] = useState<number | null>(null);
  const awaitingList = beforeSave !== null;
  const refreshState =
    awaitingList && listRefresh?.updatedAt === beforeSave && listRefresh.state !== 'failed'
      ? 'refreshing'
      : listRefresh?.state;
  useEffect(() => {
    if (!awaitingList || (refreshState !== 'present' && refreshState !== 'missing')) return;
    setBeforeSave(null);
    if (refreshState === 'missing') {
      savedFromShortcut.current = true;
      toast.info('Saved. This record is no longer on the current page.');
      onClose();
    }
  }, [awaitingList, refreshState, onClose]);
  function finishEdit() {
    if (entry === 'edit') onClose();
    else setMode('view');
  }
  function dismiss() {
    if (mode !== 'edit') onClose();
    else if (!edit.dirty || window.confirm(`Discard unsaved ${name} changes?`)) finishEdit();
  }
  const title =
    mode === 'edit'
      ? `Edit ${name}`
      : mode === 'files'
        ? `Manage ${name} files`
        : `${name.charAt(0).toUpperCase()}${name.slice(1)} details`;
  return (
    <SavedRecordDialogShell
      title={title}
      mode={mode}
      busy={fileBusy || edit.saving}
      onDismiss={dismiss}
      onDoneManaging={() => setMode('view')}
      restoreFocus={() => restoreFocus(savedFromShortcut.current)}
    >
      {mode === 'edit' ? (
        <RecordEditForm
          saving={edit.saving}
          writable={edit.writable}
          validChanges={edit.dirty && !edit.invalid}
          onCancel={dismiss}
          onSave={async () => {
            await edit.save();
            savedFromShortcut.current = entry === 'edit';
            if (entry === 'view' && listRefresh) setBeforeSave(listRefresh.updatedAt);
            finishEdit();
          }}
        >
          {children}
        </RecordEditForm>
      ) : (
        <>
          {mode === 'files' ? (
            <p className="wrap-anywhere text-sm text-muted-foreground">{identifier}</p>
          ) : (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Record details</h3>
                {edit.writable && (
                  <Button
                    data-edit-details
                    variant="outline"
                    aria-disabled={!edit.available || awaitingList}
                    onClick={() => {
                      if (!edit.available || awaitingList) return;
                      edit.reset();
                      setMode('edit');
                    }}
                  >
                    Edit details
                  </Button>
                )}
              </div>
              {awaitingList && refreshState === 'failed' ? (
                <div>
                  <p role="alert">Changes saved, but the summary couldn’t be refreshed.</p>
                  <Button variant="outline" onClick={listRefresh?.retry}>
                    Retry refresh
                  </Button>
                </div>
              ) : awaitingList && refreshState === 'refreshing' ? (
                <p role="status">Changes saved. Refreshing summary…</p>
              ) : !listRefresh && edit.saved && !edit.available ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Changes saved. The updated summary is not available yet. If the list refresh
                  fails, close Details and retry the list.
                </p>
              ) : (
                summary
              )}
            </section>
          )}
          <RecordAttachments
            disabled={awaitingList}
            vehicleId={vehicleId}
            record={record}
            context={{
              kind: 'details',
              mode: mode === 'files' ? 'manage' : 'view',
              onModeChange: next => setMode(next === 'manage' ? 'files' : 'view'),
            }}
            onBusyChange={setFileBusy}
          />
        </>
      )}
    </SavedRecordDialogShell>
  );
}
