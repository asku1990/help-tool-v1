import { useRef, useState } from 'react';

export type ListedRecordDialogProps<T> = {
  vehicleId: string;
  item: T;
  entry: 'view' | 'edit';
  canWrite: boolean;
  canStartEdit: boolean;
  onClose: () => void;
  restoreFocus: (_saved: boolean) => void;
};

export function useListedRecordDialog<T extends { id: string }>(items: T[], ready: boolean) {
  const list = useRef<HTMLDivElement>(null);
  const [active, open] = useState<{ item: T; entry: 'view' | 'edit'; trigger: HTMLElement } | null>(
    null
  );
  const current = active && items.find(item => item.id === active.item.id);
  return {
    list,
    open,
    // Keep an open draft mounted even if refreshing the list moves its row off the page.
    dialog: active && {
      item: current ?? active.item,
      entry: active.entry,
      canStartEdit: ready && Boolean(current),
      onClose: () => open(null),
      restoreFocus: (saved: boolean) =>
        (!saved && active.trigger.isConnected ? active.trigger : list.current)?.focus(),
    },
  };
}
