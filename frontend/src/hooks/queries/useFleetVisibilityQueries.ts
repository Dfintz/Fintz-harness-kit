/**
 * Fleet Visibility React Query hooks
 *
 * Provides hooks for managing fleet visibility rules
 * (org-level rank-based, alliance-based, federation-based).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateFleetVisibilityRuleRequest,
  UpdateFleetVisibilityRuleRequest,
} from '@sc-fleet-manager/shared-types';

import { fleetVisibilityService } from '@/services/fleetVisibilityService';

import { fleetKeys } from './queryKeys';

/**
 * Fetch all visibility rules for a fleet
 */
export function useFleetVisibilityRules(fleetId: string | undefined) {
  return useQuery({
    queryKey: fleetKeys.visibilityRules(fleetId ?? ''),
    queryFn: () => fleetVisibilityService.getRules(fleetId!),
    enabled: !!fleetId,
  });
}

/**
 * Create a new visibility rule for a fleet
 */
export function useCreateFleetVisibilityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fleetId, data }: { fleetId: string; data: CreateFleetVisibilityRuleRequest }) =>
      fleetVisibilityService.createRule(fleetId, data),
    onSuccess: (_, { fleetId }) => {
      queryClient.invalidateQueries({
        queryKey: fleetKeys.visibilityRules(fleetId),
      });
    },
  });
}

/**
 * Update an existing visibility rule
 */
export function useUpdateFleetVisibilityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fleetId,
      ruleId,
      data,
    }: {
      fleetId: string;
      ruleId: string;
      data: UpdateFleetVisibilityRuleRequest;
    }) => fleetVisibilityService.updateRule(fleetId, ruleId, data),
    onSuccess: (_, { fleetId }) => {
      queryClient.invalidateQueries({
        queryKey: fleetKeys.visibilityRules(fleetId),
      });
    },
  });
}

/**
 * Delete a visibility rule
 */
export function useDeleteFleetVisibilityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fleetId, ruleId }: { fleetId: string; ruleId: string }) =>
      fleetVisibilityService.deleteRule(fleetId, ruleId),
    onSuccess: (_, { fleetId }) => {
      queryClient.invalidateQueries({
        queryKey: fleetKeys.visibilityRules(fleetId),
      });
    },
  });
}
