'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';

export type SavedRecordMode = 'view' | 'edit' | 'files';

export default function SavedRecordDialogShell({
  mode,
  title,
  busy,
  onDismiss,
  onDoneManaging,
  restoreFocus,
  children,
}: {
  mode: SavedRecordMode;
  title: string;
  busy: boolean;
  onDismiss: () => void;
  onDoneManaging: () => void;
  restoreFocus: () => void;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(mode);
  useLayoutEffect(() => {
    if (previous.current === mode) return;
    const selector =
      mode === 'view'
        ? previous.current === 'edit'
          ? '[data-edit-details]'
          : '[data-manage-files]'
        : null;
    const target = selector ? content.current?.querySelector<HTMLElement>(selector) : null;
    (target ?? heading.current)?.focus();
    previous.current = mode;
  }, [mode]);
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onDismiss();
      }}
    >
      <DialogContent
        ref={content}
        aria-describedby={undefined}
        closeDisabled={busy}
        className="gap-5 sm:max-w-xl max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:rounded-none max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onOpenAutoFocus={e => {
          e.preventDefault();
          heading.current?.focus();
        }}
        onCloseAutoFocus={e => {
          e.preventDefault();
          restoreFocus();
        }}
        onInteractOutside={e => {
          if (mode !== 'view' || busy) e.preventDefault();
        }}
        onEscapeKeyDown={e => {
          if (busy) e.preventDefault();
          else if (mode === 'files') {
            e.preventDefault();
            if (!(e.target instanceof HTMLElement && e.target.hasAttribute('data-file-rename')))
              onDoneManaging();
          }
        }}
      >
        <DialogHeader className="border-b pb-4 text-left">
          <DialogTitle ref={heading} tabIndex={-1} className="pr-8 text-xl outline-none">
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
        {mode === 'files' && (
          <footer className="flex justify-end border-t pt-4">
            <Button
              type="button"
              className="w-full min-h-11 sm:w-auto"
              disabled={busy}
              onClick={onDoneManaging}
            >
              Done
            </Button>
          </footer>
        )}
        {mode === 'view' && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onDismiss}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
