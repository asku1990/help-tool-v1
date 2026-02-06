import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

type AdminMeResponse = { isAdmin: boolean };

export function useIsAdmin(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => apiGet<AdminMeResponse>('/api/admin/me'),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
