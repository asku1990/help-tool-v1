import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { adminKeys } from '@/queries/keys';

type AdminMeResponse = { isAdmin: boolean };

export function useIsAdmin(enabled = true) {
  return useQuery({
    queryKey: adminKeys.me(),
    queryFn: () => apiGet<AdminMeResponse>('/api/admin/me'),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
