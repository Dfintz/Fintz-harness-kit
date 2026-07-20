import type {
  ActivityTemplate,
  ActivityTemplateCategoryInfo,
  ActivityTemplateQueryFilters,
  ApplyActivityTemplateInput,
  CreateActivityTemplateInput,
  UpdateActivityTemplateInput,
} from '@/types/apiV2';
import { apiClient } from './apiClient';
import {
  BaseService,
  extractArrayFromEnvelope,
  extractData,
  extractPaginationMeta,
} from './baseService';

/**
 * Activity Template Service
 * Handles all activity template API calls using v2 endpoints
 */
class ActivityTemplateService extends BaseService {
  protected basePath = '/api/v2/templates';

  /**
   * Get available template categories
   * GET /api/v2/templates/categories
   */
  async getCategories(): Promise<ActivityTemplateCategoryInfo[]> {
    try {
      this.log('getCategories');

      const response = await apiClient.get<ActivityTemplateCategoryInfo[]>(
        `${this.basePath}/categories`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCategories');
    }
  }

  /**
   * List templates with optional filters
   * GET /api/v2/templates
   */
  async getTemplates(
    filters?: ActivityTemplateQueryFilters
  ): Promise<{ templates: ActivityTemplate[]; total: number; page: number; limit: number }> {
    try {
      this.log('getTemplates', { filters });

      const response = await apiClient.get<Record<string, unknown>>(this.basePath, {
        params: filters,
      });

      const raw = extractData(response);
      const items = extractArrayFromEnvelope<ActivityTemplate>(raw, 'templates');
      const pagination = extractPaginationMeta(raw);
      const rawObj = raw as Record<string, unknown> | undefined;

      return {
        templates: items,
        total: pagination?.total ?? (rawObj?.total as number) ?? items.length,
        page: pagination?.page ?? (rawObj?.page as number) ?? 1,
        limit: pagination?.limit ?? (rawObj?.limit as number) ?? 20,
      };
    } catch (error) {
      return this.handleError(error, 'getTemplates');
    }
  }

  /**
   * Get a single template by ID
   * GET /api/v2/templates/:templateId
   */
  async getTemplate(templateId: string): Promise<ActivityTemplate> {
    try {
      this.log('getTemplate', { templateId });

      const response = await apiClient.get<ActivityTemplate>(
        `${this.basePath}/${encodeURIComponent(templateId)}`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getTemplate');
    }
  }

  /**
   * Create a new activity template
   * POST /api/v2/templates
   */
  async createTemplate(data: CreateActivityTemplateInput): Promise<ActivityTemplate> {
    try {
      this.log('createTemplate', data);

      const response = await apiClient.post<ActivityTemplate>(this.basePath, data);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createTemplate');
    }
  }

  /**
   * Update an existing template
   * PUT /api/v2/templates/:templateId
   */
  async updateTemplate(
    templateId: string,
    data: UpdateActivityTemplateInput
  ): Promise<ActivityTemplate> {
    try {
      this.log('updateTemplate', { templateId, data });

      const response = await apiClient.put<ActivityTemplate>(
        `${this.basePath}/${encodeURIComponent(templateId)}`,
        data
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateTemplate');
    }
  }

  /**
   * Delete a template (soft-delete)
   * DELETE /api/v2/templates/:templateId
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      this.log('deleteTemplate', { templateId });

      await apiClient.delete(`${this.basePath}/${encodeURIComponent(templateId)}`);
    } catch (error) {
      return this.handleError(error, 'deleteTemplate');
    }
  }

  /**
   * Clone a template
   * POST /api/v2/templates/:templateId/clone
   */
  async cloneTemplate(templateId: string): Promise<ActivityTemplate> {
    try {
      this.log('cloneTemplate', { templateId });

      const response = await apiClient.post<ActivityTemplate>(
        `${this.basePath}/${encodeURIComponent(templateId)}/clone`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'cloneTemplate');
    }
  }

  /**
   * Apply a template to create a new activity
   * POST /api/v2/templates/:templateId/apply
   */
  async applyTemplate(
    templateId: string,
    data: ApplyActivityTemplateInput
  ): Promise<{ activity: { id: string } }> {
    try {
      this.log('applyTemplate', { templateId, data });

      const response = await apiClient.post<{ activity: { id: string } }>(
        `${this.basePath}/${encodeURIComponent(templateId)}/apply`,
        data
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'applyTemplate');
    }
  }
}

export const activityTemplateService = new ActivityTemplateService();
