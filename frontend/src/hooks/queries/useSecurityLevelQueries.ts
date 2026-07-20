/**
 * Security Level Query Hooks
 *
 * TanStack Query hooks for inter-organization security level management.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import type {
  RevokeSecurityLevelInput,
  SetSecurityLevelInput,
} from '@/services/securityLevelService';
import { securityLevelService } from '@/services/securityLevelService';
import { useMutation, useQuery } from '@tanstack/react-query';
import { securityLevelKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get all security levels
 */
export function useSecurityLevels() {
  return useQuery({
    queryKey: securityLevelKeys.lists(),
    queryFn: () => securityLevelService.getAllSecurityLevels(),
  });
}

/**
 * Hook to get security levels for a specific organization
 */
export function useOrgSecurityLevels(organizationId: string | undefined) {
  return useQuery({
    queryKey: securityLevelKeys.orgLevels(organizationId!),
    queryFn: () => securityLevelService.getOrgSecurityLevels(organizationId!),
    enabled: !!organizationId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to set a security level between organizations
 */
export function useSetSecurityLevel() {  return useMutation({
    mutationFn: (data: SetSecurityLevelInput) => securityLevelService.setSecurityLevel(data),
    meta: { invalidates: [securityLevelKeys.all] },
  });
}

/**
 * Hook to revoke a security level
 */
export function useRevokeSecurityLevel() {  return useMutation({
    mutationFn: (data: RevokeSecurityLevelInput) => securityLevelService.revokeSecurityLevel(data),
    meta: { invalidates: [securityLevelKeys.all] },
  });
}
