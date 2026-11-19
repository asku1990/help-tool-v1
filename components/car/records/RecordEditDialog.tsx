'use client';

import { useRef, type ReactNode } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';

type RecordEditDialogProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  restoreFocus: () => void;
  formId: string;
  hasChanges: boolean;
  invalid?: boolean;
  saving: boolean;
  attachmentBusy: boolean;
  children: ReactNode;
};

export default function RecordEditDialog({
  title,
  open,
  onClose,
  restoreFocus,
  formId,
  hasChanges,
  invalid,
  saving,
  attachmentBusy,
  children,
}: RecordEditDialogProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = saving || attachmentBusy;

  function requestClose() {
    if (busy) return;
    if (
      hasChanges &&
      !window.confirm('Discard unsaved record changes? Attachment changes are saved separately.')
    ) {
      return;
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={next => !next && requestClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:rounded-none max-sm:pt-[max(1.5rem,env(safe-area-inset-top))] max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onOpenAutoFocus={event => {
          event.preventDefault();
          heading.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          restoreFocus();
        }}
        onPointerDownOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle ref={heading} tabIndex={-1} className="pr-8 outline-none">
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 max-sm:flex-1"
            disabled={busy}
            onClick={requestClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            className="min-h-11 max-sm:flex-1"
            disabled={busy || !hasChanges || invalid}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
