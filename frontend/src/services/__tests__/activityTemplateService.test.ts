/**
 * Activity Template Service Tests
 *
 * Tests for template CRUD, cloning, and apply operations
 */

import { activityTemplateService } from '@/services/activityTemplateService';
import { apiClient } from '@/services/apiClient';
import { ActivityTemplateCategory } from '@/types/apiV2';

// Mock the API client
jest.mock('../apiClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockApiClientError extends Error {
    code: string;
    statusCode?: number;
    constructor(errorCode: string, message: string, statusCode?: number) {
      super(message);
      this.name = 'ApiClientError';
      this.code = errorCode;
      this.statusCode = statusCode;
    }
  }

  return {
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
    ApiClientError: MockApiClientError,
    getErrorMessage: jest.fn((err: Error) => err.message),
  };
});

describe('ActivityTemplateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCategories', () => {
    it('should fetch template categories', async () => {
      const mockCategories = [
        { label: 'Combat', value: 'combat', description: 'Combat missions' },
        { label: 'Mining', value: 'mining', description: 'Mining operations' },
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCategories });

      const result = await activityTemplateService.getCategories();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/templates/categories');
      expect(result).toEqual(mockCategories);
      expect(result).toHaveLength(2);
    });

    it('should handle errors when fetching categories', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(activityTemplateService.getCategories()).rejects.toThrow();
    });
  });

  describe('getTemplates', () => {
    it('should fetch templates without filters', async () => {
      const mockResponse = {
        templates: [{ id: 'tpl-1', name: 'Mining Run', category: 'mining' }],
        total: 1,
        page: 1,
        limit: 20,
      };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await activityTemplateService.getTemplates();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/templates', {
        params: undefined,
      });
      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should fetch templates with filters', async () => {
      const filters = {
        category: ActivityTemplateCategory.COMBAT,
        search: 'bounty',
        page: 2,
        limit: 10,
      };
      const mockResponse = {
        templates: [],
        total: 0,
        page: 2,
        limit: 10,
      };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await activityTemplateService.getTemplates(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/templates', {
        params: filters,
      });
      expect(result.templates).toHaveLength(0);
      expect(result.page).toBe(2);
    });
  });

  describe('getTemplate', () => {
    it('should fetch a single template by ID', async () => {
      const mockTemplate = {
        id: 'tpl-1',
        name: 'Mining Run',
        description: 'Standard mining operation',
        activityType: 'mission',
        category: 'mining',
        isPublic: true,
        usageCount: 5,
      };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTemplate });

      const result = await activityTemplateService.getTemplate('tpl-1');

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/templates/tpl-1');
      expect(result.id).toBe('tpl-1');
      expect(result.name).toBe('Mining Run');
    });

    it('should encode template ID in path', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: 'tpl/special' } });

      await activityTemplateService.getTemplate('tpl/special');

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/templates/tpl%2Fspecial');
    });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const createData = {
        name: 'New Template',
        activityType: 'mission' as const,
        category: ActivityTemplateCategory.COMBAT,
        description: 'A combat template',
        isPublic: true,
        tags: ['pvp', 'group'],
      };
      const mockTemplate = {
        id: 'tpl-new',
        ...createData,
        usageCount: 0,
        createdAt: '2024-01-01',
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTemplate });

      const result = await activityTemplateService.createTemplate(createData);

      expect(apiClient.post).toHaveBeenCalledWith('/api/v2/templates', createData);
      expect(result.id).toBe('tpl-new');
      expect(result.name).toBe('New Template');
    });

    it('should create a template with minimal required fields', async () => {
      const createData = {
        name: 'Minimal Template',
        activityType: 'bounty' as const,
      };
      const mockTemplate = { id: 'tpl-min', ...createData };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTemplate });

      const result = await activityTemplateService.createTemplate(createData);

      expect(apiClient.post).toHaveBeenCalledWith('/api/v2/templates', createData);
      expect(result.name).toBe('Minimal Template');
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      const updateData = { name: 'Updated Name', description: 'Updated description' };
      const mockTemplate = {
        id: 'tpl-1',
        ...updateData,
        activityType: 'mission',
        category: 'combat',
      };
      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockTemplate });

      const result = await activityTemplateService.updateTemplate('tpl-1', updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/api/v2/templates/tpl-1', updateData);
      expect(result.name).toBe('Updated Name');
    });

    it('should encode template ID when updating', async () => {
      const updateData = { name: 'Test' };
      (apiClient.put as jest.Mock).mockResolvedValue({ data: { id: 'tpl/special' } });

      await activityTemplateService.updateTemplate('tpl/special', updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/api/v2/templates/tpl%2Fspecial', updateData);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: undefined });

      await activityTemplateService.deleteTemplate('tpl-1');

      expect(apiClient.delete).toHaveBeenCalledWith('/api/v2/templates/tpl-1');
    });

    it('should encode template ID when deleting', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: undefined });

      await activityTemplateService.deleteTemplate('tpl/special');

      expect(apiClient.delete).toHaveBeenCalledWith('/api/v2/templates/tpl%2Fspecial');
    });
  });

  describe('cloneTemplate', () => {
    it('should clone a template', async () => {
      const mockClone = {
        id: 'tpl-clone',
        name: 'Mining Run (Copy)',
        category: 'mining',
        activityType: 'mission',
        usageCount: 0,
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockClone });

      const result = await activityTemplateService.cloneTemplate('tpl-1');

      expect(apiClient.post).toHaveBeenCalledWith('/api/v2/templates/tpl-1/clone');
      expect(result.id).toBe('tpl-clone');
      expect(result.usageCount).toBe(0);
    });

    it('should encode template ID when cloning', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'cloned' } });

      await activityTemplateService.cloneTemplate('tpl/special');

      expect(apiClient.post).toHaveBeenCalledWith('/api/v2/templates/tpl%2Fspecial/clone');
    });
  });

  describe('applyTemplate', () => {
    it('should apply a template to create activity', async () => {
      const applyData = {
        title: 'Mining Operation Alpha',
        scheduledStartTime: '2024-06-01T14:00:00Z',
        estimatedDuration: 120,
        maxParticipants: 8,
      };
      const mockResult = { activity: { id: 'act-new' } };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResult });

      const result = await activityTemplateService.applyTemplate('tpl-1', applyData);

      expect(apiClient.post).toHaveBeenCalledWith('/api/v2/templates/tpl-1/apply', applyData);
      expect(result.activity.id).toBe('act-new');
    });

    it('should apply with minimal required fields', async () => {
      const applyData = {
        title: 'Quick Mission',
        scheduledStartTime: '2024-06-01T10:00:00Z',
      };
      const mockResult = { activity: { id: 'act-min' } };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResult });

      const result = await activityTemplateService.applyTemplate('tpl-2', applyData);

      expect(apiClient.post).toHaveBeenCalledWith('/api/v2/templates/tpl-2/apply', applyData);
      expect(result.activity.id).toBe('act-min');
    });

    it('should encode template ID when applying', async () => {
      const applyData = {
        title: 'Test',
        scheduledStartTime: '2024-01-01T00:00:00Z',
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { activity: { id: 'a1' } } });

      await activityTemplateService.applyTemplate('tpl/special', applyData);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/templates/tpl%2Fspecial/apply',
        applyData
      );
    });
  });
});
