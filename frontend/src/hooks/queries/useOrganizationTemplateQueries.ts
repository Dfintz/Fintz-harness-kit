/**
 * Organization Template Query Hooks
 *
 * TanStack Query hooks for organization template operations including
 * marketplace browsing, CRUD, forking, rating, and import/export.
 */

import { organizationTemplateService } from '@/services/organizationTemplateService';
import type {
  ApplyTemplateInput,
  CreateTemplateInput,
  ForkTemplateInput,
  ImportTemplateInput,
  MarketplaceSearchParams,
  MarketplaceSearchResult,
  OrganizationTemplate,
  RateTemplateInput,
  TemplateListParams,
  UpdateTemplateInput,
} from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { organizationTemplateKeys } from './queryKeys';

// ============================================================================
// Query Hooks — Discovery / Marketplace
// ============================================================================

export function useMarketplaceTemplates(
  params?: MarketplaceSearchParams,
  options?: Omit<UseQueryOptions<MarketplaceSearchResult>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: organizationTemplateKeys.marketplace(params as Record<string, unknown>),
    queryFn: () => organizationTemplateService.searchMarketplace(params),
    ...options,
  });
}

export function usePopularTemplates(
  limit?: number,
  options?: Omit<UseQueryOptions<OrganizationTemplate[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: organizationTemplateKeys.popular(limit),
    queryFn: () => organizationTemplateService.getPopularTemplates(limit),
    ...options,
  });
}

export function useTopRatedTemplates(
  limit?: number,
  options?: Omit<UseQueryOptions<OrganizationTemplate[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: organizationTemplateKeys.topRated(limit),
    queryFn: () => organizationTemplateService.getTopRatedTemplates(limit),
    ...options,
  });
}

// ============================================================================
// Query Hooks — CRUD
// ============================================================================

export function useOrganizationTemplates(
  params?: TemplateListParams,
  options?: Omit<UseQueryOptions<OrganizationTemplate[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: organizationTemplateKeys.list(params as Record<string, unknown>),
    queryFn: () => organizationTemplateService.listTemplates(params),
    ...options,
  });
}

export function useOrganizationTemplate(
  id: string | undefined,
  options?: Omit<UseQueryOptions<OrganizationTemplate>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: organizationTemplateKeys.detail(id!),
    queryFn: () => organizationTemplateService.getTemplate(id!),
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useCreateTemplate() {  return useMutation({
    mutationFn: (input: CreateTemplateInput) => organizationTemplateService.createTemplate(input),
    meta: { invalidates: [organizationTemplateKeys.lists()] },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTemplateInput }) =>
      organizationTemplateService.updateTemplate(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: organizationTemplateKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: organizationTemplateKeys.lists() });
    },
  });
}

export function useDeleteTemplate() {  return useMutation({
    mutationFn: (id: string) => organizationTemplateService.deleteTemplate(id),
    meta: { invalidates: [organizationTemplateKeys.lists()] },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApplyTemplateInput }) =>
      organizationTemplateService.applyTemplate(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: organizationTemplateKeys.detail(id) });
    },
  });
}

export function useForkTemplate() {  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: ForkTemplateInput }) =>
      organizationTemplateService.forkTemplate(id, input),
    meta: { invalidates: [organizationTemplateKeys.lists(), [...organizationTemplateKeys.all, 'marketplace'],] },
  });
}

export function useRateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RateTemplateInput }) =>
      organizationTemplateService.rateTemplate(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: organizationTemplateKeys.detail(id) });
      queryClient.invalidateQueries({
        queryKey: [...organizationTemplateKeys.all, 'marketplace'],
      });
      queryClient.invalidateQueries({
        queryKey: [...organizationTemplateKeys.all, 'top-rated'],
      });
    },
  });
}

export function useImportTemplate() {  return useMutation({
    mutationFn: (input: ImportTemplateInput) => organizationTemplateService.importTemplate(input),
    meta: { invalidates: [organizationTemplateKeys.lists()] },
  });
}

export function useExportTemplate() {
  return useMutation({
    mutationFn: (id: string) => organizationTemplateService.exportTemplate(id),
  });
}
