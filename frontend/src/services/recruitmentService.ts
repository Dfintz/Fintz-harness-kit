/**
 * Recruitment Service
 * Handles recruitment campaign management API calls
 *
 * Created during Sprint 0.5 — raw-axios migration
 */

import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

/**
 * Predefined tag categories for recruitment posts
 */
export interface RecruitmentTagDefinition {
  value: string;
  label: string;
  category: 'focus' | 'playstyle' | 'exclusivity' | 'region';
}

export const RECRUITMENT_TAGS: RecruitmentTagDefinition[] = [
  // Focus tags
  { value: 'cargo', label: 'Cargo', category: 'focus' },
  { value: 'combat', label: 'Combat', category: 'focus' },
  { value: 'medical', label: 'Medical', category: 'focus' },
  { value: 'mining', label: 'Mining', category: 'focus' },
  { value: 'piracy', label: 'Piracy', category: 'focus' },
  { value: 'social', label: 'Social', category: 'focus' },
  { value: 'racing', label: 'Racing', category: 'focus' },
  { value: 'salvage', label: 'Salvage', category: 'focus' },
  { value: 'trading', label: 'Trading', category: 'focus' },
  { value: 'exploration', label: 'Exploration', category: 'focus' },
  { value: 'bounty_hunting', label: 'Bounty Hunting', category: 'focus' },
  { value: 'security', label: 'Security', category: 'focus' },
  { value: 'transport', label: 'Transport', category: 'focus' },
  // Exclusivity tags
  { value: 'new_player_friendly', label: 'New Player Friendly', category: 'exclusivity' },
  { value: 'experienced_only', label: 'Experienced Only', category: 'exclusivity' },
  // Playstyle tags
  { value: 'roleplay_casual', label: 'Roleplay (Casual)', category: 'playstyle' },
  { value: 'roleplay_serious', label: 'Roleplay (Serious)', category: 'playstyle' },
  { value: 'casual', label: 'Casual', category: 'playstyle' },
  { value: 'semi_casual', label: 'Semi Casual', category: 'playstyle' },
  { value: 'hardcore', label: 'Hardcore', category: 'playstyle' },
  // Region tags
  { value: 'na', label: 'NA', category: 'region' },
  { value: 'eu', label: 'EU', category: 'region' },
  { value: 'oce', label: 'OCE', category: 'region' },
  { value: 'sa', label: 'SA', category: 'region' },
  { value: 'apac', label: 'APAC', category: 'region' },
];

/**
 * Get the MUI chip color for a tag based on its category
 */
export function getTagChipColor(
  tagValue: string
): 'info' | 'warning' | 'success' | 'secondary' | 'default' {
  const tagDef = RECRUITMENT_TAGS.find(t => t.value === tagValue);
  if (!tagDef) return 'default';
  switch (tagDef.category) {
    case 'focus':
      return 'info';
    case 'playstyle':
      return 'warning';
    case 'exclusivity':
      return 'success';
    case 'region':
      return 'secondary';
    default:
      return 'default';
  }
}

/**
 * Get the display label for a tag value
 */
export function getTagLabel(tagValue: string): string {
  const tagDef = RECRUITMENT_TAGS.find(t => t.value === tagValue);
  return tagDef?.label ?? tagValue;
}

export interface Recruitment {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  status: string;
  organizationId?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  rolesNeeded?: string[];
  currentApplicants?: number;
  pendingApplicants?: number;
  maxPositions?: number;
  bannerImageUrl?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  hasApplied?: boolean;
  tags?: string[];
  applicationQuestions?: ApplicationQuestion[];
  discordRecruitmentEnabled?: boolean;
  discordInviteUrl?: string;
  discordInviteFormEnabled?: boolean;
}

export interface CreateRecruitmentInput {
  title: string;
  description: string;
  requirements?: string;
  organizationId?: string;
  bannerImageUrl?: string | null;
  rolesNeeded?: string[];
  maxPositions?: number;
  expiresAt?: string;
  tags?: string[];
}

export interface UpdateRecruitmentInput {
  title?: string;
  description?: string;
  requirements?: string;
  bannerImageUrl?: string | null;
  rolesNeeded?: string[];
  maxPositions?: number;
  expiresAt?: string;
  tags?: string[];
}

export interface RecruitmentFilters {
  status?: string;
  searchTerm?: string;
  tags?: string[];
  hasOpenSlots?: boolean;
  organizationId?: string;
}

export interface ApplyToRecruitmentInput {
  message?: string;
  preferredRoles?: string[];
  timezone?: string;
  availablePlaytimes?: string[];
  rsiHandle?: string;
  discordId?: string;
  answers?: Array<{ questionId: string; question: string; answer: string }>;
}

// ============================================================================
// Service
// ============================================================================

class RecruitmentService extends BaseService {
  protected basePath = '/api/v2/recruitment';

  async getRecruitments(filters?: RecruitmentFilters): Promise<Recruitment[]> {
    try {
      this.log('getRecruitments', filters);
      const params: Record<string, unknown> = {};
      if (filters?.status) params.status = filters.status;
      if (filters?.searchTerm) params.searchTerm = filters.searchTerm;
      if (filters?.hasOpenSlots) params.hasOpenSlots = filters.hasOpenSlots;
      if (filters?.tags?.length) params.tags = filters.tags;
      if (filters?.organizationId) params.organizationId = filters.organizationId;
      const response = await apiClient.get<Recruitment[]>(this.basePath, { params });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getRecruitments');
    }
  }

  async createRecruitment(data: CreateRecruitmentInput): Promise<Recruitment> {
    try {
      this.log('createRecruitment', data);
      const response = await apiClient.post<Recruitment>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createRecruitment');
    }
  }

  async updateRecruitment(id: string, data: UpdateRecruitmentInput): Promise<Recruitment> {
    try {
      this.log('updateRecruitment', { id, data });
      const response = await apiClient.put<Recruitment>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateRecruitment');
    }
  }

  async deleteRecruitment(id: string): Promise<void> {
    try {
      this.log('deleteRecruitment', id);
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteRecruitment');
    }
  }

  async updateStatus(id: string, status: string): Promise<Recruitment> {
    try {
      this.log('updateStatus', { id, status });
      const response = await apiClient.put<Recruitment>(`${this.basePath}/${id}/status`, {
        status,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  async apply(id: string, data?: ApplyToRecruitmentInput): Promise<void> {
    try {
      this.log('apply', { id, data });
      await apiClient.post(`${this.basePath}/${id}/apply`, data ?? {});
    } catch (error) {
      this.handleError(error, 'apply');
    }
  }

  async getApplications(
    id: string,
    filters?: { status?: string }
  ): Promise<RecruitmentApplicationsResponse> {
    try {
      this.log('getApplications', { id, filters });
      const params: Record<string, unknown> = {};
      if (filters?.status) params.status = filters.status;
      const response = await apiClient.get<RecruitmentApplicationsResponse>(
        `${this.basePath}/${id}/applications`,
        { params }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getApplications');
    }
  }

  async reviewApplication(
    recruitmentId: string,
    applicationId: string,
    data: ReviewApplicationInput
  ): Promise<RecruitmentApplication> {
    try {
      this.log('reviewApplication', { recruitmentId, applicationId, data });
      const response = await apiClient.put<RecruitmentApplication>(
        `${this.basePath}/${recruitmentId}/applications/${applicationId}`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'reviewApplication');
    }
  }
}

export interface RecruitmentApplication {
  applicationId: string;
  applicantId: string;
  applicantName: string;
  rsiHandle?: string;
  discordId?: string;
  appliedAt: string;
  status: string;
  message?: string;
  answers?: Array<{ questionId: string; question: string; answer: string }>;
  screeningScore?: number;
  screeningPassed?: boolean;
  screeningResults?: Array<{
    criterionId: string;
    criterionName: string;
    passed: boolean;
    actualValue?: string | number | boolean;
    expectedValue?: string | number | boolean;
    reason?: string;
  }>;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  acceptedAt?: string;
  timezone?: string;
  availablePlaytimes?: string[];
  preferredRoles?: string[];
  skills?: Array<{ name: string; category: string; level: string }>;
  careerHours?: Array<{ career: string; hours: number; shipCount: number }>;
}

export interface RecruitmentApplicationsResponse {
  data: RecruitmentApplication[];
  total: number;
}

export interface ReviewApplicationInput {
  action: 'accept' | 'reject' | 'interview';
  notes?: string;
  rejectionReason?: string;
  interviewScheduledAt?: string;
}

export const recruitmentService = new RecruitmentService();
