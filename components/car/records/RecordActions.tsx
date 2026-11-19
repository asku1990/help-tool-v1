'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export const recordActionClass = 'min-h-11 w-full justify-start px-3';
export const destructiveRecordActionClass =
  `${recordActionClass} text-destructive hover:bg-destructive/10 hover:text-destructive` as const;

export default function RecordActions({
  label,
  children,
  placement = 'row',
}: {
  label: string;
  children: ReactNode;
  placement?: 'row' | 'card';
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !details.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && details.current?.open) {
        event.preventDefault();
        setOpen(false);
        details.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <details
      ref={details}
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
      className={
        placement === 'row'
          ? 'relative col-start-2 row-start-1 justify-self-end sm:col-start-5'
          : 'relative shrink-0'
      }
      onClick={event => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        // Dialogs are portaled: their button events must not be treated as menu selections.
        if (button && details.current?.contains(button)) {
          setOpen(false);
          details.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary
        role="button"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={event => {
          event.preventDefault();
          setOpen(current => !current);
        }}
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </summary>
      <div
        hidden={!open}
        className="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-md border bg-background p-1 shadow-md"
      >
        {children}
      </div>
    </details>
  );
}
