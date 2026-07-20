import { apiClient } from '@/services/apiClient';

export interface OrganizationDeletionRequest {
  id: string;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
    type?: string;
  };
  requestedBy: string;
  requester?: {
    id: string;
    username?: string;
    email?: string;
  };
  status:
    | 'pending'
    | 'email_verification_pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | 'failed';
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  approver?: {
    id: string;
    username?: string;
  };
  approvalNotes?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejector?: {
    id: string;
    username?: string;
  };
  rejectionReason?: string;
  scheduledFor?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  requestReason?: string;
  requestIpAddress?: string;
  requestUserAgent?: string;
  failureReason?: string;
  deleteDescendants: boolean;
  dataExportGenerated: boolean;
  exportFilePath?: string;
  exportDownloadToken?: string;
  deletionPreview?: {
    organizationId?: string;
    organizationName?: string;
    descendantCount?: number;
    memberCount?: number;
    shipCount?: number;
    estimatedDataSize?: string;
    willDeleteDescendants?: boolean;
    [key: string]: unknown;
  };
  gracePeriodDays: number;
  emailVerificationToken?: string;
  emailVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeletionPreview {
  organizationId: string;
  organizationName: string;
  descendantCount: number;
  memberCount: number;
  shipCount: number;
  estimatedDataSize: string;
  willDeleteDescendants: boolean;
}

export const organizationDeletionService = {
  /**
   * Get all pending deletion requests (admin only)
   */
  async getPendingDeletionRequests(): Promise<OrganizationDeletionRequest[]> {
    const response = await apiClient.get<
      { data: OrganizationDeletionRequest[] } | OrganizationDeletionRequest[]
    >('/api/v2/admin/organizations/deletion-requests/pending');
    return (response.data as { data: OrganizationDeletionRequest[] }).data || response.data;
  },

  /**
   * Get a specific deletion request by ID (admin only)
   */
  async getDeletionRequest(requestId: string): Promise<OrganizationDeletionRequest> {
    const response = await apiClient.get<
      { data: OrganizationDeletionRequest } | OrganizationDeletionRequest
    >(`/api/v2/admin/organizations/deletion-requests/${requestId}`);
    return (response.data as { data: OrganizationDeletionRequest }).data || response.data;
  },

  /**
   * Approve a deletion request (admin only)
   */
  async approveDeletionRequest(
    requestId: string,
    options: {
      notes?: string;
      generateExport?: boolean;
    } = {}
  ): Promise<OrganizationDeletionRequest> {
    const response = await apiClient.post<
      { data: OrganizationDeletionRequest } | OrganizationDeletionRequest
    >(`/api/v2/admin/organizations/deletion-requests/${requestId}/approve`, {
      notes: options.notes,
      generateExport: options.generateExport !== false,
    });
    return (
      (response.data as { data: OrganizationDeletionRequest }).data ||
      (response.data as OrganizationDeletionRequest)
    );
  },

  /**
   * Reject a deletion request (admin only)
   */
  async rejectDeletionRequest(
    requestId: string,
    reason: string
  ): Promise<OrganizationDeletionRequest> {
    const response = await apiClient.post<
      { data: OrganizationDeletionRequest } | OrganizationDeletionRequest
    >(`/api/v2/admin/organizations/deletion-requests/${requestId}/reject`, { reason });
    return (
      (response.data as { data: OrganizationDeletionRequest }).data ||
      (response.data as OrganizationDeletionRequest)
    );
  },

  /**
   * Get deletion preview for an organization
   */
  async getDeletionPreview(
    organizationId: string,
    deleteDescendants: boolean = false
  ): Promise<DeletionPreview> {
    const response = await apiClient.get<{ data: DeletionPreview } | DeletionPreview>(
      `/api/v2/organizations/${organizationId}/deletion-preview`,
      { params: { deleteDescendants } }
    );
    return (response.data as { data: DeletionPreview }).data || (response.data as DeletionPreview);
  },

  /**
   * Get the latest deletion request for an organization
   */
  async getLatestDeletionRequest(
    organizationId: string
  ): Promise<OrganizationDeletionRequest | null> {
    try {
      const response = await apiClient.get<
        { data: OrganizationDeletionRequest } | OrganizationDeletionRequest
      >(`/api/v2/organizations/${organizationId}/deletion-requests/latest`);
      return (
        (response.data as { data: OrganizationDeletionRequest }).data ||
        (response.data as OrganizationDeletionRequest)
      );
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return null;
        }
      }
      throw error;
    }
  },

  /**
   * Cancel a deletion request (during grace period)
   */
  async cancelDeletionRequest(
    requestId: string,
    reason?: string
  ): Promise<OrganizationDeletionRequest> {
    const response = await apiClient.post<
      { data: OrganizationDeletionRequest } | OrganizationDeletionRequest
    >(`/api/v2/gdpr/cancel-deletion`, { requestId, reason });
    return (
      (response.data as { data: OrganizationDeletionRequest }).data ||
      (response.data as OrganizationDeletionRequest)
    );
  },

  /**
   * Verify email for deletion request
   */
  async verifyEmailConfirmation(token: string): Promise<OrganizationDeletionRequest> {
    const response = await apiClient.post<
      { data: OrganizationDeletionRequest } | OrganizationDeletionRequest
    >(`/api/v2/gdpr/verify-deletion-email`, { token });
    return (
      (response.data as { data: OrganizationDeletionRequest }).data ||
      (response.data as OrganizationDeletionRequest)
    );
  },

  /**
   * Resend email confirmation for deletion request
   */
  async resendEmailConfirmation(requestId: string): Promise<void> {
    await apiClient.post(`/api/v2/gdpr/resend-deletion-confirmation`, { requestId });
  },
};
