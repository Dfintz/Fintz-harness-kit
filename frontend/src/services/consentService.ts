/**
 * Consent Service
 * Handles GDPR consent management API calls
 *
 * Cleaned up to use apiClient instead of raw axios (Sprint 0.5)
 */

import { logger } from '@/utils/logger';

import { apiClient, ApiClientError } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

// Consent types matching the backend enum
export enum ConsentType {
  ESSENTIAL = 'essential',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  THIRD_PARTY = 'third_party',
  DATA_PROCESSING = 'data_processing',
}

export interface Consent {
  type: ConsentType;
  granted: boolean;
  purpose?: string;
  version?: string;
  grantedAt?: string;
  updatedAt?: string;
  expiresAt?: string | null;
}

export interface ConsentRecord {
  consentType: ConsentType;
  granted: boolean;
  purpose?: string;
  version?: string;
}

export interface ConsentResponse {
  message: string;
  consent: {
    type: ConsentType;
    granted: boolean;
    updatedAt: string;
  };
}

export interface ConsentsListResponse {
  consents: Consent[];
}

export interface ConsentVersionStatus {
  hasConsent: boolean;
  isCurrentVersion: boolean;
  consentedVersion?: string;
  currentVersion: string;
  requiresRenewal: boolean;
}

export interface DataDeletionPreview {
  totalRecords: number;
  tables: Record<string, number>;
}

export interface DataDeletionResponse {
  message: string;
  deletionRequestedAt?: string;
  estimatedDeletionDate?: string;
  dataPreview?: DataDeletionPreview;
  deletedCounts?: Record<string, number>;
  totalDeleted?: number;
  completedAt?: string;
  note?: string;
}

export interface DataExportResponse {
  user: Record<string, unknown>;
  consents: Consent[];
  ships: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  organizations: Record<string, unknown>[];
  activityLogs: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  exportedAt: string;
  dataExportVersion: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Consent Service
 *
 * Provides API methods for GDPR consent management, data export,
 * and account deletion.
 */
class ConsentService extends BaseService {
  protected basePath = '/api/v2/gdpr';

  /**
   * Record or update a consent preference
   */
  public async recordConsent(
    consentType: ConsentType,
    granted: boolean,
    purpose?: string,
    version?: string
  ): Promise<ConsentResponse> {
    try {
      this.log('recordConsent', { consentType, granted });
      const response = await apiClient.post<ConsentResponse>(`${this.basePath}/consent`, {
        consentType,
        granted,
        purpose,
        version,
      });
      // apiClient already unwraps response.data; handle both wrapped and unwrapped
      const raw = response as unknown as Record<string, unknown>;
      return (raw.data ?? raw) as ConsentResponse;
    } catch (error) {
      this.handleError(error, 'recordConsent');
    }
  }

  /**
   * Get all user consents
   */
  public async getUserConsents(): Promise<Consent[]> {
    try {
      this.log('getUserConsents');
      const response = await apiClient.get<ConsentsListResponse>(`${this.basePath}/consent`);

      // apiClient already unwraps response.data; handle both wrapped and unwrapped
      const raw = response as unknown as Record<string, unknown>;
      const data = (raw.data as ConsentsListResponse) ?? (raw as unknown as ConsentsListResponse);

      if (!data?.consents) {
        logger.warn('[getUserConsents] Missing consents property:', data);
        return [];
      }

      return data.consents;
    } catch (error) {
      this.handleError(error, 'getUserConsents');
    }
  }

  /**
   * Check if user has specific consent
   */
  public async checkConsent(consentType: ConsentType): Promise<boolean> {
    try {
      this.log('checkConsent', { consentType });
      const response = await apiClient.get<{ consentType: string; granted: boolean }>(
        `${this.basePath}/consent/${consentType}`
      );
      // apiClient already unwraps response.data; handle both wrapped and unwrapped
      const raw = response as unknown as Record<string, unknown>;
      const data = (raw.data ?? raw) as { granted: boolean };
      return data.granted;
    } catch (error) {
      // If error is 404 or other, assume no consent
      if (error instanceof ApiClientError && error.statusCode === 404) {
        return false;
      }
      this.handleError(error, 'checkConsent');
    }
  }

  /**
   * Withdraw consent for a specific type
   */
  public async withdrawConsent(
    consentType: ConsentType,
    purpose?: string
  ): Promise<ConsentResponse> {
    return this.recordConsent(consentType, false, purpose);
  }

  /**
   * Withdraw all consents (GDPR right to object)
   */
  public async withdrawAllConsents(): Promise<void> {
    try {
      this.log('withdrawAllConsents');
      const consents = await this.getUserConsents();

      // Withdraw each non-essential consent
      const withdrawPromises = consents
        .filter(c => c.type !== ConsentType.ESSENTIAL && c.granted)
        .map(c => this.withdrawConsent(c.type, 'User requested withdrawal'));

      await Promise.all(withdrawPromises);
    } catch (error) {
      this.handleError(error, 'withdrawAllConsents');
    }
  }

  /**
   * Request data export (GDPR right to data portability)
   */
  public async requestDataExport(): Promise<DataExportResponse> {
    try {
      this.log('requestDataExport');
      const response = await apiClient.get<DataExportResponse>(`${this.basePath}/export`);
      // apiClient already unwraps response.data; handle both wrapped and unwrapped
      const raw = response as unknown as Record<string, unknown>;
      return (raw.data ?? raw) as DataExportResponse;
    } catch (error) {
      this.handleError(error, 'requestDataExport');
    }
  }

  /**
   * Request account deletion (GDPR right to be forgotten)
   * @param immediate If true, deletes immediately. Otherwise, schedules for 30-day grace period.
   */
  public async requestAccountDeletion(immediate: boolean = false): Promise<DataDeletionResponse> {
    try {
      this.log('requestAccountDeletion', { immediate });
      const response = await apiClient.delete<DataDeletionResponse>(
        `${this.basePath}/delete-account`,
        {
          data: {
            confirm: 'DELETE',
            immediate,
          },
        }
      );
      // apiClient already unwraps response.data; handle both wrapped and unwrapped
      const raw = response as unknown as Record<string, unknown>;
      return (raw.data ?? raw) as DataDeletionResponse;
    } catch (error) {
      this.handleError(error, 'requestAccountDeletion');
    }
  }

  /**
   * Download user data as JSON file
   */
  public async downloadUserData(): Promise<void> {
    try {
      const data = await this.requestDataExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // CWE-79: Strict blob URL validation before DOM assignment
      // Only blob: scheme URLs created by this browser context are safe
      if (!url || typeof url !== 'string' || !url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
        throw new Error('Invalid blob URL generated — possible XSS vector');
      }

      const link = document.createElement('a');
      link.href = url; // NOSONAR: CWE-79 false positive — url is a blob: URL from URL.createObjectURL(), validated above with startsWith('blob:')
      link.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
      link.rel = 'noopener noreferrer';

      // Safely append, click, and remove in a try/finally to ensure cleanup
      try {
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      this.handleError(error, 'downloadUserData');
    }
  }

  /**
   * Check consent version status
   * Returns whether user needs to re-consent due to policy updates
   */
  public async checkConsentVersion(consentType: ConsentType): Promise<ConsentVersionStatus> {
    try {
      this.log('checkConsentVersion', { consentType });
      const response = await apiClient.get<ConsentVersionStatus>(
        `${this.basePath}/consent/${consentType}/version`
      );
      // apiClient already unwraps response.data; handle both wrapped and unwrapped
      const raw = response as unknown as Record<string, unknown>;
      return (raw.data ?? raw) as ConsentVersionStatus;
    } catch (error) {
      // If endpoint doesn't exist, return a default status
      if (error instanceof ApiClientError && error.statusCode === 404) {
        return {
          hasConsent: false,
          isCurrentVersion: false,
          currentVersion: 'unknown',
          requiresRenewal: true,
        };
      }
      this.handleError(error, 'checkConsentVersion');
    }
  }
}

// Export singleton instance
export const consentService = new ConsentService();
