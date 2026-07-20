/**
 * Intel Vault Service
 * Handles Intel Vault API calls for entries, officers, and audit logs
 *
 * Migrated from raw axios to apiClient/BaseService pattern (Sprint 0.5)
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface IntelAccessCheck {
  hasAccess: boolean;
  reason?: string;
  accessLevel?: string;
  isOwner?: boolean;
  isIntelOfficer?: boolean;
  officerRank?: string;
}

export interface IntelEntry {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  classification: string;
  category: string;
  tags?: string[];
  location?: string;
  eventDate?: Date;
  isArchived: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IntelOfficer {
  id: string;
  organizationId: string;
  userId: string;
  rank: string;
  accessLevel: string;
  isActive: boolean;
  specializations?: string;
  appointedBy: string;
  revokedBy?: string;
  revokedAt?: Date;
  notes?: string;
  appointedAt: Date;
  updatedAt: Date;
}

export interface IntelAuditLog {
  id: string;
  organizationId: string;
  userId: string;
  intelEntryId?: string;
  action: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface GetEntriesOptions {
  includeArchived?: boolean;
  classification?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetAuditLogsOptions {
  intelEntryId?: string;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CreateEntryInput {
  title: string;
  content: string;
  classification: string;
  category: string;
  tags?: string[];
  location?: string;
  eventDate?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateEntryInput {
  title?: string;
  content?: string;
  classification?: string;
  category?: string;
  tags?: string[];
  location?: string;
  eventDate?: string;
  isArchived?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AppointOfficerInput {
  userId: string;
  rank: string;
  accessLevel: string;
  specializations?: string[];
  notes?: string;
}

export interface UpdateOfficerInput {
  rank?: string;
  accessLevel?: string;
  specializations?: string[];
  notes?: string;
  isActive?: boolean;
}

// ============================================================================
// Service
// ============================================================================

class IntelVaultService extends BaseService {
  // All methods use orgIntelPath() with org-scoped V2 paths instead of basePath
  protected basePath = '/api/v2/intel';

  private orgIntelPath(orgId: string): string {
    return `/api/v2/organizations/${orgId}/intel`;
  }

  // ==================== INTEL ENTRIES ====================

  async checkAccess(orgId: string): Promise<IntelAccessCheck> {
    try {
      this.log('checkAccess', { orgId });
      const response = await apiClient.get<IntelAccessCheck>(`${this.orgIntelPath(orgId)}/access`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'checkAccess');
    }
  }

  async createEntry(orgId: string, data: CreateEntryInput): Promise<IntelEntry> {
    try {
      this.log('createEntry', { orgId });
      const response = await apiClient.post<IntelEntry>(
        `${this.orgIntelPath(orgId)}/entries`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'createEntry');
    }
  }

  async getEntries(
    orgId: string,
    options: GetEntriesOptions = {}
  ): Promise<{ entries: IntelEntry[]; total: number }> {
    try {
      this.log('getEntries', { orgId, options });
      const queryString = this.buildQueryString({
        includeArchived: options.includeArchived || undefined,
        classification: options.classification,
        category: options.category,
        search: options.search,
        limit: options.limit,
        offset: options.offset,
      });
      const response = await apiClient.get<{ entries: IntelEntry[]; total: number }>(
        `${this.orgIntelPath(orgId)}/entries${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getEntries');
    }
  }

  async getEntry(orgId: string, entryId: string): Promise<IntelEntry> {
    try {
      this.log('getEntry', { orgId, entryId });
      const response = await apiClient.get<IntelEntry>(
        `${this.orgIntelPath(orgId)}/entries/${entryId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getEntry');
    }
  }

  async updateEntry(orgId: string, entryId: string, data: UpdateEntryInput): Promise<IntelEntry> {
    try {
      this.log('updateEntry', { orgId, entryId });
      const response = await apiClient.patch<IntelEntry>(
        `${this.orgIntelPath(orgId)}/entries/${entryId}`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateEntry');
    }
  }

  async deleteEntry(orgId: string, entryId: string): Promise<void> {
    try {
      this.log('deleteEntry', { orgId, entryId });
      await apiClient.delete(`${this.orgIntelPath(orgId)}/entries/${entryId}`);
    } catch (error) {
      this.handleError(error, 'deleteEntry');
    }
  }

  // ==================== INTEL OFFICERS ====================

  async appointOfficer(orgId: string, data: AppointOfficerInput): Promise<IntelOfficer> {
    try {
      this.log('appointOfficer', { orgId });
      const response = await apiClient.post<IntelOfficer>(
        `${this.orgIntelPath(orgId)}/officers`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'appointOfficer');
    }
  }

  async getOfficers(
    orgId: string,
    options: { includeInactive?: boolean; rank?: string } = {}
  ): Promise<IntelOfficer[]> {
    try {
      this.log('getOfficers', { orgId, options });
      const queryString = this.buildQueryString({
        includeInactive: options.includeInactive || undefined,
        rank: options.rank,
      });
      const response = await apiClient.get<IntelOfficer[]>(
        `${this.orgIntelPath(orgId)}/officers${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getOfficers');
    }
  }

  async getOfficer(orgId: string, officerId: string): Promise<IntelOfficer> {
    try {
      this.log('getOfficer', { orgId, officerId });
      const response = await apiClient.get<IntelOfficer>(
        `${this.orgIntelPath(orgId)}/officers/${officerId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getOfficer');
    }
  }

  async updateOfficer(
    orgId: string,
    officerId: string,
    data: UpdateOfficerInput
  ): Promise<IntelOfficer> {
    try {
      this.log('updateOfficer', { orgId, officerId });
      const response = await apiClient.patch<IntelOfficer>(
        `${this.orgIntelPath(orgId)}/officers/${officerId}`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateOfficer');
    }
  }

  async removeOfficer(orgId: string, officerId: string, reason?: string): Promise<void> {
    try {
      this.log('removeOfficer', { orgId, officerId });
      await apiClient.delete(`${this.orgIntelPath(orgId)}/officers/${officerId}`, {
        data: { reason },
      });
    } catch (error) {
      this.handleError(error, 'removeOfficer');
    }
  }

  // ==================== AUDIT LOGS ====================

  async getAuditLogs(
    orgId: string,
    options: GetAuditLogsOptions = {}
  ): Promise<{ logs: IntelAuditLog[]; total: number }> {
    try {
      this.log('getAuditLogs', { orgId, options });
      const queryString = this.buildQueryString({
        intelEntryId: options.intelEntryId,
        action: options.action,
        userId: options.userId,
        startDate: options.startDate?.toISOString(),
        endDate: options.endDate?.toISOString(),
        limit: options.limit,
        offset: options.offset,
      });
      const response = await apiClient.get<{ logs: IntelAuditLog[]; total: number }>(
        `${this.orgIntelPath(orgId)}/audit-logs${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAuditLogs');
    }
  }
}

export const intelVaultService = new IntelVaultService();
