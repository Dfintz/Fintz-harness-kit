/**
 * Role Mapping Query Hooks
 *
 * TanStack Query hooks for RSI rank → web role mapping CRUD operations
 * with automatic caching, background refetching, and cache invalidation.
 */

import { discordService } from '@/services/discordService';
import {
  rsiRoleMappingService,
  type CreateRoleMappingInput,
  type DiscoveredRanks,
  type RoleMappingListResponse,
  type RoleMappingTemplate,
  type UpdateRoleMappingInput,
} from '@/services/rsiRoleMappingService';
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { roleMappingKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch role mappings for an organization
 */
export function useRoleMappings(
  organizationId: string | undefined,
  includeInactive = true,
  options?: Omit<UseQueryOptions<RoleMappingListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: roleMappingKeys.list(organizationId!, { includeInactive }),
    queryFn: () => rsiRoleMappingService.getMappings(organizationId!, includeInactive),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Hook to fetch role mapping templates
 */
export function useRoleMappingTemplates(
  options?: Omit<UseQueryOptions<RoleMappingTemplate[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: roleMappingKeys.templates(),
    queryFn: () => rsiRoleMappingService.getTemplates(),
    ...options,
  });
}

/**
 * Hook to fetch organization roles (for mapping targets)
 */
export function useOrganizationRoles(
  organizationId: string | undefined,
  options?: Omit<
    UseQueryOptions<Array<{ id: string; name: string; description: string }>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: roleMappingKeys.orgRoles(organizationId!),
    queryFn: () => rsiRoleMappingService.getOrganizationRoles(organizationId!),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Hook to fetch Discord guild roles (optional — enabled only when guildId is provided)
 */
export function useDiscordGuildRoles(
  guildId: string | undefined,
  options?: Omit<UseQueryOptions<Array<{ id: string; name: string }>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: roleMappingKeys.discordRoles(guildId!),
    queryFn: () => discordService.getGuildRoles(guildId!),
    enabled: !!guildId,
    ...options,
  });
}

/**
 * Hook to fetch discovered RSI ranks from crawled member data.
 * Returns both text role names and numeric star ranks observed in the org.
 */
export function useDiscoveredRanks(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<DiscoveredRanks>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: roleMappingKeys.discoveredRanks(organizationId!),
    queryFn: () => rsiRoleMappingService.getDiscoveredRanks(organizationId!),
    enabled: !!organizationId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface CreateMappingInput {
  organizationId: string;
  data: CreateRoleMappingInput;
}

interface UpdateMappingInput {
  organizationId: string;
  mappingId: string;
  data: UpdateRoleMappingInput;
}

interface DeleteMappingInput {
  organizationId: string;
  mappingId: string;
}

/**
 * Hook to create a new role mapping
 */
export function useCreateRoleMapping() {  return useMutation({
    mutationFn: ({ organizationId, data }: CreateMappingInput) =>
      rsiRoleMappingService.createMapping(organizationId, data),
    meta: { invalidates: [roleMappingKeys.lists()] },
  });
}

/**
 * Hook to update an existing role mapping
 */
export function useUpdateRoleMapping() {  return useMutation({
    mutationFn: ({ organizationId, mappingId, data }: UpdateMappingInput) =>
      rsiRoleMappingService.updateMapping(organizationId, mappingId, data),
    meta: { invalidates: [roleMappingKeys.lists()] },
  });
}

/**
 * Hook to delete a role mapping
 */
export function useDeleteRoleMapping() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteMappingInput>({
    mutationFn: ({ organizationId, mappingId }: DeleteMappingInput) =>
      rsiRoleMappingService.deleteMapping(organizationId, mappingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleMappingKeys.lists() });
    },
  });
}
