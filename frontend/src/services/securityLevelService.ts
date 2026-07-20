/**
 * Security Level Service
 * Handles inter-organization security level API calls
 *
 * Migrated from raw axios to apiClient/BaseService pattern (Sprint 0.5)
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface SecurityLevel {
  id: string;
  sourceOrgId: string;
  sourceOrgName?: string;
  targetOrgId: string;
  targetOrgName?: string;
  level: number; // 1-10
  resourceType: string; // 'intelligence', 'fleet', 'operations', etc. or '*' for all
  accessLevel: 'none' | 'read' | 'write' | 'full';
  restrictions?: Record<string, unknown>;
  notes?: string;
  isActive: boolean;
  expiresAt?: Date;
  approvedBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetSecurityLevelInput {
  sourceOrgId: string;
  targetOrgId: string;
  level: number; // 1-10
  resourceType?: string; // defaults to '*'
  accessLevel?: 'none' | 'read' | 'write' | 'full'; // defaults to 'read'
  restrictions?: Record<string, unknown>;
  notes?: string;
  expiresAt?: Date;
}

export interface RevokeSecurityLevelInput {
  sourceOrgId: string;
  targetOrgId: string;
  resourceType: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Security Level Service
 *
 * Provides API methods for managing inter-organization security levels
 * and pure helper functions for UI display.
 */
export class SecurityLevelService extends BaseService {
  protected basePath = '/api/v2/security-levels';

  /**
   * Set inter-organization security level (Admin only)
   */
  async setSecurityLevel(input: SetSecurityLevelInput): Promise<SecurityLevel> {
    try {
      this.log('setSecurityLevel', input);
      const response = await apiClient.post<SecurityLevel>(this.basePath, input);
      return response.data;
    } catch (error) {
      this.handleError(error, 'setSecurityLevel');
    }
  }

  /**
   * Get security levels for an organization
   * Returns both incoming and outgoing security relationships
   */
  async getOrgSecurityLevels(organizationId: string): Promise<SecurityLevel[]> {
    try {
      this.log('getOrgSecurityLevels', organizationId);
      const response = await apiClient.get<{ securityLevels: SecurityLevel[] }>(
        `/api/v2/organizations/${organizationId}/security-levels`
      );
      return response.data.securityLevels || [];
    } catch (error) {
      this.handleError(error, 'getOrgSecurityLevels');
    }
  }

  /**
   * Get all security levels (Admin only)
   */
  async getAllSecurityLevels(): Promise<SecurityLevel[]> {
    try {
      this.log('getAllSecurityLevels');
      const response = await apiClient.get<{ securityLevels: SecurityLevel[] }>(this.basePath);
      return response.data.securityLevels || [];
    } catch (error) {
      this.handleError(error, 'getAllSecurityLevels');
    }
  }

  /**
   * Revoke/deactivate a security level (Admin only)
   */
  async revokeSecurityLevel(input: RevokeSecurityLevelInput): Promise<void> {
    try {
      this.log('revokeSecurityLevel', input);
      await apiClient.delete(this.basePath, { data: input });
    } catch (error) {
      this.handleError(error, 'revokeSecurityLevel');
    }
  }

  // ============================================================================
  // Pure Helpers (no API calls)
  // ============================================================================

  /**
   * Helper: Get security level label
   */
  getSecurityLevelLabel(level: number): string {
    if (level >= 1 && level <= 3) return 'Public/Low';
    if (level >= 4 && level <= 6) return 'Restricted/Medium';
    if (level >= 7 && level <= 9) return 'Confidential/High';
    if (level === 10) return 'Top Secret';
    return 'Unknown';
  }

  /**
   * Helper: Get security level color severity for MUI theme mapping.
   * Returns a MUI palette key ('success' | 'warning' | 'error' | 'text').
   * Consumers should use theme.palette[severity].main to resolve the actual color.
   */
  getSecurityLevelSeverity(level: number): 'success' | 'warning' | 'error' | 'text' {
    if (level >= 1 && level <= 3) return 'success';
    if (level >= 4 && level <= 6) return 'warning';
    if (level >= 7) return 'error';
    return 'text';
  }

  /**
   * Helper: Get access level label
   */
  getAccessLevelLabel(accessLevel: string): string {
    const labels: Record<string, string> = {
      none: 'No Access',
      read: 'Read Only',
      write: 'Read & Write',
      full: 'Full Access',
    };
    return labels[accessLevel] || accessLevel;
  }

  /**
   * Helper: Get access level icon
   */
  getAccessLevelIcon(accessLevel: string): string {
    const icons: Record<string, string> = {
      none: '🚫',
      read: '👁️',
      write: '✏️',
      full: '⚡',
    };
    return icons[accessLevel] || '?';
  }
}

// Create singleton instance
export const securityLevelService = new SecurityLevelService();
