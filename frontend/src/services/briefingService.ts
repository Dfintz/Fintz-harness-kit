/**
 * Briefing Service
 * Handles briefing whiteboard management API calls
 *
 * Created during Sprint 0.5 — raw-axios migration
 */

import { apiClient } from './apiClient';
import { BaseService, unwrapResponse } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface BriefingElement {
  id?: string;
  type: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  content?: string;
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
  /** Tactical unit placement metadata */
  unitType?: string;
  formationSize?: string;
  /** Map reference metadata */
  locationSystem?: string;
  locationCode?: string;
  locationName?: string;
  /** Which page this element belongs to (0-based, defaults to 0). */
  pageIndex?: number;
}

/** Per-page metadata (background image). */
export interface BriefingPageData {
  backgroundImage?: string | null;
}

export type BriefingClassification =
  | 'public'
  | 'restricted'
  | 'confidential'
  | 'secret'
  | 'top_secret';

const BRIEFING_CLASSIFICATIONS: readonly BriefingClassification[] = [
  'public',
  'restricted',
  'confidential',
  'secret',
  'top_secret',
];

const toClassificationLabel = (classification: BriefingClassification): string =>
  classification
    .split('_')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const BRIEFING_CLASSIFICATION_LABELS = BRIEFING_CLASSIFICATIONS.reduce<
  Record<BriefingClassification, string>
>(
  (labels, classification) => {
    labels[classification] = toClassificationLabel(classification);
    return labels;
  },
  {} as Record<BriefingClassification, string>
);

export const BRIEFING_CLASSIFICATION_CHIP_COLORS: Record<
  BriefingClassification,
  'default' | 'info' | 'warning' | 'error'
> = {
  public: 'default',
  restricted: 'info',
  confidential: 'info',
  secret: 'warning',
  top_secret: 'error',
};

export interface Briefing {
  id: string;
  title: string;
  description?: string;
  status: string;
  classification: BriefingClassification;
  operationIds?: string[];
  elements: BriefingElement[];
  version?: number;
  organizationId?: string;
  createdBy?: string;
  creatorId?: string;
  missionId?: string;
  participants?: string[];
  backgroundImage?: string;
  /** Per-page metadata (background images). Elements use pageIndex to associate with a page. */
  pages?: BriefingPageData[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBriefingInput {
  title: string;
  description?: string;
  organizationId?: string;
  classification?: BriefingClassification;
  operationIds?: string[];
  tags?: string[];
}

export interface UpdateBriefingInput {
  title?: string;
  description?: string;
  classification?: BriefingClassification;
  operationIds?: string[];
  elements?: BriefingElement[];
  backgroundImage?: string | null;
  pages?: BriefingPageData[];
  tags?: string[];
}

// ============================================================================
// Service
// ============================================================================

class BriefingService extends BaseService {
  protected basePath = '/api/v2/briefings';

  async getBriefings(): Promise<Briefing[]> {
    try {
      this.log('getBriefings');
      const response = await apiClient.get<{ data: Briefing[]; pagination: unknown }>(
        this.basePath
      );
      // Backend returns PaginatedResponse via executeAndReturn — unwrap handles both shapes
      const body = unwrapResponse<{ data: Briefing[]; pagination: unknown }>(response);
      // body is either PaginatedResponse ({ data: [...], pagination }) or the data array directly
      return Array.isArray(body) ? body : (body.data ?? []);
    } catch (error) {
      this.handleError(error, 'getBriefings');
    }
  }

  async getBriefing(id: string): Promise<Briefing> {
    try {
      this.log('getBriefing', id);
      const response = await apiClient.get<Briefing>(`${this.basePath}/${id}`);
      return unwrapResponse<Briefing>(response);
    } catch (error) {
      this.handleError(error, 'getBriefing');
    }
  }

  async createBriefing(data: CreateBriefingInput): Promise<Briefing> {
    try {
      this.log('createBriefing', data);
      const response = await apiClient.post<Briefing>(this.basePath, data);
      return unwrapResponse<Briefing>(response);
    } catch (error) {
      this.handleError(error, 'createBriefing');
    }
  }

  async updateBriefing(id: string, data: UpdateBriefingInput): Promise<Briefing> {
    try {
      this.log('updateBriefing', { id, data });
      const response = await apiClient.put<Briefing>(`${this.basePath}/${id}`, data);
      return unwrapResponse<Briefing>(response);
    } catch (error) {
      this.handleError(error, 'updateBriefing');
    }
  }

  async deleteBriefing(id: string): Promise<void> {
    try {
      this.log('deleteBriefing', id);
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteBriefing');
    }
  }

  async updateStatus(id: string, status: string): Promise<Briefing> {
    try {
      this.log('updateStatus', { id, status });
      const response = await apiClient.put<Briefing>(`${this.basePath}/${id}/status`, { status });
      return unwrapResponse<Briefing>(response);
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  async addElement(briefingId: string, element: BriefingElement): Promise<BriefingElement> {
    try {
      this.log('addElement', { briefingId, element });
      const response = await apiClient.post<BriefingElement>(
        `${this.basePath}/${briefingId}/elements`,
        element
      );
      return unwrapResponse<BriefingElement>(response);
    } catch (error) {
      this.handleError(error, 'addElement');
    }
  }

  async createVersion(id: string): Promise<Briefing> {
    try {
      this.log('createVersion', id);
      const response = await apiClient.post<Briefing>(`${this.basePath}/${id}/version`);
      return unwrapResponse<Briefing>(response);
    } catch (error) {
      this.handleError(error, 'createVersion');
    }
  }
}

export const briefingService = new BriefingService();
