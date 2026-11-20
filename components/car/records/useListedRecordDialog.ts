import { useRef, useState } from 'react';
import type { FetchStatus } from '@tanstack/react-query';

export type ListRefresh = {
  state: 'refreshing' | 'failed' | 'present' | 'missing';
  updatedAt: number;
  retry: () => void;
};

export type ListedRecordDialogProps<T> = {
  vehicleId: string;
  item: T;
  entry: 'view' | 'edit';
  canWrite: boolean;
  canStartEdit: boolean;
  listRefresh: ListRefresh;
  onClose: () => void;
  restoreFocus: (_saved: boolean) => void;
};

export function useListedRecordDialog<T extends { id: string }>(
  items: T[],
  query: {
    fetchStatus: FetchStatus;
    isError: boolean;
    dataUpdatedAt: number;
    refetch: () => unknown;
  }
) {
  const list = useRef<HTMLDivElement>(null);
  const [active, open] = useState<{ item: T; entry: 'view' | 'edit'; trigger: HTMLElement } | null>(
    null
  );
  const current = active && items.find(item => item.id === active.item.id);
  const state: ListRefresh['state'] =
    query.fetchStatus !== 'idle'
      ? 'refreshing'
      : query.isError
        ? 'failed'
        : current
          ? 'present'
          : 'missing';
  return {
    list,
    open,
    // Keep an open draft mounted even if refreshing the list moves its row off the page.
    dialog: active && {
      item: current ?? active.item,
      entry: active.entry,
      canStartEdit: state === 'present',
      listRefresh: { state, updatedAt: query.dataUpdatedAt, retry: () => void query.refetch() },
      onClose: () => open(null),
      restoreFocus: (saved: boolean) =>
        (!saved && active.trigger.isConnected ? active.trigger : list.current)?.focus(),
    },
  };
}
