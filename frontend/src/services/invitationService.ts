import { apiClient as api } from './apiClient';

import type { InvitationDto, InvitationStatus } from '@sc-fleet-manager/shared-types';

/**
 * Invitation Service — API client for invitation management
 *
 * Handles organization invitation operations via v2 API:
 * - Send invitation to a user
 * - List invitations (admin)
 * - Approve/reject invitations (admin)
 * - Accept/decline invitations (invitee)
 * - Get user's received invitations
 */
export const invitationService = {
  /**
   * Send an invitation to a user to join an organization
   */
  async sendInvitation(
    orgId: string,
    inviteeUserId: string,
    message?: string
  ): Promise<{ success: boolean; data: InvitationDto }> {
    // NOSONAR — path parameters are validated by Joi schemas at the route level
    // apiClient.post<T> already unwraps axios and returns the JSON envelope { success, data, meta }
    const envelope = await api.post<InvitationDto>(`/api/v2/organizations/${orgId}/invitations`, {
      inviteeUserId,
      message,
    });
    return { success: envelope.success, data: envelope.data };
  },

  /**
   * Get invitations for an organization (admin)
   */
  async getInvitationsForOrg(
    orgId: string,
    params?: { status?: InvitationStatus; page?: number; limit?: number }
  ): Promise<{
    success: boolean;
    data: InvitationDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = queryString
      ? `/api/v2/organizations/${orgId}/invitations?${queryString}`
      : `/api/v2/organizations/${orgId}/invitations`;

    // apiClient.get<T> returns the unwrapped JSON envelope { success, data: T, meta }.
    // Backend includes pagination fields on meta alongside the standard timestamp/requestId.
    const envelope = await api.get<InvitationDto[]>(url);
    const meta = envelope.meta ?? {};
    return {
      success: envelope.success,
      data: envelope.data,
      meta: {
        total: Number(meta.total ?? 0),
        page: Number(meta.page ?? params?.page ?? 1),
        limit: Number(meta.limit ?? params?.limit ?? 10),
        totalPages: Number(meta.totalPages ?? 0),
      },
    };
  },

  /**
   * Get current user's received invitations
   */
  async getMyInvitations(): Promise<InvitationDto[]> {
    const envelope = await api.get<InvitationDto[]>('/api/v2/users/me/invitations');
    return envelope.data ?? [];
  },

  /**
   * Approve a member-sent invitation (admin)
   */
  async approveInvitation(
    orgId: string,
    invitationId: string
  ): Promise<{ success: boolean; data: InvitationDto }> {
    const envelope = await api.patch<InvitationDto>(
      `/api/v2/organizations/${orgId}/invitations/${invitationId}/approve`
    );
    return { success: envelope.success, data: envelope.data };
  },

  /**
   * Reject a member-sent invitation (admin)
   */
  async rejectInvitation(
    orgId: string,
    invitationId: string
  ): Promise<{ success: boolean; data: InvitationDto }> {
    const envelope = await api.patch<InvitationDto>(
      `/api/v2/organizations/${orgId}/invitations/${invitationId}/reject`
    );
    return { success: envelope.success, data: envelope.data };
  },

  /**
   * Accept an invitation (invitee)
   */
  async acceptInvitation(token: string): Promise<{ success: boolean; data: InvitationDto }> {
    const envelope = await api.post<InvitationDto>(`/api/v2/invitations/${token}/accept`);
    return { success: envelope.success, data: envelope.data };
  },

  /**
   * Decline an invitation (invitee)
   */
  async declineInvitation(token: string): Promise<{ success: boolean; data: InvitationDto }> {
    const envelope = await api.post<InvitationDto>(`/api/v2/invitations/${token}/decline`);
    return { success: envelope.success, data: envelope.data };
  },
};
