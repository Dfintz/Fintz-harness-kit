import { Response } from 'express';

import { PermissionTemplateController } from '../../controllers/permissionTemplateController';
import { AuthRequest } from '../../middleware/auth';
import { PermissionService, PermissionTemplateService } from '../../services/security';

jest.mock('../../services/security');
jest.mock('../../services/security');
describe('PermissionTemplateController', () => {
  let controller: PermissionTemplateController;
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let mockTemplateService: jest.Mocked<PermissionTemplateService>;
  let mockPermissionService: jest.Mocked<PermissionService>;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-1', role: 'user', username: 'test' },
    } as any;

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockTemplateService = {
      listTemplates: jest.fn(),
      getTemplate: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      applyTemplate: jest.fn(),
    } as any;

    mockPermissionService = {
      hasPermission: jest.fn(),
    } as any;

    (PermissionTemplateService as jest.Mock).mockImplementation(() => mockTemplateService);
    (PermissionService as jest.Mock).mockImplementation(() => mockPermissionService);

    controller = new PermissionTemplateController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('should list all templates', async () => {
      const mockTemplates = [
        { id: 'tmpl-1', name: 'Admin' },
        { id: 'tmpl-2', name: 'Member' },
      ];
      mockTemplateService.listTemplates.mockReturnValue(mockTemplates as any);

      await controller.listTemplates(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith({
        templates: mockTemplates,
        count: 2,
      });
    });

    it('should filter by organization', async () => {
      req.query = { organizationId: 'org-1' };
      mockTemplateService.listTemplates.mockReturnValue([]);

      await controller.listTemplates(req as AuthRequest, res as Response);

      expect(mockTemplateService.listTemplates).toHaveBeenCalledWith('org-1');
    });

    it('should handle errors', async () => {
      mockTemplateService.listTemplates.mockImplementation(() => {
        throw new Error('Error');
      });

      await controller.listTemplates(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTemplate', () => {
    it('should get template by ID', async () => {
      req.params = { templateId: 'tmpl-1' };
      const mockTemplate = { id: 'tmpl-1', name: 'Admin' };
      mockTemplateService.getTemplate.mockReturnValue(mockTemplate as any);

      await controller.getTemplate(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(mockTemplate);
    });

    it('should return 404 when template not found', async () => {
      req.params = { templateId: 'tmpl-999' };
      mockTemplateService.getTemplate.mockReturnValue(undefined as any);

      await controller.getTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      req.params = { templateId: 'tmpl-1' };
      mockTemplateService.getTemplate.mockImplementation(() => {
        throw new Error('Error');
      });

      await controller.getTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createTemplate', () => {
    it('should create template with proper permissions', async () => {
      req.body = {
        name: 'Custom Role',
        description: 'Test role',
        permissions: ['read', 'write'],
        securityLevel: 2,
        organizationId: 'org-1',
      };
      mockPermissionService.hasPermission.mockResolvedValue(true);
      const mockCreated = { id: 'tmpl-new', ...req.body };
      mockTemplateService.createTemplate.mockReturnValue(mockCreated);

      await controller.createTemplate(req as AuthRequest, res as Response);

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
        'Custom Role',
        'Test role',
        ['read', 'write'],
        2,
        'org-1',
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreated);
    });

    it('should return 401 when not authenticated', async () => {
      req.user = undefined;
      req.body = {
        name: 'Test',
        description: 'Test',
        permissions: [],
        securityLevel: 1,
        organizationId: 'org-1',
      };

      await controller.createTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when missing required fields', async () => {
      req.body = { name: 'Test' };

      await controller.createTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should allow admin without permission check', async () => {
      req.user = { id: 'admin-1', role: 'admin', username: 'admin' };
      req.body = {
        name: 'Admin Template',
        description: 'Test',
        permissions: ['all'],
        securityLevel: 5,
        organizationId: 'org-1',
      };
      mockPermissionService.hasPermission.mockResolvedValue(false);
      mockTemplateService.createTemplate.mockReturnValue({ id: 'tmpl-1' } as any);

      await controller.createTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 403 when user lacks permissions', async () => {
      req.body = {
        name: 'Test',
        description: 'Test',
        permissions: [],
        securityLevel: 1,
        organizationId: 'org-1',
      };
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await controller.createTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('updateTemplate', () => {
    it('should update template with permissions', async () => {
      req.params = { templateId: 'tmpl-1' };
      req.body = { name: 'Updated Name' };
      const mockTemplate = { id: 'tmpl-1', organizationId: 'org-1' };
      mockTemplateService.getTemplate.mockReturnValue(mockTemplate as any);
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockTemplateService.updateTemplate.mockReturnValue({
        ...mockTemplate,
        name: 'Updated Name',
      } as any);

      await controller.updateTemplate(req as AuthRequest, res as Response);

      expect(mockTemplateService.updateTemplate).toHaveBeenCalledWith('tmpl-1', {
        name: 'Updated Name',
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 when template not found', async () => {
      req.params = { templateId: 'tmpl-999' };
      req.body = { name: 'Test' };
      mockTemplateService.getTemplate.mockReturnValue(undefined as any);

      await controller.updateTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when user lacks permissions', async () => {
      req.params = { templateId: 'tmpl-1' };
      req.body = { name: 'Test' };
      mockTemplateService.getTemplate.mockReturnValue({
        id: 'tmpl-1',
        organizationId: 'org-1',
      } as any);
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await controller.updateTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 when trying to modify system template', async () => {
      req.params = { templateId: 'tmpl-1' };
      req.body = { name: 'Test' };
      mockTemplateService.getTemplate.mockReturnValue({ id: 'tmpl-1' } as any);
      mockTemplateService.updateTemplate.mockImplementation(() => {
        throw new Error('Cannot modify system templates');
      });

      await controller.updateTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Cannot modify system templates'),
        })
      );
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template with permissions', async () => {
      req.params = { templateId: 'tmpl-1' };
      mockTemplateService.getTemplate.mockReturnValue({
        id: 'tmpl-1',
        organizationId: 'org-1',
      } as any);
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockTemplateService.deleteTemplate.mockReturnValue(true);

      await controller.deleteTemplate(req as AuthRequest, res as Response);

      expect(mockTemplateService.deleteTemplate).toHaveBeenCalledWith('tmpl-1');
      expect(res.json).toHaveBeenCalledWith({ message: 'Template deleted successfully' });
    });

    it('should return 404 when template not found', async () => {
      req.params = { templateId: 'tmpl-999' };
      mockTemplateService.getTemplate.mockReturnValue(undefined as any);

      await controller.deleteTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when user lacks permissions', async () => {
      req.params = { templateId: 'tmpl-1' };
      mockTemplateService.getTemplate.mockReturnValue({
        id: 'tmpl-1',
        organizationId: 'org-1',
      } as any);
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await controller.deleteTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 when trying to delete system template', async () => {
      req.params = { templateId: 'tmpl-1' };
      mockTemplateService.getTemplate.mockReturnValue({ id: 'tmpl-1' } as any);
      mockTemplateService.deleteTemplate.mockImplementation(() => {
        throw new Error('Cannot delete system templates');
      });

      await controller.deleteTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('applyTemplate', () => {
    it('should apply template to user', async () => {
      req.params = { templateId: 'tmpl-1' };
      req.body = { userId: 'user-2', organizationId: 'org-1', reason: 'Promotion' };
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockTemplateService.applyTemplate.mockResolvedValue(undefined);

      await controller.applyTemplate(req as AuthRequest, res as Response);

      expect(mockTemplateService.applyTemplate).toHaveBeenCalledWith(
        'tmpl-1',
        'user-2',
        'org-1',
        'user-1',
        'Promotion'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Template applied successfully',
        })
      );
    });

    it('should return 401 when not authenticated', async () => {
      req.user = undefined;
      req.params = { templateId: 'tmpl-1' };
      req.body = { userId: 'user-2', organizationId: 'org-1' };

      await controller.applyTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when missing required fields', async () => {
      req.params = { templateId: 'tmpl-1' };
      req.body = { userId: 'user-2' };

      await controller.applyTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 when user lacks permissions', async () => {
      req.params = { templateId: 'tmpl-1' };
      req.body = { userId: 'user-2', organizationId: 'org-1' };
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await controller.applyTemplate(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
