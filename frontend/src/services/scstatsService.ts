/**
 * SCStats Service
 *
 * Wave 2.5 — SCStats Integration
 *
 * API client for SCStats import (JSON & CSV), retrieval, and deletion endpoints.
 */

import type {
  OrgSCStatsAnalytics,
  SCStatsCsvImportResult,
  SCStatsCsvPlayerData,
  SCStatsImportResult,
  SCStatsPlayerData,
} from '@sc-fleet-manager/shared-types';

import { apiClient, isApiClientError } from './apiClient';

// Re-export shared types for existing consumers
export type {
  OrgSCStatsAnalytics,
  SCStatsCsvImportResult,
  SCStatsCsvPlayerData,
  SCStatsImportResult,
  SCStatsMetrics,
  SCStatsPlayerData,
  SkillDistribution,
} from '@sc-fleet-manager/shared-types';

/**
 * @deprecated Use SCStatsPlayerData from @sc-fleet-manager/shared-types
 */
export type SCStatsData = SCStatsPlayerData;

/**
 * File inputs for CSV import. At least one file is required.
 */
export interface SCStatsCsvFiles {
  playtime?: File;
  loadoutTop?: File;
  loadoutDetail?: File;
  purchases?: File;
  ships?: File;
}

class SCStatsService {
  // ---------------------------------------------------------------------------
  // JSON import (legacy)
  // ---------------------------------------------------------------------------

  async importData(userId: string, file: File, consent: boolean): Promise<SCStatsImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('consent', String(consent));

    const response = await apiClient.post<SCStatsImportResult>(
      `/api/v2/scstats/users/${userId}/import`,
      formData
    );
    return response.data;
  }

  async getData(userId: string): Promise<SCStatsPlayerData> {
    const response = await apiClient.get<SCStatsPlayerData>(`/api/v2/scstats/users/${userId}`);
    return response.data;
  }

  async deleteData(userId: string): Promise<void> {
    await apiClient.delete(`/api/v2/scstats/users/${userId}`);
  }

  // ---------------------------------------------------------------------------
  // CSV import (SCStats desktop app exports)
  // ---------------------------------------------------------------------------

  /**
   * Import CSV files exported from SCStats desktop app.
   * At least one file is required; previously imported categories are preserved.
   */
  async importCsvData(
    userId: string,
    files: SCStatsCsvFiles,
    consent: boolean
  ): Promise<SCStatsCsvImportResult> {
    const formData = new FormData();
    if (files.playtime) formData.append('playtime', files.playtime);
    if (files.loadoutTop) formData.append('loadoutTop', files.loadoutTop);
    if (files.loadoutDetail) formData.append('loadoutDetail', files.loadoutDetail);
    if (files.purchases) formData.append('purchases', files.purchases);
    if (files.ships) formData.append('ships', files.ships);
    formData.append('consent', String(consent));

    const response = await apiClient.post<SCStatsCsvImportResult>(
      `/api/v2/scstats/users/${userId}/csv-import`,
      formData
    );
    return response.data;
  }

  /**
   * Get CSV-imported SCStats data for a user.
   */
  async getCsvData(userId: string): Promise<SCStatsCsvPlayerData> {
    const response = await apiClient.get<SCStatsCsvPlayerData>(
      `/api/v2/scstats/users/${userId}/csv`
    );
    return response.data;
  }

  /**
   * Delete CSV-imported SCStats data (GDPR).
   */
  async deleteCsvData(userId: string): Promise<void> {
    await apiClient.delete(`/api/v2/scstats/users/${userId}/csv`);
  }

  // ---------------------------------------------------------------------------
  // Organization analytics (shared)
  // ---------------------------------------------------------------------------

  async getOrgAnalytics(organizationId: string): Promise<OrgSCStatsAnalytics> {
    const response = await apiClient.get<OrgSCStatsAnalytics>(
      `/api/v2/scstats/organizations/${organizationId}/analytics`
    );
    return response.data;
  }

  /**
   * Get public org-level analytics (no auth required).
   * Returns null if the org stats are not publicly visible.
   */
  async getPublicOrgAnalytics(organizationId: string): Promise<OrgSCStatsAnalytics | null> {
    try {
      const response = await apiClient.get<OrgSCStatsAnalytics>(
        `/api/v2/scstats/organizations/${organizationId}/analytics/public`
      );
      return response.data;
    } catch (error: unknown) {
      if (isApiClientError(error) && (error.statusCode === 404 || error.statusCode === 403)) {
        return null;
      }
      throw error;
    }
  }
}

export const scstatsService = new SCStatsService();
