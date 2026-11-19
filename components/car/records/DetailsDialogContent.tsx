'use client';

import type { ReactNode } from 'react';
import { Button, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';

type DetailsDialogContentProps = {
  title: string;
  fields: ReadonlyArray<readonly [string, string | number | null | undefined]>;
  onCloseAutoFocus?: (_event: Event) => void;
  children?: ReactNode;
};

export default function DetailsDialogContent({
  title,
  fields,
  onCloseAutoFocus,
  children,
}: DetailsDialogContentProps) {
  return (
    <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-gray-500">{label}</dt>
            <dd className="wrap-anywhere whitespace-pre-wrap">
              {value === '' || value == null ? '—' : value}
            </dd>
          </div>
        ))}
      </dl>
      {children}
      <div className="flex justify-end">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="cursor-pointer">
            Close
          </Button>
        </DialogClose>
      </div>
    </DialogContent>
  );
}
