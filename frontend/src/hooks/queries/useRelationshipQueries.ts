import {
  relationshipService,
  type CreateRelationshipPayload,
  type OrgSearchResult,
  type RelationshipHistoryEntry,
  type RelationshipsResponse,
  type UpdateRelationshipPayload,
} from '@/services/relationshipService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { relationshipKeys } from './queryKeys';

// Re-export types for convenience
export type {
  CreateRelationshipPayload,
  OrgSearchResult,
  Relationship,
  RelationshipHistoryEntry,
  RelationshipsResponse,
  UpdateRelationshipPayload,
} from '@/services/relationshipService';

/* ── Queries ── */

export function useOrgRelationships(orgId: string | undefined) {
  const id = orgId ?? '';
  return useQuery<RelationshipsResponse>({
    queryKey: relationshipKeys.list(id),
    queryFn: () => relationshipService.getOrgRelationships(id),
    enabled: !!orgId,
  });
}

export function useRelationshipHistory(relationshipId: string | undefined) {
  const id = relationshipId ?? '';
  return useQuery<RelationshipHistoryEntry[]>({
    queryKey: relationshipKeys.history(id),
    queryFn: () => relationshipService.getRelationshipHistory(id),
    enabled: !!relationshipId,
  });
}

export function useOrgSearch(query: string) {
  return useQuery<OrgSearchResult[]>({
    queryKey: relationshipKeys.orgSearch(query),
    queryFn: () => relationshipService.searchOrgs(query),
    enabled: query.trim().length >= 2,
  });
}

/* ── Mutations ── */

export function useCreateRelationship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRelationshipPayload) =>
      relationshipService.createRelationship(payload),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: relationshipKeys.list(organizationId) });
    },
  });
}

export function useUpdateRelationship(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRelationshipPayload }) =>
      relationshipService.updateRelationship(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: relationshipKeys.list(orgId) });
      queryClient.invalidateQueries({ queryKey: relationshipKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: relationshipKeys.history(id) });
    },
  });
}

export function useTerminateRelationship(orgId: string) {  return useMutation({
    mutationFn: (id: string) => relationshipService.terminateRelationship(id),
    meta: { invalidates: [relationshipKeys.list(orgId)] },
  });
}
