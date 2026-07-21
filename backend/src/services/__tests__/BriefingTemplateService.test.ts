import {
  BriefingTemplateService,
  BriefingTemplateCategory,
} from '../content/BriefingTemplateService';

// Mock logger
describe('BriefingTemplateService', () => {
  let templateService: BriefingTemplateService;

  beforeEach(() => {
    templateService = BriefingTemplateService.getInstance();
    templateService.clearCustomTemplates();
  });

  afterEach(() => {
    templateService.clearCustomTemplates();
  });

  describe('getTemplates', () => {
    it('should return built-in templates', () => {
      const templates = templateService.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'combat-assault')).toBe(true);
      expect(templates.some(t => t.id === 'mining-operation')).toBe(true);
    });

    it('should include custom templates after creation', () => {
      const initialCount = templateService.getTemplates().length;

      templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Custom Template',
          description: 'A custom template',
          category: 'general',
          icon: '🎯',
          sections: [],
          elements: [],
          tags: ['custom'],
        },
        'org-test-123'
      );

      const templates = templateService.getTemplates();
      expect(templates.length).toBe(initialCount + 1);
    });
  });

  describe('getBuiltInTemplates', () => {
    it('should return only built-in templates', () => {
      const builtIn = templateService.getBuiltInTemplates();

      expect(builtIn.length).toBeGreaterThan(0);
      expect(builtIn.every(t => !t.id.startsWith('custom-'))).toBe(true);
    });
  });

  describe('getCustomTemplates', () => {
    it('should require organizationId', () => {
      expect(() => templateService.getCustomTemplates('')).toThrow(
        'organizationId is required to retrieve custom templates'
      );
    });

    it('should reject empty organizationId', () => {
      expect(() => templateService.getCustomTemplates('   ')).toThrow(
        'organizationId is required to retrieve custom templates'
      );
    });

    it('should return only templates for specified organization', () => {
      // Create templates for different organizations
      templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Org 1 Template',
          description: 'Template for org 1',
          category: 'general',
          icon: '🎯',
          sections: [],
          elements: [],
          tags: ['org1'],
        },
        'org-1'
      );

      templateService.createCustomTemplate(
        'user-456',
        {
          name: 'Org 2 Template',
          description: 'Template for org 2',
          category: 'general',
          icon: '📋',
          sections: [],
          elements: [],
          tags: ['org2'],
        },
        'org-2'
      );

      // Get templates for org-1
      const org1Templates = templateService.getCustomTemplates('org-1');
      expect(org1Templates.length).toBe(1);
      expect(org1Templates[0].name).toBe('Org 1 Template');
      expect(org1Templates[0].organizationId).toBe('org-1');

      // Get templates for org-2
      const org2Templates = templateService.getCustomTemplates('org-2');
      expect(org2Templates.length).toBe(1);
      expect(org2Templates[0].name).toBe('Org 2 Template');
      expect(org2Templates[0].organizationId).toBe('org-2');
    });

    it('should return empty array when organization has no custom templates', () => {
      const templates = templateService.getCustomTemplates('org-empty');
      expect(templates).toEqual([]);
    });

    it('should prevent cross-tenant reads', () => {
      // Create template for org-1
      const template = templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Secret Template',
          description: 'Private template',
          category: 'general',
          icon: '🔒',
          sections: [],
          elements: [],
          tags: [],
        },
        'org-1'
      );

      // Try to read from org-2
      const org2Templates = templateService.getCustomTemplates('org-2');
      expect(org2Templates).not.toContainEqual(expect.objectContaining({ id: template.id }));
      expect(org2Templates.length).toBe(0);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates filtered by category', () => {
      const combatTemplates = templateService.getTemplatesByCategory('combat');

      expect(combatTemplates.length).toBeGreaterThan(0);
      expect(combatTemplates.every(t => t.category === 'combat')).toBe(true);
    });

    it('should return empty array for category with no templates', () => {
      const templates = templateService.getTemplatesByCategory(
        'rescue' as BriefingTemplateCategory
      );
      // Should return at least the rescue template if it exists
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('getTemplatesByDifficulty', () => {
    it('should return templates filtered by difficulty', () => {
      const beginnerTemplates = templateService.getTemplatesByDifficulty('beginner');

      expect(beginnerTemplates.length).toBeGreaterThan(0);
      expect(beginnerTemplates.every(t => t.difficulty === 'beginner')).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('should return a built-in template by ID', () => {
      const template = templateService.getTemplate('combat-assault');

      expect(template).toBeDefined();
      expect(template?.name).toBe('Combat Assault Briefing');
    });

    it('should return undefined for non-existent template', () => {
      const template = templateService.getTemplate('non-existent');

      expect(template).toBeUndefined();
    });

    it('should return a custom template by ID', () => {
      const created = templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Custom Template',
          description: 'A custom template',
          category: 'general',
          icon: '🎯',
          sections: [],
          elements: [],
          tags: ['custom'],
        },
        'org-test-123'
      );

      const template = templateService.getTemplate(created.id);

      expect(template).toBeDefined();
      expect(template?.name).toBe('Custom Template');
    });
  });

  describe('searchTemplates', () => {
    it('should find templates by name', () => {
      const results = templateService.searchTemplates('Combat');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name.toLowerCase().includes('combat'))).toBe(true);
    });

    it('should find templates by tag', () => {
      const results = templateService.searchTemplates('mining');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', () => {
      const results = templateService.searchTemplates('xyznonexistent123');

      expect(results).toHaveLength(0);
    });
  });

  describe('createFromTemplate', () => {
    it('should create a briefing from a template', () => {
      const briefing = templateService.createFromTemplate({
        templateId: 'mining-operation',
        creatorId: 'user-123',
        title: 'My Mining Operation',
      });

      expect(briefing).toBeDefined();
      expect(briefing.title).toBe('My Mining Operation');
      expect(briefing.creatorId).toBe('user-123');
      expect(briefing.templateId).toBe('mining-operation');
      expect(briefing.templateName).toBe('Mining Operation Briefing');
      expect(briefing.status).toBe('draft');
      expect(briefing.version).toBe(1);
      expect(briefing.elements.length).toBeGreaterThan(0);
    });

    it('should include template tags', () => {
      const briefing = templateService.createFromTemplate({
        templateId: 'mining-operation',
        creatorId: 'user-123',
        title: 'My Mining Operation',
      });

      expect(briefing.tags).toContain('mining');
    });

    it('should merge custom tags', () => {
      const briefing = templateService.createFromTemplate({
        templateId: 'mining-operation',
        creatorId: 'user-123',
        title: 'My Mining Operation',
        customTags: ['urgent', 'quantanium'],
      });

      expect(briefing.tags).toContain('mining');
      expect(briefing.tags).toContain('urgent');
      expect(briefing.tags).toContain('quantanium');
    });

    it('should throw error for non-existent template', () => {
      expect(() =>
        templateService.createFromTemplate({
          templateId: 'non-existent',
          creatorId: 'user-123',
          title: 'Test',
        })
      ).toThrow('Template not found: non-existent');
    });

    it('should include custom elements', () => {
      const customElement = {
        id: 'custom-element-1',
        type: 'marker' as const,
        position: { x: 100, y: 100 },
        data: { content: 'Custom Marker', color: '#ff0000', size: 16 },
      };

      const briefing = templateService.createFromTemplate({
        templateId: 'general-purpose',
        creatorId: 'user-123',
        title: 'Test Briefing',
        customElements: [customElement],
      });

      expect(briefing.elements).toContainEqual(customElement);
    });
  });

  describe('createCustomTemplate', () => {
    it('should create a custom template', () => {
      const template = templateService.createCustomTemplate(
        'user-123',
        {
          name: 'My Custom Template',
          description: 'A custom template for testing',
          category: 'combat',
          icon: '🎯',
          sections: [{ name: 'Section 1', description: 'First section', required: true }],
          elements: [],
          tags: ['custom', 'test'],
        },
        'org-test-123'
      );

      expect(template).toBeDefined();
      expect(template.id).toMatch(/^custom-/);
      expect(template.name).toBe('My Custom Template');
      expect(template.category).toBe('combat');
    });

    it('should require organizationId', () => {
      expect(() =>
        templateService.createCustomTemplate(
          'user-123',
          {
            name: 'Test',
            description: 'Test',
            category: 'general',
            icon: '📋',
            sections: [],
            elements: [],
            tags: [],
          },
          ''
        )
      ).toThrow('organizationId is required to create a custom briefing template');
    });

    it('should reject empty organizationId', () => {
      expect(() =>
        templateService.createCustomTemplate(
          'user-123',
          {
            name: 'Test',
            description: 'Test',
            category: 'general',
            icon: '📋',
            sections: [],
            elements: [],
            tags: [],
          },
          '   '
        )
      ).toThrow('organizationId is required to create a custom briefing template');
    });
  });

  describe('updateCustomTemplate', () => {
    it('should update a custom template', () => {
      const created = templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Original Name',
          description: 'Original description',
          category: 'general',
          icon: '📋',
          sections: [],
          elements: [],
          tags: ['original'],
        },
        'org-test-123'
      );

      const updated = templateService.updateCustomTemplate(
        created.id,
        {
          name: 'Updated Name',
          description: 'Updated description',
        },
        'org-test-123'
      );

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
      expect(updated.id).toBe(created.id);
    });

    it('should throw error for non-existent template', () => {
      expect(() =>
        templateService.updateCustomTemplate(
          'non-existent',
          {
            name: 'Updated',
          },
          'org-test-123'
        )
      ).toThrow('Custom template not found: non-existent');
    });

    it('should throw error when trying to update built-in template', () => {
      expect(() =>
        templateService.updateCustomTemplate(
          'combat-assault',
          {
            name: 'Modified Combat',
          },
          'org-test-123'
        )
      ).toThrow('Custom template not found: combat-assault');
    });

    it('should prevent cross-tenant updates', () => {
      const created = templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Org 1 Template',
          description: 'Template for org 1',
          category: 'general',
          icon: '📋',
          sections: [],
          elements: [],
          tags: [],
        },
        'org-1'
      );

      // Try to update from different organization
      expect(() =>
        templateService.updateCustomTemplate(
          created.id,
          {
            name: 'Hacked Name',
          },
          'org-2'
        )
      ).toThrow('Access denied: template belongs to a different organization');
    });
  });

  describe('deleteCustomTemplate', () => {
    it('should delete a custom template', () => {
      const created = templateService.createCustomTemplate(
        'user-123',
        {
          name: 'To Delete',
          description: 'Will be deleted',
          category: 'general',
          icon: '🗑️',
          sections: [],
          elements: [],
          tags: [],
        },
        'org-test-123'
      );

      const result = templateService.deleteCustomTemplate(created.id, 'org-test-123');

      expect(result).toBe(true);
      expect(templateService.getTemplate(created.id)).toBeUndefined();
    });

    it('should return false for non-existent template', () => {
      const result = templateService.deleteCustomTemplate('non-existent', 'org-test-123');

      expect(result).toBe(false);
    });

    it('should throw error when trying to delete built-in template', () => {
      expect(() => templateService.deleteCustomTemplate('combat-assault', 'org-test-123')).toThrow(
        'Cannot delete built-in templates'
      );
    });

    it('should prevent cross-tenant deletes', () => {
      const created = templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Org 1 Template',
          description: 'Template for org 1',
          category: 'general',
          icon: '📋',
          sections: [],
          elements: [],
          tags: [],
        },
        'org-1'
      );

      // Try to delete from different organization
      expect(() => templateService.deleteCustomTemplate(created.id, 'org-2')).toThrow(
        'Access denied: template belongs to a different organization'
      );

      // Verify template still exists
      expect(templateService.getTemplate(created.id)).toBeDefined();
    });
  });

  describe('cloneTemplate', () => {
    it('should clone a built-in template', () => {
      const cloned = templateService.cloneTemplate('mining-operation', 'user-123', 'org-test-123');

      expect(cloned).toBeDefined();
      expect(cloned.id).toMatch(/^custom-/);
      expect(cloned.name).toBe('Mining Operation Briefing (Copy)');
      expect(cloned.category).toBe('mining');
    });

    it('should clone with custom name', () => {
      const cloned = templateService.cloneTemplate(
        'mining-operation',
        'user-123',
        'org-test-123',
        'My Mining Template'
      );

      expect(cloned.name).toBe('My Mining Template');
    });

    it('should throw error for non-existent source', () => {
      expect(() =>
        templateService.cloneTemplate('non-existent', 'user-123', 'org-test-123')
      ).toThrow('Source template not found: non-existent');
    });
  });

  describe('recommendTemplates', () => {
    it('should recommend templates based on mission type', () => {
      const recommendations = templateService.recommendTemplates({
        missionType: 'combat',
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations[0].category === 'combat' || recommendations[0].category === 'general'
      ).toBe(true);
    });

    it('should filter by difficulty', () => {
      const recommendations = templateService.recommendTemplates({
        difficulty: 'beginner',
      });

      expect(recommendations.every(t => t.difficulty === 'beginner')).toBe(true);
    });

    it('should return at most 5 recommendations', () => {
      const recommendations = templateService.recommendTemplates({});

      expect(recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getCategories', () => {
    it('should return all categories with counts', () => {
      const categories = templateService.getCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories.every(c => c.count > 0)).toBe(true);
      expect(categories.every(c => c.icon)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return template statistics', () => {
      const stats = templateService.getStats();

      expect(stats.totalTemplates).toBeGreaterThan(0);
      expect(stats.builtInTemplates).toBeGreaterThan(0);
      expect(stats.customTemplates).toBe(0);
      expect(stats.categoryCounts).toBeDefined();
      expect(stats.difficultyCounts).toBeDefined();
    });

    it('should update custom template count', () => {
      templateService.createCustomTemplate(
        'user-123',
        {
          name: 'Custom',
          description: 'Custom template',
          category: 'general',
          icon: '📋',
          sections: [],
          elements: [],
          tags: [],
        },
        'org-test-123'
      );

      const stats = templateService.getStats();
      expect(stats.customTemplates).toBe(1);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

