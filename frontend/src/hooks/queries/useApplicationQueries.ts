import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { orgApplicationService } from '@/services/orgApplicationService';
import { useAuthStore } from '@/store/authStore';

import { applicationKeys } from './queryKeys';

import type { ApplicationModeResponse, ApplicationSource } from '@sc-fleet-manager/shared-types';

/**
 * Get the application mode for an organization (simple/custom/discord).
 * Used by OrgApplicationModal to determine which form to render.
 */
export function useApplicationMode(orgId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: applicationKeys.mode(orgId ?? ''),
    queryFn: async (): Promise<ApplicationModeResponse> => {
      return orgApplicationService.getApplicationMode(orgId ?? '');
    },
    enabled: !!orgId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Submit an application to join an organization.
 * Invalidates application lists on success.
 */
export function useSubmitApplication(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      message?: string;
      formResponses?: Record<string, string>;
      source?: ApplicationSource;
    }) =>
      orgApplicationService.submitApplication(
        orgId ?? '',
        input.message,
        input.formResponses,
        input.source
      ),
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: applicationKeys.lists(orgId) });
      }
    },
  });
}

/**
 * Check if the current user has an active application or is a member of an org.
 * Only fires when the user is authenticated.
 */
export function useCheckMembership(orgId: string | undefined) {
  const user = useAuthStore(s => s.user);
  return useQuery({
    queryKey: applicationKeys.check(orgId ?? ''),
    queryFn: async () => {
      return orgApplicationService.checkActiveApplication(orgId ?? '');
    },
    enabled: !!orgId && !!user,
    staleTime: 5 * 60 * 1000,
  });
}
