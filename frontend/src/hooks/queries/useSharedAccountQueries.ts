/**
 * Shared Account Query Hooks
 *
 * TanStack Query hooks for shared account management with automatic caching
 * and member operations.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import type {
  AddMemberDTO,
  CreateSharedAccountDTO,
  UpdateMemberRoleDTO,
  UpdateSharedAccountDTO,
} from '@/services/sharedAccountService';
import { sharedAccountService } from '@/services/sharedAccountService';
import { useMutation, useQuery } from '@tanstack/react-query';
import { sharedAccountKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to list all shared accounts
 */
export function useSharedAccounts() {
  return useQuery({
    queryKey: sharedAccountKeys.lists(),
    queryFn: () => sharedAccountService.getAccounts(),
  });
}

/**
 * Hook to list shared accounts for a specific organization
 */
export function useSharedAccountsByOrganization(organizationId: string | undefined) {
  return useQuery({
    queryKey: sharedAccountKeys.byOrganization(organizationId!),
    queryFn: () => sharedAccountService.getAccountsByOrganization(organizationId!),
    enabled: !!organizationId,
  });
}

/**
 * Hook to get a specific shared account by ID
 */
export function useSharedAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: sharedAccountKeys.detail(accountId!),
    queryFn: () => sharedAccountService.getAccountById(accountId!),
    enabled: !!accountId,
  });
}

/**
 * Hook to get members of a shared account
 */
export function useSharedAccountMembers(accountId: string | undefined) {
  return useQuery({
    queryKey: sharedAccountKeys.members(accountId!),
    queryFn: () => sharedAccountService.getMembers(accountId!),
    enabled: !!accountId,
  });
}

/**
 * Hook to get audit log for a shared account
 */
export function useSharedAccountAuditLog(accountId: string | undefined) {
  return useQuery({
    queryKey: sharedAccountKeys.auditLog(accountId!),
    queryFn: () => sharedAccountService.getAuditLog(accountId!),
    enabled: !!accountId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a shared account
 */
export function useCreateSharedAccount() {  return useMutation({
    mutationFn: (data: CreateSharedAccountDTO) => sharedAccountService.createAccount(data),
    meta: { invalidates: [sharedAccountKeys.lists()] },
  });
}

/**
 * Hook to update a shared account
 */
export function useUpdateSharedAccount() {  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: UpdateSharedAccountDTO }) =>
      sharedAccountService.updateAccount(accountId, data),
    meta: {
      invalidates: (_data, variables) => [sharedAccountKeys.detail(variables.accountId),, sharedAccountKeys.lists()],
    },
  });
}

/**
 * Hook to delete a shared account
 */
export function useDeleteSharedAccount() {  return useMutation({
    mutationFn: (accountId: string) => sharedAccountService.deleteAccount(accountId),
    meta: { invalidates: [sharedAccountKeys.lists()] },
  });
}

/**
 * Hook to add a member to a shared account
 */
export function useAddSharedAccountMember() {  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: AddMemberDTO }) =>
      sharedAccountService.addMember(accountId, data),
    meta: {
      invalidates: (_data, variables) => [sharedAccountKeys.members(variables.accountId),, sharedAccountKeys.detail(variables.accountId),],
    },
  });
}

/**
 * Hook to remove a member from a shared account
 */
export function useRemoveSharedAccountMember() {  return useMutation({
    mutationFn: ({ accountId, userId }: { accountId: string; userId: string }) =>
      sharedAccountService.removeMember(accountId, userId),
    meta: {
      invalidates: (_data, variables) => [sharedAccountKeys.members(variables.accountId),, sharedAccountKeys.detail(variables.accountId),],
    },
  });
}

/**
 * Hook to update a member's role
 */
export function useUpdateSharedAccountMemberRole() {  return useMutation({
    mutationFn: ({
      accountId,
      userId,
      data,
    }: {
      accountId: string;
      userId: string;
      data: UpdateMemberRoleDTO;
    }) => sharedAccountService.updateMemberRole(accountId, userId, data),
    meta: {
      invalidates: (_data, variables) => [sharedAccountKeys.members(variables.accountId),],
    },
  });
}
