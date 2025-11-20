'use client';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 2,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );
  const [Devtools, setDevtools] = useState<ComponentType<{
    initialIsOpen?: boolean;
    api?: StorageLike;
  }> | null>(null);
  useEffect(() => {
    let mounted = true;
    async function loadDevtools() {
      if (process.env.NODE_ENV !== 'development') return;
      const mod = await import('@tanstack/react-query-devtools');
      if (mounted) {
        setDevtools(() => mod.ReactQueryDevtools);
      }
    }
    loadDevtools();
    return () => {
      mounted = false;
    };
  }, []);

  const storageApi = useMemo<StorageLike>(() => {
    if (typeof window !== 'undefined') {
      const { localStorage } = window;
      if (
        localStorage &&
        typeof localStorage.getItem === 'function' &&
        typeof localStorage.setItem === 'function' &&
        typeof localStorage.removeItem === 'function'
      ) {
        return localStorage;
      }
    }
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }, []);
  const showDevtools = process.env.NODE_ENV === 'development';

  return (
    <QueryClientProvider client={client}>
      {children}
      {showDevtools && Devtools ? <Devtools initialIsOpen={false} api={storageApi} /> : null}
    </QueryClientProvider>
  );
}
