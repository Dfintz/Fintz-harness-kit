/**
 * Treaty Template Service
 * Handles treaty template management API calls
 *
 * Backend routes: /api/v2/treaty-templates/*
 */

import type {
  CreateTreatyTemplateRequest,
  InstantiateTreatyRequest,
  TreatyTemplate,
  TreatyTemplateCategory,
  TreatyTemplateScope,
  UpdateTreatyTemplateRequest,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface TreatyTemplateListParams {
  category?: TreatyTemplateCategory;
  scope?: TreatyTemplateScope;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTemplateResponse {
  data: TreatyTemplate[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface InstantiatedTreaty {
  term: string;
  description: string;
}

// ============================================================================
// Service
// ============================================================================

class TreatyTemplateServiceClient extends BaseService {
  protected basePath = '/api/v2/treaty-templates';

  /**
   * List available treaty templates (built-in + org-owned)
   */
  async getTemplates(params?: TreatyTemplateListParams): Promise<PaginatedTemplateResponse> {
    try {
      this.log('getTemplates', params);
      const response = await apiClient.get<PaginatedTemplateResponse>(this.basePath, { params });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTemplates');
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(id: string): Promise<TreatyTemplate> {
    try {
      this.log('getTemplateById', id);
      const response = await apiClient.get<TreatyTemplate>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTemplateById');
    }
  }

  /**
   * Create a new custom treaty template
   */
  async createTemplate(data: CreateTreatyTemplateRequest): Promise<TreatyTemplate> {
    try {
      this.log('createTemplate', data);
      const response = await apiClient.post<TreatyTemplate>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createTemplate');
    }
  }

  /**
   * Update a custom treaty template
   */
  async updateTemplate(id: string, data: UpdateTreatyTemplateRequest): Promise<TreatyTemplate> {
    try {
      this.log('updateTemplate', { id, ...data });
      const response = await apiClient.put<TreatyTemplate>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateTemplate');
    }
  }

  /**
   * Delete a custom treaty template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      this.log('deleteTemplate', id);
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteTemplate');
    }
  }

  /**
   * Instantiate a treaty from a template (generates terms for use in alliance/federation)
   */
  async instantiateTemplate(data: InstantiateTreatyRequest): Promise<InstantiatedTreaty[]> {
    try {
      this.log('instantiateTemplate', data);
      const response = await apiClient.post<InstantiatedTreaty[]>(
        `${this.basePath}/instantiate`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'instantiateTemplate');
    }
  }
}

export const treatyTemplateService = new TreatyTemplateServiceClient();
