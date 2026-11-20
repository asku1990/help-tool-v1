'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils';

const placementClasses = {
  row: 'relative col-start-2 row-start-1 justify-self-end sm:col-start-5',
  card: 'relative shrink-0',
  toolbar: 'shrink-0 lg:relative',
};

export const recordActionClass = 'min-h-11 w-full justify-start px-3';
export const destructiveRecordActionClass =
  `${recordActionClass} text-destructive hover:bg-destructive/10 hover:text-destructive` as const;

export default function RecordActions({
  label,
  triggerText,
  children,
  placement = 'row',
  unmountOnClose = false,
}: {
  label: string;
  triggerText?: string;
  children: ReactNode;
  placement?: keyof typeof placementClasses;
  unmountOnClose?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: Event) {
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
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('touchstart', closeOutside, { capture: true, passive: true });
    document.addEventListener('click', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('touchstart', closeOutside, true);
      document.removeEventListener('click', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <details
      ref={details}
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
      className={placementClasses[placement]}
      onClick={event => {
        const action =
          event.target instanceof Element ? event.target.closest('button, a[href]') : null;
        // Dialogs are portaled: their events must not be treated as menu selections.
        if (action && details.current?.contains(action)) {
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
        className={
          triggerText
            ? cn(
                buttonVariants({ variant: 'outline' }),
                'h-11 list-none gap-1 py-0 transition-colors has-[>svg]:px-2 max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:hover:bg-accent lg:has-[>svg]:px-4 dark:max-lg:bg-transparent dark:max-lg:hover:bg-accent [&::-webkit-details-marker]:hidden'
              )
            : 'flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden'
        }
      >
        {triggerText ? (
          <>
            {triggerText}
            <ChevronDown className="size-4" aria-hidden="true" />
          </>
        ) : (
          <MoreHorizontal className="size-5" aria-hidden="true" />
        )}
      </summary>
      {(open || !unmountOnClose) && (
        <div
          hidden={!open}
          className="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-md border bg-background p-1 shadow-md"
        >
          {children}
        </div>
      )}
    </details>
  );
}
