import { useQuery } from '@tanstack/react-query';

import { gdprAdminService, type AdminGdprRequestsResponse } from '@/services/gdprAdminService';
import { adminKeys } from './queryKeys';

export function useAdminGdprRequests(enabled = true) {
  return useQuery<AdminGdprRequestsResponse>({
    queryKey: adminKeys.gdprRequests(),
    queryFn: () => gdprAdminService.getGdprRequests(),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes — admin data refreshes frequently
  });
}
