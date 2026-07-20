/**
 * Moderation Service
 *
 * Frontend service for the moderation / blacklist subsystem.
 * Maps to /api/v2/moderation/* endpoints.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Enums & Types
// ============================================================================

export type IncidentType = 'WARNING' | 'TIMEOUT' | 'LONG_TIMEOUT' | 'KICK' | 'BAN';
export type IncidentStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  WARNING: 'Warning',
  TIMEOUT: 'Timeout',
  LONG_TIMEOUT: 'Long Timeout',
  KICK: 'Kick',
  BAN: 'Ban',
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Severe',
  5: 'Critical',
};

export interface ModerationIncident {
  id: string;
  organizationId: string;
  guildId: string;
  guildName?: string;
  targetDiscordId: string;
  targetUsername?: string;
  moderatorId: string;
  moderatorDiscordId?: string;
  moderatorUsername?: string;
  incidentType: IncidentType;
  severity: number;
  status: IncidentStatus;
  reason?: string;
  durationMinutes?: number;
  isShared: boolean;
  isAutoDetected: boolean;
  discordAuditLogId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  revokedBy?: string;
  revokedAt?: string;
  revokeReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncidentInput {
  guildId: string;
  guildName?: string;
  targetDiscordId: string;
  targetUsername?: string;
  incidentType: IncidentType;
  reason?: string;
  durationMinutes?: number;
  isShared?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateIncidentInput {
  reason?: string;
  isShared?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IncidentSearchFilters {
  page?: number;
  limit?: number;
  targetDiscordId?: string;
  guildId?: string;
  incidentType?: IncidentType;
  severity?: number;
  status?: IncidentStatus;
  minSeverity?: number;
  isShared?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedIncidentResponse {
  success: boolean;
  data: ModerationIncident[];
  pagination: {
    total: number;
    count: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalPages: number;
  };
}

export interface UserIncidentSummary {
  targetDiscordId: string;
  targetUsername?: string;
  totalIncidents: number;
  activeIncidents: number;
  highestSeverity: number;
  incidentsByType: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  sharedIncidents: number;
  firstIncident?: string;
  lastIncident?: string;
  incidents: ModerationIncident[];
}

export interface TrendDataPoint {
  date: string;
  count: number;
  label?: string;
}

export interface RepeatOffender {
  targetDiscordId: string;
  targetUsername?: string;
  totalIncidents: number;
  activeIncidents: number;
  highestSeverity: number;
  firstIncident: string;
  lastIncident: string;
  incidentsByType: Record<string, number>;
  riskScore: number;
  isHighRisk: boolean;
}

export interface ModerationAnalytics {
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  sharedIncidents: number;
  autoDetectedIncidents: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  dailyTrend: TrendDataPoint[];
  weeklyTrend: TrendDataPoint[];
  monthlyTrend: TrendDataPoint[];
  uniqueTargets: number;
  uniqueModerators: number;
  averageSeverity: number;
  repeatOffenders: RepeatOffender[];
  repeatOffenderCount: number;
  mirrorStats: {
    totalMirrors: number;
    pendingMirrors: number;
    confirmedMirrors: number;
    cancelledMirrors: number;
    failedMirrors: number;
  };
  incidentsLast24Hours: number;
  incidentsLast7Days: number;
  incidentsLast30Days: number;
  generatedAt: string;
}

export interface SharingConfig {
  id: string;
  shareWarnings: boolean;
  shareTimeouts: boolean;
  shareKicks: boolean;
  shareBans: boolean;
  receiveAlerts: boolean;
  minAlertSeverity: number;
  alertChannelId?: string;
  autoShareWithAllies: boolean;
  autoShareMinSeverity: number;
}

export interface UpdateSharingConfigInput {
  shareWarnings?: boolean;
  shareTimeouts?: boolean;
  shareKicks?: boolean;
  shareBans?: boolean;
  receiveAlerts?: boolean;
  minAlertSeverity?: number;
  alertChannelId?: string | null;
  autoShareWithAllies?: boolean;
  autoShareMinSeverity?: number;
}

// ============================================================================
// Service
// ============================================================================

class ModerationService extends BaseService {
  protected basePath = '/api/v2/moderation';

  async searchIncidents(filters?: IncidentSearchFilters): Promise<PaginatedIncidentResponse> {
    try {
      this.log('searchIncidents', filters);
      // Use getRaw because this endpoint returns { success, data, pagination }
      // directly (not wrapped in the ApiResponse envelope). apiClient.get()
      // would double-unwrap and lose the pagination info.
      return await apiClient.getRaw<PaginatedIncidentResponse>(`${this.basePath}/incidents`, {
        params: filters,
      });
    } catch (error) {
      this.handleError(error, 'searchIncidents');
    }
  }

  async getIncident(incidentId: string): Promise<ModerationIncident> {
    try {
      this.log('getIncident', incidentId);
      const response = await apiClient.get<ModerationIncident>(
        `${this.basePath}/incidents/${encodeURIComponent(incidentId)}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getIncident');
    }
  }

  async createIncident(input: CreateIncidentInput): Promise<ModerationIncident> {
    try {
      this.log('createIncident', input);
      const response = await apiClient.post<ModerationIncident>(
        `${this.basePath}/incidents`,
        input
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'createIncident');
    }
  }

  async updateIncident(
    incidentId: string,
    input: UpdateIncidentInput
  ): Promise<ModerationIncident> {
    try {
      this.log('updateIncident', { incidentId, input });
      const response = await apiClient.patch<ModerationIncident>(
        `${this.basePath}/incidents/${encodeURIComponent(incidentId)}`,
        input
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateIncident');
    }
  }

  async revokeIncident(incidentId: string, reason?: string): Promise<ModerationIncident> {
    try {
      this.log('revokeIncident', { incidentId, reason });
      const response = await apiClient.post<ModerationIncident>(
        `${this.basePath}/incidents/${encodeURIComponent(incidentId)}/revoke`,
        { reason }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'revokeIncident');
    }
  }

  async shareIncident(incidentId: string): Promise<ModerationIncident> {
    try {
      this.log('shareIncident', incidentId);
      const response = await apiClient.post<ModerationIncident>(
        `${this.basePath}/incidents/${encodeURIComponent(incidentId)}/share`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'shareIncident');
    }
  }

  async unshareIncident(incidentId: string): Promise<ModerationIncident> {
    try {
      this.log('unshareIncident', incidentId);
      const response = await apiClient.post<ModerationIncident>(
        `${this.basePath}/incidents/${encodeURIComponent(incidentId)}/unshare`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'unshareIncident');
    }
  }

  async lookupUser(discordId: string, includeShared?: boolean): Promise<UserIncidentSummary> {
    try {
      this.log('lookupUser', { discordId, includeShared });
      const response = await apiClient.get<UserIncidentSummary>(
        `${this.basePath}/lookup/${encodeURIComponent(discordId)}`,
        { params: includeShared != null ? { includeShared } : undefined }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'lookupUser');
    }
  }

  async getAnalytics(): Promise<ModerationAnalytics> {
    try {
      this.log('getAnalytics');
      const response = await apiClient.get<ModerationAnalytics>(`${this.basePath}/analytics`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAnalytics');
    }
  }

  async getRepeatOffenders(): Promise<RepeatOffender[]> {
    try {
      this.log('getRepeatOffenders');
      const response = await apiClient.get<RepeatOffender[]>(`${this.basePath}/repeat-offenders`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getRepeatOffenders');
    }
  }

  async getSharingConfig(): Promise<SharingConfig> {
    try {
      this.log('getSharingConfig');
      const response = await apiClient.get<SharingConfig>(`${this.basePath}/sharing/config`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getSharingConfig');
    }
  }

  async updateSharingConfig(input: UpdateSharingConfigInput): Promise<SharingConfig> {
    try {
      this.log('updateSharingConfig', input);
      const response = await apiClient.put<SharingConfig>(`${this.basePath}/sharing/config`, input);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateSharingConfig');
    }
  }
}

export const moderationService = new ModerationService();
