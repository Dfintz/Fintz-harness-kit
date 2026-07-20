import { apiClient as api } from './apiClient';
import { extractArrayFromEnvelope, extractPaginationMeta } from './baseService';

import type {
  ApplicationDto,
  ApplicationModeResponse,
  ApplicationSource,
  ApplicationStatus,
} from '@sc-fleet-manager/shared-types';

/**
 * Application Service - API client for application management
 *
 * Handles organization (and future alliance) join application operations via v2 API:
 * - Submit application to join an org (or alliance)
 * - List applications (admin)
 * - Review (approve/reject) applications
 * - Withdraw own application
 * - Check active application status
 * - Get application mode (simple/custom/discord)
 */
export const orgApplicationService = {
  /**
   * Get the application mode for an organization
   */
  async getApplicationMode(orgId: string): Promise<ApplicationModeResponse> {
    const response = await api.get<ApplicationModeResponse>(
      `/api/v2/organizations/${orgId}/application-mode`
    );
    return response.data;
  },

  /**
   * Submit an application to join an organization
   */
  async submitApplication(
    orgId: string,
    message?: string,
    formResponses?: Record<string, string>,
    source?: ApplicationSource
  ): Promise<ApplicationDto> {
    const response = await api.post<ApplicationDto>(`/api/v2/organizations/${orgId}/applications`, {
      message,
      formResponses,
      source,
    });
    return response.data;
  },

  /**
   * Get applications for an organization (admin)
   */
  async getApplicationsForOrg(
    orgId: string,
    params?: { status?: ApplicationStatus; page?: number; limit?: number }
  ): Promise<{
    success: boolean;
    data: ApplicationDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = queryString
      ? `/api/v2/organizations/${orgId}/applications?${queryString}`
      : `/api/v2/organizations/${orgId}/applications`;

    const response = await api.get<Record<string, unknown>>(url);

    const envelope = response as unknown as Record<string, unknown>;
    const applications = extractArrayFromEnvelope<ApplicationDto>(envelope.data ?? envelope);
    const meta = extractPaginationMeta(envelope) ?? extractPaginationMeta(envelope.data);

    return {
      success: true,
      data: applications,
      meta: {
        total: meta?.total ?? applications.length,
        page: meta?.page ?? 1,
        limit: meta?.limit ?? 20,
        totalPages: meta?.totalPages ?? 1,
      },
    };
  },

  /**
   * Get current user's org applications
   */
  async getMyApplications(): Promise<{ success: boolean; data: ApplicationDto[] }> {
    const response = await api.get<{ success: boolean; data: ApplicationDto[] }>(
      '/api/v2/users/me/org-applications'
    );
    return response.data;
  },

  /**
   * Check if user has an active application for an org and membership status
   */
  async checkActiveApplication(
    orgId: string
  ): Promise<{ hasActiveApplication: boolean; isMember: boolean }> {
    const response = await api.get<{ hasActiveApplication: boolean; isMember: boolean }>(
      `/api/v2/organizations/${orgId}/applications/check`
    );
    return response.data;
  },

  /**
   * Review (approve/reject) an application (admin)
   */
  async reviewApplication(
    orgId: string,
    appId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ): Promise<ApplicationDto> {
    const response = await api.patch<ApplicationDto>(
      `/api/v2/organizations/${orgId}/applications/${appId}/review`,
      { decision, note }
    );
    return response.data;
  },

  /**
   * Withdraw own pending application
   */
  async withdrawApplication(orgId: string, appId: string): Promise<ApplicationDto> {
    const response = await api.post<ApplicationDto>(
      `/api/v2/organizations/${orgId}/applications/${appId}/withdraw`
    );
    return response.data;
  },
};
