/**
 * Treaty Template React Query hooks
 *
 * Provides hooks for managing treaty templates
 * (listing, creating, updating, deleting, instantiating).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateTreatyTemplateRequest,
  InstantiateTreatyRequest,
  UpdateTreatyTemplateRequest,
} from '@sc-fleet-manager/shared-types';

import {
  treatyTemplateService,
  type TreatyTemplateListParams,
} from '@/services/treatyTemplateService';

import { treatyTemplateKeys } from './queryKeys';

/**
 * Fetch available treaty templates (built-in + org-owned)
 */
export function useTreatyTemplates(params?: TreatyTemplateListParams) {
  return useQuery({
    queryKey: treatyTemplateKeys.list(params as Record<string, unknown>),
    queryFn: () => treatyTemplateService.getTemplates(params),
  });
}

/**
 * Fetch a single treaty template by ID
 */
export function useTreatyTemplate(id: string | undefined) {
  return useQuery({
    queryKey: treatyTemplateKeys.detail(id ?? ''),
    queryFn: () => treatyTemplateService.getTemplateById(id!),
    enabled: !!id,
  });
}

/**
 * Create a new custom treaty template
 */
export function useCreateTreatyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTreatyTemplateRequest) => treatyTemplateService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treatyTemplateKeys.lists(),
      });
    },
  });
}

/**
 * Update an existing treaty template
 */
export function useUpdateTreatyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTreatyTemplateRequest }) =>
      treatyTemplateService.updateTemplate(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: treatyTemplateKeys.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: treatyTemplateKeys.lists(),
      });
    },
  });
}

/**
 * Delete a custom treaty template
 */
export function useDeleteTreatyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => treatyTemplateService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: treatyTemplateKeys.lists(),
      });
    },
  });
}

/**
 * Instantiate a treaty from a template (generates terms for alliance/federation use)
 */
export function useInstantiateTreatyTemplate() {
  return useMutation({
    mutationFn: (data: InstantiateTreatyRequest) => treatyTemplateService.instantiateTemplate(data),
  });
}
