import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { getUiErrorMessage } from '@/lib/api/client-errors';

export default function RecordEditForm({
  children,
  saving,
  writable,
  validChanges,
  onSave,
  onCancel,
}: {
  children: ReactNode;
  saving: boolean;
  writable: boolean;
  validChanges: boolean;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  const canSave = writable && validChanges && !saving;
  return (
    <form
      className="space-y-4"
      onSubmit={async event => {
        event.preventDefault();
        if (!canSave) return;
        setError('');
        try {
          await onSave();
        } catch (cause) {
          setError(getUiErrorMessage(cause, 'Could not save changes.'));
        }
      }}
    >
      <fieldset disabled={saving || !writable} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSave}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
