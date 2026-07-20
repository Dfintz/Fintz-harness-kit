/**
 * Permission Service
 * Handles permission and role management API calls
 *
 * Migrated from raw axios to apiClient/BaseService pattern (Sprint 0.5)
 */

import { apiClient, ApiClientError } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  category?: string;
}

export interface UserPermission {
  userId: string;
  organizationId: string;
  resource: string;
  action: string;
  scope?: string;
  resourceId?: string;
  permissionId?: string;
  granted: boolean;
  grantedBy?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[]; // Array of "resource:action" strings
  priority: number;
  isSystemRole: boolean;
  organizationId?: string;
}

export interface CheckPermissionInput {
  userId: string;
  organizationId: string;
  resource: string;
  action: string;
}

export interface CheckPermissionResult {
  allowed: boolean;
  reason?: string;
}

export interface GrantPermissionInput {
  organizationId: string;
  userId: string;
  resource: string;
  action: string;
  scope?: string;
  conditions?: string;
  priority?: number;
  expiresAt?: Date;
}

export interface UpdateSecurityLevelInput {
  organizationId: string;
  userId: string;
  securityLevel: number; // 1-10
}

// ============================================================================
// Service
// ============================================================================

/**
 * Permission Service
 *
 * Provides API methods for managing permissions and roles.
 */
export class PermissionService extends BaseService {
  protected basePath = '/api/v2/permissions';

  /**
   * List all available permissions (Admin only)
   */
  async listPermissions(): Promise<Permission[]> {
    try {
      this.log('listPermissions');
      const response = await apiClient.get<{ permissions: Permission[] }>(this.basePath);
      return response.data.permissions || [];
    } catch (error) {
      this.handleError(error, 'listPermissions');
    }
  }

  /**
   * Get permission details
   */
  async getPermission(permissionId: string): Promise<Permission> {
    try {
      this.log('getPermission', permissionId);
      const response = await apiClient.get<Permission>(`${this.basePath}/${permissionId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getPermission');
    }
  }

  /**
   * Check if user has a specific permission
   */
  async checkPermission(input: CheckPermissionInput): Promise<CheckPermissionResult> {
    try {
      this.log('checkPermission', input);
      const response = await apiClient.post<CheckPermissionResult>(`${this.basePath}/check`, input);
      return response.data;
    } catch (error) {
      this.handleError(error, 'checkPermission');
    }
  }

  /**
   * Get all permissions for a user in an organization
   */
  async getUserPermissions(organizationId: string, userId: string): Promise<UserPermission[]> {
    try {
      this.log('getUserPermissions', { organizationId, userId });
      const response = await apiClient.get<{ permissions: UserPermission[] }>(
        `/api/v2/organizations/${organizationId}/users/${userId}/permissions`
      );
      return response.data.permissions || [];
    } catch (error) {
      this.handleError(error, 'getUserPermissions');
    }
  }

  /**
   * Grant a permission to a user
   */
  async grantPermission(input: GrantPermissionInput): Promise<UserPermission> {
    try {
      this.log('grantPermission', input);
      const permissionId = input.scope?.trim()
        ? `${input.resource}:${input.action}:${input.scope.trim()}`
        : `${input.resource}:${input.action}`;

      const response = await apiClient.post<UserPermission>(
        `/api/v2/organizations/${input.organizationId}/users/${input.userId}/permissions`,
        {
          permissionId,
          conditions: input.conditions,
          priority: input.priority,
          expiresAt: input.expiresAt,
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'grantPermission');
    }
  }

  /**
   * Revoke a permission from a user
   */
  async revokePermission(
    organizationId: string,
    userId: string,
    resource: string,
    action: string,
    scope?: string
  ): Promise<void> {
    try {
      this.log('revokePermission', { organizationId, userId, resource, action, scope });
      const permissionId = scope?.trim()
        ? `${resource}:${action}:${scope.trim()}`
        : `${resource}:${action}`;

      await apiClient.delete(
        `/api/v2/organizations/${organizationId}/users/${userId}/permissions`,
        {
          data: { permissionId },
        }
      );
    } catch (error) {
      this.handleError(error, 'revokePermission');
    }
  }

  /**
   * Update user's security level in organization
   */
  async updateSecurityLevel(input: UpdateSecurityLevelInput): Promise<void> {
    try {
      this.log('updateSecurityLevel', input);
      await apiClient.put(
        `/api/v2/organizations/${input.organizationId}/users/${input.userId}/security-level`,
        {
          securityLevel: input.securityLevel,
        }
      );
    } catch (error) {
      this.handleError(error, 'updateSecurityLevel');
    }
  }

  /**
   * Get all roles in an organization
   */
  async getOrganizationRoles(organizationId: string): Promise<Role[]> {
    try {
      this.log('getOrganizationRoles', organizationId);
      const response = await apiClient.get<{ roles: Role[] }>(
        `/api/v2/organizations/${organizationId}/roles`
      );
      return response.data.roles || [];
    } catch (error) {
      this.handleError(error, 'getOrganizationRoles');
    }
  }

  /**
   * Create a new role
   */
  async createRole(organizationId: string, roleData: Partial<Role>): Promise<Role> {
    try {
      this.log('createRole', { organizationId, roleData });
      const response = await apiClient.post<Role>(
        `/api/v2/organizations/${organizationId}/roles`,
        roleData
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'createRole');
    }
  }

  /**
   * Update a role
   */
  async updateRole(organizationId: string, roleId: string, updates: Partial<Role>): Promise<Role> {
    try {
      this.log('updateRole', { organizationId, roleId, updates });
      const response = await apiClient.put<Role>(
        `/api/v2/organizations/${organizationId}/roles/${roleId}`,
        updates
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateRole');
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(organizationId: string, roleId: string): Promise<void> {
    try {
      this.log('deleteRole', { organizationId, roleId });
      await apiClient.delete(`/api/v2/organizations/${organizationId}/roles/${roleId}`);
    } catch (error) {
      this.handleError(error, 'deleteRole');
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(organizationId: string, userId: string, roleId: string): Promise<void> {
    try {
      this.log('assignRole', { organizationId, userId, roleId });
      await apiClient.post(`/api/v2/organizations/${organizationId}/members/${userId}/role`, {
        roleId,
      });
    } catch (error) {
      this.handleError(error, 'assignRole');
    }
  }

  /**
   * Get user's role in organization
   */
  async getUserRole(organizationId: string, userId: string): Promise<Role | null> {
    try {
      this.log('getUserRole', { organizationId, userId });
      const response = await apiClient.get<{ role: Role }>(
        `/api/v2/organizations/${organizationId}/members/${userId}/role`
      );
      return response.data.role;
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 404) {
        return null;
      }
      this.handleError(error, 'getUserRole');
    }
  }

  // =========================================================================
  // Role Permissions
  // =========================================================================

  /**
   * Get all permissions assigned to a role
   */
  async getRolePermissions(roleId: string): Promise<{
    roleId: string;
    roleName: string;
    permissions: string[];
    count: number;
    isSystemRole: boolean;
    priority: number;
  }> {
    try {
      this.log('getRolePermissions', { roleId });
      const response = await apiClient.get<{
        roleId: string;
        roleName: string;
        permissions: string[];
        count: number;
        isSystemRole: boolean;
        priority: number;
      }>(`/api/v2/roles/${roleId}/permissions`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getRolePermissions');
    }
  }

  /**
   * Add a permission to a role
   */
  async addPermissionToRole(
    roleId: string,
    permissionId: string
  ): Promise<{ roleId: string; roleName: string; permissionId: string; permissions: string[] }> {
    try {
      this.log('addPermissionToRole', { roleId, permissionId });
      const response = await apiClient.post<{
        roleId: string;
        roleName: string;
        permissionId: string;
        permissions: string[];
      }>(`/api/v2/roles/${roleId}/permissions`, { permissionId });
      return response.data;
    } catch (error) {
      this.handleError(error, 'addPermissionToRole');
    }
  }

  /**
   * Remove a permission from a role
   */
  async removePermissionFromRole(
    roleId: string,
    permissionId: string
  ): Promise<{
    roleId: string;
    roleName: string;
    removedPermissionId: string;
    permissions: string[];
  }> {
    try {
      this.log('removePermissionFromRole', { roleId, permissionId });
      const response = await apiClient.delete<{
        roleId: string;
        roleName: string;
        removedPermissionId: string;
        permissions: string[];
      }>(`/api/v2/roles/${roleId}/permissions/${permissionId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'removePermissionFromRole');
    }
  }

  /**
   * Get available role templates
   */
  async getRoleTemplates(): Promise<{
    templates: import('@/types/apiV2').RoleTemplate[];
    count: number;
  }> {
    try {
      this.log('getRoleTemplates');
      const response = await apiClient.get<{
        templates: import('@/types/apiV2').RoleTemplate[];
        count: number;
      }>('/api/v2/roles/templates');
      return response.data;
    } catch (error) {
      this.handleError(error, 'getRoleTemplates');
    }
  }

  /**
   * Apply a role template to create a new role
   */
  async applyRoleTemplate(
    templateId: string,
    data: import('@/types/apiV2').ApplyRoleTemplateInput
  ): Promise<import('@/types/apiV2').ApplyRoleTemplateResponse> {
    try {
      this.log('applyRoleTemplate', { templateId, ...data });
      const response = await apiClient.post<import('@/types/apiV2').ApplyRoleTemplateResponse>(
        `/api/v2/roles/templates/${templateId}/apply`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'applyRoleTemplate');
    }
  }
}

// Create singleton instance
export const permissionService = new PermissionService();
