import type {
  ApplyTemplateInput,
  CreateTemplateInput,
  ForkTemplateInput,
  ImportTemplateInput,
  MarketplaceSearchParams,
  MarketplaceSearchResult,
  OrganizationTemplate,
  RateTemplateInput,
  TemplateListParams,
  UpdateTemplateInput,
} from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData } from './baseService';

class OrganizationTemplateService extends BaseService {
  protected basePath = '/api/organizations/templates';

  // ============================================================================
  // Discovery / Marketplace
  // ============================================================================

  async searchMarketplace(params?: MarketplaceSearchParams): Promise<MarketplaceSearchResult> {
    try {
      this.log('searchMarketplace', params);
      const response = await apiClient.get<MarketplaceSearchResult>(
        `${this.basePath}/marketplace`,
        { params }
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'searchMarketplace');
    }
  }

  async getPopularTemplates(limit?: number): Promise<OrganizationTemplate[]> {
    try {
      this.log('getPopularTemplates', { limit });
      const response = await apiClient.get<OrganizationTemplate[]>(`${this.basePath}/popular`, {
        params: { limit },
      });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getPopularTemplates');
    }
  }

  async getTopRatedTemplates(limit?: number): Promise<OrganizationTemplate[]> {
    try {
      this.log('getTopRatedTemplates', { limit });
      const response = await apiClient.get<OrganizationTemplate[]>(`${this.basePath}/top-rated`, {
        params: { limit },
      });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getTopRatedTemplates');
    }
  }

  // ============================================================================
  // CRUD
  // ============================================================================

  async listTemplates(params?: TemplateListParams): Promise<OrganizationTemplate[]> {
    try {
      this.log('listTemplates', params);
      const response = await apiClient.get<OrganizationTemplate[]>(this.basePath, { params });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'listTemplates');
    }
  }

  async getTemplate(id: string): Promise<OrganizationTemplate> {
    try {
      this.log('getTemplate', { id });
      const response = await apiClient.get<OrganizationTemplate>(`${this.basePath}/${id}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getTemplate');
    }
  }

  async createTemplate(input: CreateTemplateInput): Promise<OrganizationTemplate> {
    try {
      this.log('createTemplate', input);
      const response = await apiClient.post<OrganizationTemplate>(this.basePath, input);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createTemplate');
    }
  }

  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<OrganizationTemplate> {
    try {
      this.log('updateTemplate', { id, ...input });
      const response = await apiClient.put<OrganizationTemplate>(`${this.basePath}/${id}`, input);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateTemplate');
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      this.log('deleteTemplate', { id });
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      return this.handleError(error, 'deleteTemplate');
    }
  }

  // ============================================================================
  // Template Actions
  // ============================================================================

  async applyTemplate(id: string, input: ApplyTemplateInput): Promise<unknown> {
    try {
      this.log('applyTemplate', { id, ...input });
      const response = await apiClient.post<unknown>(`${this.basePath}/${id}/apply`, input);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'applyTemplate');
    }
  }

  async forkTemplate(id: string, input?: ForkTemplateInput): Promise<OrganizationTemplate> {
    try {
      this.log('forkTemplate', { id, ...input });
      const response = await apiClient.post<OrganizationTemplate>(
        `${this.basePath}/${id}/fork`,
        input ?? {}
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'forkTemplate');
    }
  }

  async rateTemplate(id: string, input: RateTemplateInput): Promise<OrganizationTemplate> {
    try {
      this.log('rateTemplate', { id, ...input });
      const response = await apiClient.post<OrganizationTemplate>(
        `${this.basePath}/${id}/rate`,
        input
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'rateTemplate');
    }
  }

  // ============================================================================
  // Import / Export
  // ============================================================================

  async exportTemplate(id: string): Promise<Record<string, unknown>> {
    try {
      this.log('exportTemplate', { id });
      const response = await apiClient.get<Record<string, unknown>>(
        `${this.basePath}/${id}/export`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'exportTemplate');
    }
  }

  async importTemplate(input: ImportTemplateInput): Promise<OrganizationTemplate> {
    try {
      this.log('importTemplate', input);
      const response = await apiClient.post<OrganizationTemplate>(`${this.basePath}/import`, input);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'importTemplate');
    }
  }
}

export const organizationTemplateService = new OrganizationTemplateService();
