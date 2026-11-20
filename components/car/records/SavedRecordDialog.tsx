'use client';

import { useRef, useState, type ReactNode } from 'react';
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
  entry: 'view' | 'edit';
  edit: {
    writable: boolean;
    available: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
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
  entry,
  edit,
  children,
  onClose,
  restoreFocus,
}: Props) {
  const [mode, setMode] = useState<SavedRecordMode>(entry);
  const [fileBusy, setFileBusy] = useState(false);
  const savedFromShortcut = useRef(false);
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
                    aria-disabled={!edit.available}
                    onClick={() => {
                      if (!edit.available) return;
                      edit.reset();
                      setMode('edit');
                    }}
                  >
                    Edit details
                  </Button>
                )}
              </div>
              {summary}
            </section>
          )}
          <RecordAttachments
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
