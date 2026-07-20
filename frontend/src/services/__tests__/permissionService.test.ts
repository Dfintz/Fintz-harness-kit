/**
 * Permission Service Tests (Sprint 19-A)
 *
 * Tests for role template service methods:
 * - getRoleTemplates
 * - applyRoleTemplate
 */

import { apiClient } from '@/services/apiClient';
import { permissionService } from '@/services/permissionService';

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

describe('PermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getRoleTemplates
  // ==========================================================================

  describe('getRoleTemplates', () => {
    it('should fetch available role templates', async () => {
      const mockResponse = {
        templates: [
          {
            id: 'template:org-admin',
            name: 'Organization Admin Template',
            description: 'Pre-configured for org administrators',
            scope: 'organization',
            permissions: ['org:members:manage', 'org:settings:write', 'org:permissions:manage'],
          },
          {
            id: 'template:fleet-lead',
            name: 'Fleet Leader Template',
            description: 'Pre-configured for fleet leaders',
            scope: 'fleet',
            permissions: ['fleet:*', 'org:read'],
          },
        ],
        count: 2,
      };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await permissionService.getRoleTemplates();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/roles/templates');
      expect(result.templates).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.templates[0].id).toBe('template:org-admin');
      expect(result.templates[1].scope).toBe('fleet');
    });

    it('should return empty templates list', async () => {
      const mockResponse = { templates: [], count: 0 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await permissionService.getRoleTemplates();

      expect(result.templates).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should handle errors when fetching templates', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(permissionService.getRoleTemplates()).rejects.toThrow();
    });
  });

  // ==========================================================================
  // applyRoleTemplate
  // ==========================================================================

  describe('applyRoleTemplate', () => {
    it('should apply a role template with correct URL and data', async () => {
      const templateId = 'template:org-admin';
      const inputData = {
        roleName: 'Custom Admin',
        organizationId: 'org-123',
      };
      const mockResponse = {
        id: 'role-uuid-1',
        name: 'Custom Admin',
        description: 'Pre-configured for org administrators',
        templateApplied: templateId,
        organizationId: 'org-123',
        permissions: ['org:members:manage', 'org:settings:write'],
        priority: 90,
        createdAt: '2024-06-01T00:00:00Z',
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await permissionService.applyRoleTemplate(templateId, inputData);

      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v2/roles/templates/${templateId}/apply`,
        inputData
      );
      expect(result.id).toBe('role-uuid-1');
      expect(result.name).toBe('Custom Admin');
      expect(result.templateApplied).toBe(templateId);
      expect(result.organizationId).toBe('org-123');
      expect(result.permissions).toContain('org:members:manage');
    });

    it('should handle errors when applying template', async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error('Conflict'));

      await expect(
        permissionService.applyRoleTemplate('template:org-admin', {
          roleName: 'Duplicate',
          organizationId: 'org-123',
        })
      ).rejects.toThrow();
    });

    it('should encode template ID in URL correctly', async () => {
      const templateId = 'template:fleet-lead';
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          id: 'role-2',
          name: 'Fleet Lead',
          templateApplied: templateId,
          organizationId: 'org-456',
          permissions: ['fleet:*'],
          priority: 90,
          createdAt: '2024-06-01T00:00:00Z',
        },
      });

      await permissionService.applyRoleTemplate(templateId, {
        roleName: 'Fleet Lead',
        organizationId: 'org-456',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/roles/templates/template:fleet-lead/apply',
        { roleName: 'Fleet Lead', organizationId: 'org-456' }
      );
    });
  });
});
