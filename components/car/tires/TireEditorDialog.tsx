import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { getUiErrorMessage } from '@/lib/api/client-errors';

export const tireFieldClass =
  'mt-1 block min-h-11 w-full rounded-md border bg-background px-3 py-2';

export function readTireField(fields: FormData, name: string) {
  return String(fields.get(name) ?? '').trim();
}

export function TireEditorDialog({
  title,
  description,
  submitLabel,
  onSave,
  onClose,
  onCloseAutoFocus,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  onSave: (_fields: FormData) => Promise<void>;
  onClose: () => void;
  onCloseAutoFocus: (_event: Event) => void;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    setError(null);
    setSaving(true);
    try {
      await onSave(fields);
      onClose();
    } catch (cause) {
      setError(getUiErrorMessage(cause, 'Could not save. Please try again.'));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        mobileLayout="fullscreen"
        closeDisabled={saving}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
