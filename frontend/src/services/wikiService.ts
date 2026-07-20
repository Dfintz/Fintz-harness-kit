/**
 * Wiki Service
 * Handles organization wiki / knowledge base API calls
 *
 * Created during Sprint 2 — Wave 3.2 (Org Wiki)
 */

import type {
  CreateWikiPageRequest,
  MoveWikiPageRequest,
  UpdateWikiPageRequest,
  WikiPage,
  WikiPageRevision,
  WikiSearchResult,
  WikiTreeNode,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Service
// ============================================================================

class WikiService extends BaseService {
  protected basePath = '/api/v2/wiki';

  /**
   * Safely extract data from an apiClient response.
   * apiClient.get/post/put already returns response.data (Axios unwrap),
   * so we may receive the payload directly OR wrapped in {data, success, meta}.
   */
  private unwrap<T>(response: unknown): T {
    const obj = response as Record<string, unknown> | undefined;
    // If response has a .data property and it looks like an API envelope, unwrap
    if (obj && 'data' in obj && ('success' in obj || 'meta' in obj)) {
      return obj.data as T;
    }
    return response as T;
  }

  // ==================== Tree ====================

  async getPageTree(): Promise<WikiTreeNode[]> {
    try {
      this.log('getPageTree');
      const response = await apiClient.get<WikiTreeNode[]>(`${this.basePath}/tree`);
      return this.unwrap<WikiTreeNode[]>(response);
    } catch (error) {
      this.handleError(error, 'getPageTree');
    }
  }

  // ==================== Search ====================

  async searchPages(query: string, limit?: number): Promise<WikiSearchResult[]> {
    try {
      this.log('searchPages', { query, limit });
      const params: Record<string, unknown> = { q: query };
      if (limit) params.limit = limit;
      const queryString = this.buildQueryString(params);
      const response = await apiClient.get<WikiSearchResult[]>(
        `${this.basePath}/search${queryString}`
      );
      return this.unwrap<WikiSearchResult[]>(response);
    } catch (error) {
      this.handleError(error, 'searchPages');
    }
  }

  // ==================== CRUD ====================

  async getPages(): Promise<WikiPage[]> {
    try {
      this.log('getPages');
      const response = await apiClient.get<WikiPage[]>(`${this.basePath}/pages`);
      return this.unwrap<WikiPage[]>(response);
    } catch (error) {
      this.handleError(error, 'getPages');
    }
  }

  async getPage(pageId: string): Promise<WikiPage> {
    try {
      this.log('getPage', pageId);
      const response = await apiClient.get<WikiPage>(`${this.basePath}/pages/${pageId}`);
      return this.unwrap<WikiPage>(response);
    } catch (error) {
      this.handleError(error, 'getPage');
    }
  }

  async createPage(data: CreateWikiPageRequest): Promise<WikiPage> {
    try {
      this.log('createPage', data);
      const response = await apiClient.post<WikiPage>(`${this.basePath}/pages`, data);
      return this.unwrap<WikiPage>(response);
    } catch (error) {
      this.handleError(error, 'createPage');
    }
  }

  async updatePage(pageId: string, data: UpdateWikiPageRequest): Promise<WikiPage> {
    try {
      this.log('updatePage', { pageId, data });
      const response = await apiClient.put<WikiPage>(`${this.basePath}/pages/${pageId}`, data);
      return this.unwrap<WikiPage>(response);
    } catch (error) {
      this.handleError(error, 'updatePage');
    }
  }

  async deletePage(pageId: string): Promise<void> {
    try {
      this.log('deletePage', pageId);
      await apiClient.delete(`${this.basePath}/pages/${pageId}`);
    } catch (error) {
      this.handleError(error, 'deletePage');
    }
  }

  // ==================== Move ====================

  async movePage(pageId: string, data: MoveWikiPageRequest): Promise<WikiPage> {
    try {
      this.log('movePage', { pageId, data });
      const response = await apiClient.put<WikiPage>(`${this.basePath}/pages/${pageId}/move`, data);
      return this.unwrap<WikiPage>(response);
    } catch (error) {
      this.handleError(error, 'movePage');
    }
  }

  // ==================== Revisions ====================

  async getRevisions(pageId: string): Promise<WikiPageRevision[]> {
    try {
      this.log('getRevisions', pageId);
      const response = await apiClient.get<WikiPageRevision[]>(
        `${this.basePath}/pages/${pageId}/revisions`
      );
      return this.unwrap<WikiPageRevision[]>(response);
    } catch (error) {
      this.handleError(error, 'getRevisions');
    }
  }

  async getRevision(pageId: string, revisionId: string): Promise<WikiPageRevision> {
    try {
      this.log('getRevision', { pageId, revisionId });
      const response = await apiClient.get<WikiPageRevision>(
        `${this.basePath}/pages/${pageId}/revisions/${revisionId}`
      );
      return this.unwrap<WikiPageRevision>(response);
    } catch (error) {
      this.handleError(error, 'getRevision');
    }
  }

  async restoreRevision(pageId: string, revisionId: string): Promise<WikiPage> {
    try {
      this.log('restoreRevision', { pageId, revisionId });
      const response = await apiClient.post<WikiPage>(`${this.basePath}/pages/${pageId}/restore`, {
        revisionId,
      });
      return this.unwrap<WikiPage>(response);
    } catch (error) {
      this.handleError(error, 'restoreRevision');
    }
  }
}

export const wikiService = new WikiService();
