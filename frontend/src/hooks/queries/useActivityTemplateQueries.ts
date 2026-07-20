import { activityTemplateService } from '@/services/activityTemplateService';
import type {
  ActivityTemplate,
  ActivityTemplateCategoryInfo,
  ActivityTemplateQueryFilters,
  ApplyActivityTemplateInput,
  CreateActivityTemplateInput,
  UpdateActivityTemplateInput,
} from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityTemplateKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch available template categories
 */
export function useActivityTemplateCategories() {
  return useQuery<ActivityTemplateCategoryInfo[]>({
    queryKey: activityTemplateKeys.categories(),
    queryFn: () => activityTemplateService.getCategories(),
    staleTime: 30 * 60 * 1000, // Categories change rarely
  });
}

/**
 * Fetch templates with optional filters
 */
export function useActivityTemplates(filters?: ActivityTemplateQueryFilters) {
  return useQuery<{ templates: ActivityTemplate[]; total: number; page: number; limit: number }>({
    queryKey: activityTemplateKeys.list(filters as Record<string, unknown>),
    queryFn: () => activityTemplateService.getTemplates(filters),
  });
}

/**
 * Fetch a single template by ID
 */
export function useActivityTemplate(templateId: string | undefined) {
  return useQuery<ActivityTemplate>({
    queryKey: activityTemplateKeys.detail(templateId ?? ''),
    queryFn: () => activityTemplateService.getTemplate(templateId ?? ''),
    enabled: !!templateId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new activity template
 */
export function useCreateActivityTemplate() {  return useMutation({
    mutationFn: (data: CreateActivityTemplateInput) => activityTemplateService.createTemplate(data),
    meta: { invalidates: [activityTemplateKeys.lists()] },
  });
}

/**
 * Update an existing template
 */
export function useUpdateActivityTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: UpdateActivityTemplateInput }) =>
      activityTemplateService.updateTemplate(templateId, data),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: activityTemplateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: activityTemplateKeys.detail(templateId) });
    },
  });
}

/**
 * Delete a template (soft-delete)
 */
export function useDeleteActivityTemplate() {  return useMutation({
    mutationFn: (templateId: string) => activityTemplateService.deleteTemplate(templateId),
    meta: { invalidates: [activityTemplateKeys.lists()] },
  });
}

/**
 * Clone a template
 */
export function useCloneActivityTemplate() {  return useMutation({
    mutationFn: (templateId: string) => activityTemplateService.cloneTemplate(templateId),
    meta: { invalidates: [activityTemplateKeys.lists()] },
  });
}

/**
 * Apply a template to create a new activity
 */
export function useApplyActivityTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: ApplyActivityTemplateInput }) =>
      activityTemplateService.applyTemplate(templateId, data),
    onSuccess: () => {
      // Invalidate activity lists since we created a new activity
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      // Invalidate template lists to update usageCount
      queryClient.invalidateQueries({ queryKey: activityTemplateKeys.lists() });
    },
  });
}
