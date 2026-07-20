/**
 * Shared Account Service
 * Handles shared account management API calls
 *
 * Backend routes: /api/v2/shared-accounts/*
 * Note: Backend endpoints are currently stubs returning empty data.
 * Service is created to match the API contract for future implementation.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface SharedAccount {
  id: string;
  name: string;
  /** Game account display name (v1 field) */
  accountName?: string;
  /** Game account login username (v1 field) */
  accountUsername?: string;
  description?: string;
  organizationId: string;
  accountType?: string;
  balance?: number;
  currency?: string;
  members?: SharedAccountMember[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedAccountMember {
  userId: string;
  username?: string;
  role: SharedAccountMemberRole;
  joinedAt: string;
}

export enum SharedAccountMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  CONTRIBUTOR = 'contributor',
  VIEWER = 'viewer',
}

export interface CreateSharedAccountDTO {
  /** Game account display name */
  accountName: string;
  /** Game account login username */
  accountUsername: string;
  /** Game account password (encrypted at rest) */
  password: string;
  description?: string;
  organizationId: string;
  accountType?: string;
  currency?: string;
}

export interface UpdateSharedAccountDTO {
  description?: string;
  accountType?: string;
  accountName?: string;
  accountUsername?: string;
}

export interface AddMemberDTO {
  userId: string;
  role: SharedAccountMemberRole;
}

export interface UpdateMemberRoleDTO {
  role: SharedAccountMemberRole;
}

export interface SharedAccountAuditEntry {
  id: string;
  accountId: string;
  action: string;
  userId: string;
  username?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Shared Account Service
 *
 * Provides API methods for managing shared accounts,
 * member access, and audit logging.
 */
export class SharedAccountService extends BaseService {
  protected basePath = '/api/v2/shared-accounts';

  // ==================== Account CRUD ====================

  /**
   * List all shared accounts accessible to the user
   */
  async getAccounts(): Promise<SharedAccount[]> {
    try {
      this.log('getAccounts');
      const response = await apiClient.get<SharedAccount[]>(this.basePath);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAccounts');
    }
  }

  /**
   * List shared accounts for a specific organization
   */
  async getAccountsByOrganization(organizationId: string): Promise<SharedAccount[]> {
    try {
      this.log('getAccountsByOrganization', organizationId);
      const response = await apiClient.get<SharedAccount[]>(
        `${this.basePath}/organization/${organizationId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAccountsByOrganization');
    }
  }

  /**
   * Create a new shared account
   */
  async createAccount(data: CreateSharedAccountDTO): Promise<SharedAccount> {
    try {
      this.log('createAccount', data);
      const response = await apiClient.post<SharedAccount>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createAccount');
    }
  }

  /**
   * Get a specific shared account by ID
   */
  async getAccountById(accountId: string): Promise<SharedAccount> {
    try {
      this.log('getAccountById', accountId);
      const response = await apiClient.get<SharedAccount>(`${this.basePath}/${accountId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAccountById');
    }
  }

  /**
   * Update a shared account
   */
  async updateAccount(accountId: string, data: UpdateSharedAccountDTO): Promise<SharedAccount> {
    try {
      this.log('updateAccount', { accountId, data });
      const response = await apiClient.put<SharedAccount>(`${this.basePath}/${accountId}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateAccount');
    }
  }

  /**
   * Delete a shared account
   */
  async deleteAccount(accountId: string): Promise<void> {
    try {
      this.log('deleteAccount', accountId);
      await apiClient.delete(`${this.basePath}/${accountId}`);
    } catch (error) {
      this.handleError(error, 'deleteAccount');
    }
  }

  /**
   * Reveal the password for a shared account
   */
  async getAccountPassword(accountId: string): Promise<string> {
    try {
      this.log('getAccountPassword', accountId);
      const response = await apiClient.get<{ password: string }>(
        `${this.basePath}/${accountId}/password`
      );
      return response.data.password;
    } catch (error) {
      this.handleError(error, 'getAccountPassword');
    }
  }

  // ==================== Member Management ====================

  /**
   * Get all members of a shared account
   */
  async getMembers(accountId: string): Promise<SharedAccountMember[]> {
    try {
      this.log('getMembers', accountId);
      const response = await apiClient.get<SharedAccountMember[]>(
        `${this.basePath}/${accountId}/members`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getMembers');
    }
  }

  /**
   * Add a member to a shared account
   */
  async addMember(accountId: string, data: AddMemberDTO): Promise<SharedAccountMember> {
    try {
      this.log('addMember', { accountId, data });
      const response = await apiClient.post<SharedAccountMember>(
        `${this.basePath}/${accountId}/members`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'addMember');
    }
  }

  /**
   * Remove a member from a shared account
   */
  async removeMember(accountId: string, userId: string): Promise<void> {
    try {
      this.log('removeMember', { accountId, userId });
      await apiClient.delete(`${this.basePath}/${accountId}/members/${userId}`);
    } catch (error) {
      this.handleError(error, 'removeMember');
    }
  }

  /**
   * Update a member's role in a shared account
   */
  async updateMemberRole(
    accountId: string,
    userId: string,
    data: UpdateMemberRoleDTO
  ): Promise<SharedAccountMember> {
    try {
      this.log('updateMemberRole', { accountId, userId, data });
      const response = await apiClient.put<SharedAccountMember>(
        `${this.basePath}/${accountId}/members/${userId}/role`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateMemberRole');
    }
  }

  // ==================== Audit Log ====================

  /**
   * Get audit log for a shared account
   */
  async getAuditLog(accountId: string): Promise<SharedAccountAuditEntry[]> {
    try {
      this.log('getAuditLog', accountId);
      const response = await apiClient.get<SharedAccountAuditEntry[]>(
        `${this.basePath}/${accountId}/audit-log`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAuditLog');
    }
  }
}

// Create singleton instance
export const sharedAccountService = new SharedAccountService();
