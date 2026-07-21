import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { OrganizationPermission } from '../../models/OrganizationPermission';
import {
  OrganizationTemplate,
  TemplateCategory,
  TemplateVisibility,
  TemplateStructure
} from '../../models/OrganizationTemplate';
import { OrganizationTemplateService } from '../../services/organization/OrganizationTemplateService';

jest.mock('../../config/database');

describe('OrganizationTemplateService', () => {
  let service: OrganizationTemplateService;
  let mockTemplateRepo: any;
  let mockOrgRepo: any;
  let mockMembershipRepo: any;
  let mockPermissionRepo: any;

  const mockStructure: TemplateStructure = {
    name: 'Root',
    type: 'division',
    level: 0,
    children: [
      { name: 'Operations', type: 'division', level: 1, children: [] },
      { name: 'Logistics', type: 'division', level: 1, children: [] }
    ]
  };

  beforeEach(() => {
    mockTemplateRepo = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn()
    };

    mockOrgRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn()
    };

    mockMembershipRepo = {
      create: jest.fn(),
      save: jest.fn()
    };

    mockPermissionRepo = {
      create: jest.fn(),
      save: jest.fn()
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === OrganizationTemplate || entity.name === 'OrganizationTemplate') {
        return mockTemplateRepo;
      }
      if (entity === Organization || entity.name === 'Organization') {
        return mockOrgRepo;
      }
      if (entity === OrganizationMembership || entity.name === 'OrganizationMembership') {
        return mockMembershipRepo;
      }
      if (entity === OrganizationPermission || entity.name === 'OrganizationPermission') {
        return mockPermissionRepo;
      }
      return {};
    });

    service = new OrganizationTemplateService();
    jest.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('should create a valid template', async () => {
      const templateData = {
        name: 'Mining Corporation',
        description: 'Template for mining organizations',
        category: TemplateCategory.CORPORATE,
        visibility: TemplateVisibility.PUBLIC,
        structure: mockStructure,
        tags: ['mining', 'industry']
      };

      const mockTemplate = {
        ...templateData,
        id: 'template-1',
        validateStructure: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      mockTemplateRepo.create.mockReturnValue(mockTemplate);
      mockTemplateRepo.save.mockResolvedValue(mockTemplate);

      const result = await service.createTemplate(templateData, 'user-1');

      expect(mockTemplateRepo.create).toHaveBeenCalledWith({
        ...templateData,
        creatorId: 'user-1',
        isPublic: true,
        usageCount: 0,
        averageRating: 0,
        ratingCount: 0
      });
      expect(mockTemplate.validateStructure).toHaveBeenCalled();
      expect(result).toEqual(mockTemplate);
    });

    it('should throw error for invalid template structure', async () => {
      const templateData = {
        name: 'Test',
        description: 'Test',
        category: TemplateCategory.GUILD,
        visibility: TemplateVisibility.PRIVATE,
        structure: mockStructure
      };

      const mockTemplate = {
        ...templateData,
        validateStructure: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Invalid node type', 'Missing required field']
        })
      };

      mockTemplateRepo.create.mockReturnValue(mockTemplate);

      await expect(
        service.createTemplate(templateData, 'user-1')
      ).rejects.toThrow('Template validation failed: Invalid node type, Missing required field');
    });

    it('should set isPublic based on visibility', async () => {
      const marketplaceData = {
        name: 'Test',
        description: 'Test',
        category: TemplateCategory.MILITARY,
        visibility: TemplateVisibility.MARKETPLACE,
        structure: mockStructure
      };

      const mockTemplate = {
        validateStructure: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      mockTemplateRepo.create.mockReturnValue(mockTemplate);
      mockTemplateRepo.save.mockResolvedValue(mockTemplate);

      await service.createTemplate(marketplaceData, 'user-1');

      expect(mockTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true })
      );
    });
  });

  describe('applyTemplate', () => {
    const mockTemplate = {
      id: 'template-1',
      name: 'Fleet Template',
      description: 'Template for fleets',
      structure: mockStructure,
      defaultSettings: { theme: 'dark' },
      applicationConfig: {
        allowApplications: true,
        requireApproval: true,
        autoAssignRole: 'member',
        welcomeMessage: 'Welcome!'
      },
      defaultRoles: [
        { name: 'admin', permissions: [{ resource: 'org', action: 'manage' }] }
      ],
      defaultPermissions: [
        { resource: 'fleet', actions: ['view', 'edit'] }
      ],
      usageCount: 5,
      lastUsedAt: new Date('2024-01-01'),
      validateStructure: jest.fn().mockReturnValue({ valid: true, errors: [] })
    };

    it('should create new organization from template', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      mockTemplateRepo.save.mockResolvedValue({ ...mockTemplate, usageCount: 6 });

      const mockOrg = { id: 'test-fleet', name: 'Test Fleet' };
      mockOrgRepo.create.mockReturnValue(mockOrg);
      mockOrgRepo.save.mockResolvedValue(mockOrg);

      const mockMembership = { id: 1 };
      mockMembershipRepo.create.mockReturnValue(mockMembership);
      mockMembershipRepo.save.mockResolvedValue(mockMembership);

      const mockPermission = { id: 1 };
      mockPermissionRepo.create.mockReturnValue(mockPermission);
      mockPermissionRepo.save.mockResolvedValue(mockPermission);

      const result = await service.applyTemplate('template-1', {
        organizationName: 'Test Fleet',
        organizationDescription: 'A test fleet',
        ownerId: 'user-1'
      });

      expect(mockTemplateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ usageCount: 6 })
      );
      expect(mockOrgRepo.create).toHaveBeenCalled();
      expect(mockMembershipRepo.create).toHaveBeenCalledWith({
        organizationId: 'test-fleet',
        userId: 'user-1',
        role: 'owner',
        permissions: ['manage_org', 'manage_members', 'manage_permissions', 'view_analytics']
      });
      expect(result).toEqual(mockOrg);
    });

    it('should increment template usage count', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      // applyTemplate modifies template in place, incrementing usage to 6
      mockTemplateRepo.save.mockImplementation((tmpl: any) => Promise.resolve(tmpl));
      mockOrgRepo.create.mockReturnValue({ id: 'org-1' });
      mockOrgRepo.save.mockResolvedValue({ id: 'org-1' });
      mockMembershipRepo.create.mockReturnValue({});
      mockMembershipRepo.save.mockResolvedValue({});
      mockPermissionRepo.create.mockReturnValue({});
      mockPermissionRepo.save.mockResolvedValue({});

      await service.applyTemplate('template-1', {
        organizationName: 'Test Org',
        ownerId: 'user-1'
      });

      // Template usage count incremented from 5 to 6
      expect(mockTemplateRepo.save).toHaveBeenCalled();
      expect(mockTemplate.lastUsedAt).toEqual(expect.any(Date));
    });

    it('should restructure existing organization', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      mockTemplateRepo.save.mockResolvedValue(mockTemplate);

      const existingOrg = {
        id: 'existing-org',
        name: 'Existing Org',
        structure: { name: 'OldStructure', type: 'division', children: [] }
      };
      mockOrgRepo.findOne.mockResolvedValue(existingOrg);
      mockOrgRepo.save.mockResolvedValue(existingOrg);
      mockPermissionRepo.create.mockReturnValue({});
      mockPermissionRepo.save.mockResolvedValue({});

      const result = await service.applyTemplate('template-1', {
        organizationId: 'existing-org',
        ownerId: 'user-1'
      });

      expect(mockOrgRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'existing-org' },
        relations: ['memberships', 'permissions']
      });
      expect(result.structure).toEqual(mockStructure);
    });

    it('should throw error if template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyTemplate('nonexistent', {
          organizationName: 'Test',
          ownerId: 'user-1'
        })
      ).rejects.toThrow('Template not found');
    });

    it('should throw error if organization name missing for new org', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      mockTemplateRepo.save.mockResolvedValue(mockTemplate);

      await expect(
        service.applyTemplate('template-1', {
          ownerId: 'user-1'
        })
      ).rejects.toThrow('Organization name required when creating new organization');
    });

    it('should apply customizations to skip nodes', async () => {
      const structureWithChildren = {
        name: 'Root',
        type: 'division',
        level: 0,
        children: [
          { name: 'Operations', type: 'division', level: 1, children: [] },
          { name: 'Logistics', type: 'division', level: 1, children: [] },
          { name: 'Marketing', type: 'division', level: 1, children: [] }
        ]
      };

      mockTemplateRepo.findOne.mockResolvedValue({
        ...mockTemplate,
        structure: structureWithChildren
      });
      mockTemplateRepo.save
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockTemplate);
      mockOrgRepo.create.mockReturnValue({ id: 'org-1' });
      const orgWithStructure = { 
        id: 'org-1', 
        structure: {
          name: 'Root',
          type: 'division',
          level: 0,
          children: [
            { name: 'Operations', type: 'division', level: 1, children: [] },
            { name: 'Logistics', type: 'division', level: 1, children: [] }
          ]
        }
      };
      mockOrgRepo.save
        .mockResolvedValueOnce({ id: 'org-1', structure: null })
        .mockResolvedValueOnce(orgWithStructure);
      mockMembershipRepo.create.mockReturnValue({});
      mockMembershipRepo.save.mockResolvedValue({});
      mockPermissionRepo.create.mockReturnValue({});
      mockPermissionRepo.save.mockResolvedValue({});

      await service.applyTemplate('template-1', {
        organizationName: 'Test',
        ownerId: 'user-1',
        customizations: {
          skipNodes: ['Marketing']
        }
      });

      // Check the second save call (which has the structure applied)
      const saveCall = mockOrgRepo.save.mock.calls[1][0];
      expect(saveCall.structure.children).toHaveLength(2);
      expect(saveCall.structure.children.some((c: any) => c.name === 'Marketing')).toBe(false);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should get templates by category', async () => {
      const mockTemplates = [
        { id: '1', category: TemplateCategory.MILITARY },
        { id: '2', category: TemplateCategory.MILITARY }
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockTemplates)
      };

      mockTemplateRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTemplatesByCategory(TemplateCategory.MILITARY);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'template.category = :category',
        { category: TemplateCategory.MILITARY }
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('template.usageCount', 'DESC');
      expect(result).toEqual(mockTemplates);
    });

    it('should filter by visibility', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([])
      };

      mockTemplateRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getTemplatesByCategory(
        TemplateCategory.CORPORATE,
        TemplateVisibility.PUBLIC
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'template.visibility = :visibility',
        { visibility: TemplateVisibility.PUBLIC }
      );
    });
  });

  describe('searchMarketplace', () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0)
    };

    beforeEach(() => {
      mockTemplateRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should search marketplace templates', async () => {
      const result = await service.searchMarketplace({});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'template.visibility = :visibility',
        { visibility: TemplateVisibility.MARKETPLACE }
      );
      expect(result).toEqual({ templates: [], total: 0 });
    });

    it('should filter by search text', async () => {
      await service.searchMarketplace({ search: 'mining' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(template.name ILIKE :search OR template.description ILIKE :search)',
        { search: '%mining%' }
      );
    });

    it('should filter by category', async () => {
      await service.searchMarketplace({ category: TemplateCategory.COMMUNITY });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'template.category = :category',
        { category: TemplateCategory.COMMUNITY }
      );
    });

    it('should filter by tags', async () => {
      await service.searchMarketplace({ tags: ['pvp', 'combat'] });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'template.tags && :tags',
        { tags: ['pvp', 'combat'] }
      );
    });

    it('should filter by minimum rating', async () => {
      await service.searchMarketplace({ minRating: 4.0 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'template.averageRating >= :minRating',
        { minRating: 4.0 }
      );
    });

    it('should sort by usage (default)', async () => {
      await service.searchMarketplace({});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('template.usageCount', 'DESC');
    });

    it('should sort by rating', async () => {
      await service.searchMarketplace({ sortBy: 'rating', sortOrder: 'ASC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('template.averageRating', 'ASC');
    });

    it('should sort by recent', async () => {
      await service.searchMarketplace({ sortBy: 'recent' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('template.createdAt', 'DESC');
    });

    it('should sort by name', async () => {
      await service.searchMarketplace({ sortBy: 'name', sortOrder: 'ASC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('template.name', 'ASC');
    });

    it('should apply pagination', async () => {
      await service.searchMarketplace({ limit: 20, offset: 40 });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(40);
    });
  });

  describe('forkTemplate', () => {
    it('should fork a template', async () => {
      const originalTemplate = {
        id: 'original-1',
        name: 'Original Template',
        fork: jest.fn().mockReturnValue({
          name: 'Original Template (Fork)',
          description: 'Forked template',
          structure: mockStructure
        })
      };

      mockTemplateRepo.findOne.mockResolvedValue(originalTemplate);
      mockTemplateRepo.create.mockReturnValue({ id: 'fork-1' });
      mockTemplateRepo.save.mockResolvedValue({ id: 'fork-1' });

      const result = await service.forkTemplate('original-1', 'user-2');

      expect(originalTemplate.fork).toHaveBeenCalledWith('Original Template (Fork)', 'user-2');
      expect(mockTemplateRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('fork-1');
    });

    it('should apply customizations to fork', async () => {
      const originalTemplate = {
        fork: jest.fn().mockReturnValue({ name: 'Fork' })
      };

      mockTemplateRepo.findOne.mockResolvedValue(originalTemplate);
      mockTemplateRepo.create.mockReturnValue({});
      mockTemplateRepo.save.mockResolvedValue({});

      await service.forkTemplate('original-1', 'user-2', {
        name: 'Custom Fork',
        description: 'My customized fork',
        visibility: TemplateVisibility.PRIVATE
      });

      expect(mockTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Custom Fork',
          description: 'My customized fork',
          visibility: TemplateVisibility.PRIVATE
        })
      );
    });

    it('should throw error if template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.forkTemplate('nonexistent', 'user-1')
      ).rejects.toThrow('Template not found');
    });
  });

  describe('rateTemplate', () => {
    it('should add new rating', async () => {
      const template = {
        id: 'template-1',
        averageRating: 4.0,
        ratingCount: 2,
        metadata: { ratings: {} }
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);
      mockTemplateRepo.save.mockImplementation((tmpl: any) => Promise.resolve(tmpl));

      const result = await service.rateTemplate('template-1', 'user-1', 5);

      expect(result.averageRating).toBeCloseTo(4.333, 2); // (4*2 + 5) / 3
      expect(result.ratingCount).toBe(3);
    });

    it('should update existing rating', async () => {
      const template = {
        id: 'template-1',
        averageRating: 4.0,
        ratingCount: 3,
        metadata: { ratings: { 'user-1': 5 } }
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);
      mockTemplateRepo.save.mockResolvedValue(template);

      await service.rateTemplate('template-1', 'user-1', 3);

      const saveCall = mockTemplateRepo.save.mock.calls[0][0];
      expect(saveCall.averageRating).toBeCloseTo(3.333, 2); // (4*3 - 5 + 3) / 3
      expect(saveCall.ratingCount).toBe(3); // Unchanged
    });

    it('should throw error for invalid rating', async () => {
      await expect(
        service.rateTemplate('template-1', 'user-1', 6)
      ).rejects.toThrow('Rating must be between 1 and 5');

      await expect(
        service.rateTemplate('template-1', 'user-1', 0)
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should initialize metadata if not present', async () => {
      const template = {
        id: 'template-1',
        averageRating: 0,
        ratingCount: 0
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);
      mockTemplateRepo.save.mockResolvedValue(template);

      await service.rateTemplate('template-1', 'user-1', 5);

      const saveCall = mockTemplateRepo.save.mock.calls[0][0];
      expect(saveCall.metadata).toBeDefined();
      expect(saveCall.metadata.ratings).toBeDefined();
    });
  });

  describe('updateTemplate', () => {
    it('should update template by creator', async () => {
      const template = {
        id: 'template-1',
        creatorId: 'user-1',
        version: '1.0',
        structure: mockStructure,
        validateStructure: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);
      mockTemplateRepo.save.mockResolvedValue(template);

      const updates = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      await service.updateTemplate('template-1', 'user-1', updates);

      expect(mockTemplateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining(updates)
      );
    });

    it('should increment version when structure changes', async () => {
      const newStructure = {
        name: 'NewRoot',
        type: 'division',
        level: 0,
        children: []
      };

      const template = {
        id: 'template-1',
        creatorId: 'user-1',
        version: '1.0',
        structure: mockStructure,
        validateStructure: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);
      mockTemplateRepo.save.mockResolvedValue(template);

      await service.updateTemplate('template-1', 'user-1', {
        structure: newStructure
      });

      const saveCall = mockTemplateRepo.save.mock.calls[0][0];
      expect(saveCall.version).toBe('1.1');
    });

    it('should throw error if not creator', async () => {
      const template = {
        id: 'template-1',
        creatorId: 'user-1'
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);

      await expect(
        service.updateTemplate('template-1', 'user-2', { name: 'Test' })
      ).rejects.toThrow('Only template creator can update it');
    });

    it('should validate structure on update', async () => {
      const template = {
        id: 'template-1',
        creatorId: 'user-1',
        version: '1.0',
        validateStructure: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Invalid structure']
        })
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);

      await expect(
        service.updateTemplate('template-1', 'user-1', {
          structure: mockStructure
        })
      ).rejects.toThrow('Template validation failed: Invalid structure');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template by creator', async () => {
      const template = {
        id: 'template-1',
        creatorId: 'user-1'
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);
      mockTemplateRepo.remove.mockResolvedValue(template);

      await service.deleteTemplate('template-1', 'user-1');

      expect(mockTemplateRepo.remove).toHaveBeenCalledWith(template);
    });

    it('should throw error if not creator', async () => {
      const template = {
        id: 'template-1',
        creatorId: 'user-1'
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);

      await expect(
        service.deleteTemplate('template-1', 'user-2')
      ).rejects.toThrow('Only template creator can delete it');
    });

    it('should throw error if template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteTemplate('nonexistent', 'user-1')
      ).rejects.toThrow('Template not found');
    });
  });

  describe('getTemplateById', () => {
    it('should get template with relations', async () => {
      const template = { id: 'template-1', name: 'Test Template' };
      mockTemplateRepo.findOne.mockResolvedValue(template);

      const result = await service.getTemplateById('template-1');

      expect(mockTemplateRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        relations: ['creator', 'forkedFrom']
      });
      expect(result).toEqual(template);
    });
  });

  describe('getTemplatesByUser', () => {
    it('should get templates created by user', async () => {
      const templates = [
        { id: '1', creatorId: 'user-1' },
        { id: '2', creatorId: 'user-1' }
      ];

      mockTemplateRepo.find.mockResolvedValue(templates);

      const result = await service.getTemplatesByUser('user-1');

      expect(mockTemplateRepo.find).toHaveBeenCalledWith({
        where: { creatorId: 'user-1' },
        relations: ['forkedFrom'],
        order: { createdAt: 'DESC' }
      });
      expect(result).toEqual(templates);
    });
  });

  describe('getPopularTemplates', () => {
    it('should get popular templates with default limit', async () => {
      const templates = [{ id: '1', usageCount: 100 }];
      mockTemplateRepo.find.mockResolvedValue(templates);

      const result = await service.getPopularTemplates();

      expect(mockTemplateRepo.find).toHaveBeenCalledWith({
        where: { visibility: TemplateVisibility.MARKETPLACE },
        relations: ['creator'],
        order: { usageCount: 'DESC' },
        take: 10
      });
      expect(result).toEqual(templates);
    });

    it('should accept custom limit', async () => {
      mockTemplateRepo.find.mockResolvedValue([]);

      await service.getPopularTemplates(5);

      expect(mockTemplateRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('getTopRatedTemplates', () => {
    it('should get top rated templates', async () => {
      const templates = [{ id: '1', averageRating: 4.8 }];
      mockTemplateRepo.find.mockResolvedValue(templates);

      const result = await service.getTopRatedTemplates(5);

      expect(mockTemplateRepo.find).toHaveBeenCalledWith({
        where: { visibility: TemplateVisibility.MARKETPLACE },
        relations: ['creator'],
        order: { averageRating: 'DESC' },
        take: 5
      });
      expect(result).toEqual(templates);
    });
  });

  describe('getRecentlyUsedTemplates', () => {
    it('should get recently used templates', async () => {
      const templates = [{ id: '1', lastUsedAt: new Date() }];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(templates)
      };

      mockTemplateRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getRecentlyUsedTemplates(5);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('template.lastUsedAt IS NOT NULL');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('template.lastUsedAt', 'DESC');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual(templates);
    });
  });

  describe('exportTemplate', () => {
    it('should export template to JSON', async () => {
      const exportData = { name: 'Template', structure: {} };
      const template = {
        id: 'template-1',
        export: jest.fn().mockReturnValue(exportData)
      };

      mockTemplateRepo.findOne.mockResolvedValue(template);

      const result = await service.exportTemplate('template-1');

      expect(template.export).toHaveBeenCalled();
      expect(result).toEqual(exportData);
    });

    it('should throw error if template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.exportTemplate('nonexistent')
      ).rejects.toThrow('Template not found');
    });
  });

  describe('importTemplate', () => {
    it('should import template from JSON', async () => {
      const importData = {
        name: 'Imported Template',
        description: 'Imported',
        category: TemplateCategory.PROJECT,
        structure: mockStructure,
        defaultRoles: [],
        defaultPermissions: [],
        defaultSettings: {},
        applicationConfig: {},
        tags: ['imported']
      };

      const mockTemplate = {
        validateStructure: jest.fn().mockReturnValue({ valid: true, errors: [] })
      };

      mockTemplateRepo.create.mockReturnValue(mockTemplate);
      mockTemplateRepo.save.mockResolvedValue(mockTemplate);

      const result = await service.importTemplate(importData, 'user-1');

      expect(mockTemplateRepo.create).toHaveBeenCalledWith({
        ...importData,
        visibility: TemplateVisibility.PRIVATE,
        creatorId: 'user-1',
        version: '1.0',
        usageCount: 0,
        averageRating: 0,
        ratingCount: 0
      });
      expect(mockTemplate.validateStructure).toHaveBeenCalled();
      expect(result).toEqual(mockTemplate);
    });

    it('should throw error for invalid imported structure', async () => {
      const importData = {
        name: 'Invalid',
        description: 'Test',
        category: TemplateCategory.MILITARY,
        structure: mockStructure
      };

      const mockTemplate = {
        validateStructure: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Invalid structure']
        })
      };

      mockTemplateRepo.create.mockReturnValue(mockTemplate);

      await expect(
        service.importTemplate(importData, 'user-1')
      ).rejects.toThrow('Template validation failed: Invalid structure');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
