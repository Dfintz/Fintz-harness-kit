import { apiClient } from './apiClient';
import { BaseService, extractArrayFromEnvelope, extractPaginationMeta } from './baseService';

// ============================================================================
// Types
// ============================================================================

export type AnnouncementStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled';
export type AnnouncementTargetType = 'single' | 'multiple' | 'all' | 'alliance';

export interface AnnouncementEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface AnnouncementEmbedConfig {
  color?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  authorName?: string;
  authorIconUrl?: string;
  authorUrl?: string;
  fields?: AnnouncementEmbedField[];
}

export interface AnnouncementDeliveryResult {
  guildId: string;
  channelId?: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface Announcement {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  embedConfig?: AnnouncementEmbedConfig;
  targetType: AnnouncementTargetType;
  targetIds?: string[];
  status: AnnouncementStatus;
  createdBy: string;
  createdByName?: string;
  scheduledAt?: string;
  sentAt?: string;
  pinnedAt?: string;
  pinnedBy?: string;
  deliveryResults?: AnnouncementDeliveryResult[];
  createdAt: string;
  isPending?: boolean;
  isDelivered?: boolean;
  totalTargets?: number;
  successfulDeliveries?: number;
  failedDeliveries?: number;
  isPinned?: boolean;
}

export interface AnnouncementTemplate {
  id: string;
  organizationId?: string;
  name: string;
  title?: string;
  content: string;
  embedConfig?: AnnouncementEmbedConfig;
  isGlobal: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementStats {
  total: number;
  draft: number;
  scheduled: number;
  sent: number;
  failed: number;
  cancelled: number;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  embedConfig?: AnnouncementEmbedConfig;
  targetType?: AnnouncementTargetType;
  targetIds?: string[];
  scheduledAt?: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  embedConfig?: AnnouncementEmbedConfig;
  targetType?: AnnouncementTargetType;
  targetIds?: string[];
  scheduledAt?: string;
}

export interface AnnouncementFilters {
  page?: number;
  limit?: number;
  status?: AnnouncementStatus;
  targetType?: AnnouncementTargetType;
  createdBy?: string;
}

export interface PaginatedAnnouncementResponse {
  announcements: Announcement[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PublishAnnouncementInput {
  channelId: string;
}

// ============================================================================
// Service
// ============================================================================

class AnnouncementService extends BaseService {
  protected basePath = '/api/v2/announcements';

  async getAnnouncements(filters?: AnnouncementFilters): Promise<PaginatedAnnouncementResponse> {
    try {
      this.log('getAnnouncements', filters);
      const response = await apiClient.get<Record<string, unknown>>(this.basePath, {
        params: filters,
      });

      const envelope = response as unknown as Record<string, unknown>;
      const announcements = extractArrayFromEnvelope<Announcement>(envelope.data ?? envelope);
      const pagination = extractPaginationMeta(envelope) ?? extractPaginationMeta(envelope.data);

      return {
        announcements,
        total: pagination?.total ?? announcements.length,
        page: pagination?.page ?? 1,
        totalPages: pagination?.totalPages ?? 1,
      };
    } catch (error) {
      this.handleError(error, 'getAnnouncements');
    }
  }

  async getAnnouncement(id: string): Promise<Announcement> {
    try {
      this.log('getAnnouncement', { id });
      const response = await apiClient.get<Announcement>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAnnouncement');
    }
  }

  async createAnnouncement(data: CreateAnnouncementInput): Promise<Announcement> {
    try {
      this.log('createAnnouncement', data);
      const response = await apiClient.post<Announcement>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createAnnouncement');
    }
  }

  async updateAnnouncement(id: string, data: UpdateAnnouncementInput): Promise<Announcement> {
    try {
      this.log('updateAnnouncement', { id, data });
      const response = await apiClient.put<Announcement>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateAnnouncement');
    }
  }

  async deleteAnnouncement(id: string): Promise<void> {
    try {
      this.log('deleteAnnouncement', { id });
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteAnnouncement');
    }
  }

  async publishAnnouncement(id: string, data: PublishAnnouncementInput): Promise<Announcement> {
    try {
      this.log('publishAnnouncement', { id, data });
      const response = await apiClient.post<Announcement>(`${this.basePath}/${id}/publish`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'publishAnnouncement');
    }
  }

  async togglePin(id: string): Promise<{ pinned: boolean }> {
    try {
      this.log('togglePin', { id });
      const response = await apiClient.post<{ pinned: boolean }>(`${this.basePath}/${id}/pin`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'togglePin');
    }
  }

  async markRead(id: string): Promise<{ readAt: string }> {
    try {
      this.log('markRead', { id });
      const response = await apiClient.post<{ readAt: string }>(`${this.basePath}/${id}/read`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'markRead');
    }
  }
}

export const announcementService = new AnnouncementService();
