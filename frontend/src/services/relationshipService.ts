/**
 * Relationship Service
 * Handles org-to-org diplomatic relationship API calls (v2 relationships API)
 */

import { logger } from '@/utils/logger';
import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export type RelationshipType =
  | 'allied'
  | 'partnership'
  | 'cooperative'
  | 'affiliated'
  | 'trading_partner'
  | 'neutral'
  | 'observer'
  | 'interested'
  | 'competitive'
  | 'rival'
  | 'hostile'
  | 'war'
  | 'parent'
  | 'subsidiary'
  | 'merger_pending'
  | 'under_negotiation';

export type RelationshipStatus = 'active' | 'pending' | 'suspended' | 'terminated' | 'expired';

export interface RelationshipMetadata {
  tradeVolume?: number;
  sharedEvents?: number;
  cooperativeOperations?: number;
  conflicts?: number;
  treaties?: string[];
  agreements?: string[];
  customFields?: Record<string, unknown>;
}

export interface Relationship {
  id: string;
  organizationId: string;
  targetOrganizationId: string;
  type: RelationshipType;
  status: RelationshipStatus;
  trustScore?: number;
  relationshipStrength?: number;
  interactionCount?: number;
  positiveInteractions?: number;
  negativeInteractions?: number;
  description?: string;
  notes?: string;
  tags?: string[];
  metadata?: RelationshipMetadata;
  // Contact information
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  communicationChannels?: string[];
  // Dates
  establishedDate?: string;
  lastInteractionDate?: string;
  reviewDate?: string;
  expiryDate?: string;
  // Flags
  isMutual?: boolean;
  isPublic?: boolean;
  autoRenew?: boolean;
  // Relations
  targetOrganization?: { id: string; name: string; logoUrl?: string; rsiOrgSid?: string };
  organization?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipHistoryEntry {
  id: string;
  changeType: string;
  description: string;
  previousValue?: string;
  newValue?: string;
  actorName?: string;
  actorId?: string;
  createdAt: string;
}

export interface OrgSearchResult {
  id: string;
  name: string;
  logoUrl?: string;
  memberCount?: number;
  primaryFocus?: string;
}

export interface CreateRelationshipPayload {
  organizationId: string;
  targetOrganizationId: string;
  type: RelationshipType;
  status?: RelationshipStatus;
  description?: string;
  notes?: string;
  tags?: string[];
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  communicationChannels?: string[];
}

export interface UpdateRelationshipPayload {
  type?: RelationshipType;
  status?: RelationshipStatus;
  description?: string;
  notes?: string;
  tags?: string[];
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  communicationChannels?: string[];
  reviewDate?: string;
  expiryDate?: string;
  isPublic?: boolean;
  autoRenew?: boolean;
}

export interface RelationshipsResponse {
  data: Relationship[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// Service
// ============================================================================

class RelationshipService extends BaseService {
  protected basePath = '/api/v2/relationships';

  async getOrgRelationships(orgId: string, page = 1, limit = 50): Promise<RelationshipsResponse> {
    try {
      this.log('getOrgRelationships', { orgId, page, limit });
      const response = await apiClient.get<RelationshipsResponse>(
        `${this.basePath}/organizations/${orgId}/relationships?page=${page}&limit=${limit}`
      );
      return response.data ?? { data: [], total: 0, page: 1, limit };
    } catch (error) {
      logger.error(
        'getOrgRelationships failed',
        error instanceof Error ? error : new Error(String(error))
      );
      return { data: [], total: 0, page: 1, limit };
    }
  }

  async createRelationship(payload: CreateRelationshipPayload): Promise<Relationship> {
    this.log('createRelationship', payload);
    const response = await apiClient.post<Relationship>(this.basePath, payload);
    return response.data;
  }

  async updateRelationship(id: string, payload: UpdateRelationshipPayload): Promise<Relationship> {
    this.log('updateRelationship', { id, ...payload });
    const response = await apiClient.put<Relationship>(`${this.basePath}/${id}`, payload);
    return response.data;
  }

  async terminateRelationship(id: string, reason = 'USER_REQUEST'): Promise<void> {
    this.log('terminateRelationship', { id, reason });
    await apiClient.delete(`${this.basePath}/${id}`, { data: { reason } });
  }

  async getRelationshipHistory(id: string): Promise<RelationshipHistoryEntry[]> {
    try {
      this.log('getRelationshipHistory', { id });
      const response = await apiClient.get<
        { data: RelationshipHistoryEntry[] } | RelationshipHistoryEntry[]
      >(`${this.basePath}/${id}/history?limit=5&page=1`);
      const payload = response.data;
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      return (payload as { data: RelationshipHistoryEntry[] }).data ?? [];
    } catch (error) {
      logger.error(
        'getRelationshipHistory failed',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  async searchOrgs(query: string): Promise<OrgSearchResult[]> {
    try {
      this.log('searchOrgs', { query });
      const response = await apiClient.get<
        | {
            data?: Array<Record<string, unknown>>;
            organizations?: Array<Record<string, unknown>>;
          }
        | Array<Record<string, unknown>>
      >(`/api/v2/directory/organizations?search=${encodeURIComponent(query)}&limit=10&page=1`);
      const payload = response.data;
      if (!payload) return [];
      const items: Array<Record<string, unknown>> = Array.isArray(payload)
        ? payload
        : ((
            payload as {
              data?: Array<Record<string, unknown>>;
              organizations?: Array<Record<string, unknown>>;
            }
          ).data ??
          (
            payload as {
              data?: Array<Record<string, unknown>>;
              organizations?: Array<Record<string, unknown>>;
            }
          ).organizations ??
          []);
      // Map directory response fields to OrgSearchResult
      // organizationId is the canonical org ID; id may be the profile record ID
      return items.map(item => ({
        id: (item.organizationId ?? item.id) as string,
        name: (item.organizationName ?? item.name ?? 'Unknown') as string,
        logoUrl: (item.organizationLogoUrl ?? item.logoUrl) as string | undefined,
        memberCount: item.memberCount as number | undefined,
        primaryFocus: item.primaryFocus as string | undefined,
      }));
    } catch (error) {
      logger.error('searchOrgs failed', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}

export const relationshipService = new RelationshipService();
