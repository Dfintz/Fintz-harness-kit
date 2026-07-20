/**
 * Permission Query Hooks
 *
 * TanStack Query hooks for permission management with automatic caching
 * and role-based access control operations.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import type {
  CheckPermissionInput,
  GrantPermissionInput,
  Role,
  UpdateSecurityLevelInput,
} from '@/services/permissionService';
import { permissionService } from '@/services/permissionService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationKeys, permissionKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to list all available permissions
 */
export function usePermissions() {
  return useQuery({
    queryKey: permissionKeys.lists(),
    queryFn: () => permissionService.listPermissions(),
  });
}

/**
 * Hook to get a single permission by ID
 */
export function usePermission(permissionId: string | undefined) {
  return useQuery({
    queryKey: permissionKeys.detail(permissionId!),
    queryFn: () => permissionService.getPermission(permissionId!),
    enabled: !!permissionId,
  });
}

/**
 * Hook to check if a user has a specific permission
 */
export function useCheckPermission(input: CheckPermissionInput | undefined) {
  return useQuery({
    queryKey: permissionKeys.check(input?.userId ?? '', input?.resource ?? ''),
    queryFn: () => permissionService.checkPermission(input!),
    enabled: !!input?.userId && !!input?.resource && !!input?.action,
  });
}

/**
 * Hook to get all permissions for a user
 */
export function useUserPermissions(organizationId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: permissionKeys.userPermissions(userId!),
    queryFn: () => permissionService.getUserPermissions(organizationId!, userId!),
    enabled: !!organizationId && !!userId,
  });
}

/**
 * Hook to get organization roles
 */
export function useOrganizationRoles(organizationId: string | undefined) {
  return useQuery({
    queryKey: permissionKeys.roles(organizationId!),
    queryFn: () => permissionService.getOrganizationRoles(organizationId!),
    enabled: !!organizationId,
  });
}

/**
 * Hook to get a user's role in an organization
 */
export function useUserRole(organizationId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: permissionKeys.userRole(organizationId!, userId!),
    queryFn: () => permissionService.getUserRole(organizationId!, userId!),
    enabled: !!organizationId && !!userId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to grant a permission to a user
 */
export function useGrantPermission() {  return useMutation({
    mutationFn: (data: GrantPermissionInput) => permissionService.grantPermission(data),
    meta: {
      invalidates: (_data, variables) => [permissionKeys.userPermissions(variables.userId),],
    },
  });
}

/**
 * Hook to revoke a permission from a user
 */
export function useRevokePermission() {  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
      resource,
      action,
      scope,
    }: {
      organizationId: string;
      userId: string;
      resource: string;
      action: string;
      scope?: string;
    }) => permissionService.revokePermission(organizationId, userId, resource, action, scope),
    meta: {
      invalidates: (_data, variables) => [permissionKeys.userPermissions(variables.userId),],
    },
  });
}

/**
 * Hook to update a security level
 */
export function useUpdateSecurityLevel() {  return useMutation({
    mutationFn: (data: UpdateSecurityLevelInput) => permissionService.updateSecurityLevel(data),
    meta: { invalidates: [permissionKeys.all] },
  });
}

/**
 * Hook to create a role in an organization
 */
export function useCreateRole() {  return useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: Partial<Role> }) =>
      permissionService.createRole(organizationId, data),
    meta: {
      invalidates: (_data, variables) => [permissionKeys.roles(variables.organizationId),],
    },
  });
}

/**
 * Hook to update a role
 */
export function useUpdateRole() {  return useMutation({
    mutationFn: ({
      organizationId,
      roleId,
      data,
    }: {
      organizationId: string;
      roleId: string;
      data: Partial<Role>;
    }) => permissionService.updateRole(organizationId, roleId, data),
    meta: {
      invalidates: (_data, variables) => [permissionKeys.roles(variables.organizationId),],
    },
  });
}

/**
 * Hook to delete a role
 */
export function useDeleteRole() {  return useMutation({
    mutationFn: ({ organizationId, roleId }: { organizationId: string; roleId: string }) =>
      permissionService.deleteRole(organizationId, roleId),
    meta: {
      invalidates: (_data, variables) => [permissionKeys.roles(variables.organizationId),],
    },
  });
}

/**
 * Hook to assign a role to a user
 */
export function useAssignRole() {  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
      roleId,
    }: {
      organizationId: string;
      userId: string;
      roleId: string;
    }) => permissionService.assignRole(organizationId, userId, roleId),
    meta: {
      invalidates: (_data, variables) => [permissionKeys.userRole(variables.organizationId, variables.userId),, organizationKeys.members(variables.organizationId),],
    },
  });
}

// =========================================================================
// Role Permission hooks
// =========================================================================

/**
 * Hook to get all permissions for a role
 */
export function useRolePermissions(roleId: string | undefined) {
  return useQuery({
    queryKey: permissionKeys.rolePermissions(roleId ?? ''),
    queryFn: () => permissionService.getRolePermissions(roleId!),
    enabled: !!roleId,
  });
}

/**
 * Hook to add a permission to a role
 */
export function useAddPermissionToRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      permissionService.addPermissionToRole(roleId, permissionId),
    onSuccess: (_data, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.rolePermissions(roleId) });
    },
  });
}

/**
 * Hook to remove a permission from a role
 */
export function useRemovePermissionFromRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      permissionService.removePermissionFromRole(roleId, permissionId),
    onSuccess: (_data, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.rolePermissions(roleId) });
    },
  });
}

// ============================================================================
// Role Template Hooks (Sprint 19-A)
// ============================================================================

/**
 * Hook to fetch available role templates
 */
export function useRoleTemplates() {
  return useQuery({
    queryKey: permissionKeys.roleTemplates(),
    queryFn: () => permissionService.getRoleTemplates(),
  });
}

/**
 * Hook to apply a role template to create a new role
 */
export function useApplyRoleTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      roleName,
      organizationId,
    }: {
      templateId: string;
      roleName: string;
      organizationId: string;
    }) => permissionService.applyRoleTemplate(templateId, { roleName, organizationId }),
    onSuccess: (_data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.roles(organizationId) });
      queryClient.invalidateQueries({ queryKey: permissionKeys.roleTemplates() });
    },
  });
}
