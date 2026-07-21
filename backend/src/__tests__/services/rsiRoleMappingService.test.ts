import {
  RsiRoleMappingService,
  rsiRoleMappingService,
} from '../../services/external/RsiRoleMappingService';

// Mock the AppDataSource
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      create: jest.fn((data: Record<string, unknown>) => ({ id: 'test-uuid', ...data })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'test-uuid', ...entity })
      ),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RsiRoleMappingService', () => {
  let service: RsiRoleMappingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RsiRoleMappingService();
  });

  describe('Constructor', () => {
    it('should initialize the service', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(RsiRoleMappingService);
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return available templates', () => {
      const templates = service.getAvailableTemplates();

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      // Check standard template exists
      const standardTemplate = templates.find(t => t.name === 'standard');
      expect(standardTemplate).toBeDefined();
      expect(standardTemplate?.description).toBeDefined();
      expect(standardTemplate?.rankCount).toBeGreaterThan(0);
    });

    it('should include military template', () => {
      const templates = service.getAvailableTemplates();
      const militaryTemplate = templates.find(t => t.name === 'military');

      expect(militaryTemplate).toBeDefined();
      expect(militaryTemplate?.name).toBe('military');
    });

    it('should include corporate template', () => {
      const templates = service.getAvailableTemplates();
      const corporateTemplate = templates.find(t => t.name === 'corporate');

      expect(corporateTemplate).toBeDefined();
      expect(corporateTemplate?.name).toBe('corporate');
    });
  });

  describe('getTemplateDetails', () => {
    it('should return template details for standard template', () => {
      const template = service.getTemplateDetails('standard');

      expect(template).toBeDefined();
      expect(template?.name).toBe('standard');
      expect(template?.description).toBeDefined();
      expect(template?.mappings).toBeDefined();
      expect(Array.isArray(template?.mappings)).toBe(true);
      expect(template?.mappings.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent template', () => {
      const template = service.getTemplateDetails('nonexistent');
      expect(template).toBeNull();
    });

    it('should include correct structure in template mappings', () => {
      const template = service.getTemplateDetails('military');

      expect(template).toBeDefined();
      expect(template?.mappings[0]).toHaveProperty('rsiRank');
      expect(template?.mappings[0]).toHaveProperty('rbacPermissions');
      expect(template?.mappings[0]).toHaveProperty('priority');
    });
  });

  describe('isValidDiscordRoleId', () => {
    it('should validate correct Discord role IDs', () => {
      expect(service.isValidDiscordRoleId('123456789012345678')).toBe(true);
      expect(service.isValidDiscordRoleId('12345678901234567890')).toBe(true);
      expect(service.isValidDiscordRoleId('12345678901234567')).toBe(true);
    });

    it('should reject invalid Discord role IDs', () => {
      expect(service.isValidDiscordRoleId('123')).toBe(false);
      expect(service.isValidDiscordRoleId('abc')).toBe(false);
      expect(service.isValidDiscordRoleId('12345678901234567abc')).toBe(false);
      expect(service.isValidDiscordRoleId('')).toBe(false);
    });
  });

  describe('DEFAULT_TEMPLATES', () => {
    it('should have correct structure for all templates', () => {
      const templates = RsiRoleMappingService.DEFAULT_TEMPLATES;

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);

      for (const template of templates) {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('mappings');
        expect(typeof template.name).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(Array.isArray(template.mappings)).toBe(true);
      }
    });

    it('should have valid RBAC permissions in templates', () => {
      const templates = RsiRoleMappingService.DEFAULT_TEMPLATES;

      for (const template of templates) {
        for (const mapping of template.mappings) {
          expect(mapping).toHaveProperty('rsiRank');
          expect(mapping).toHaveProperty('rbacPermissions');
          expect(mapping).toHaveProperty('priority');
          expect(typeof mapping.rsiRank).toBe('string');
          expect(typeof mapping.priority).toBe('number');
          expect(typeof mapping.rbacPermissions).toBe('object');
        }
      }
    });

    it('should have admin permissions for top-level ranks', () => {
      const templates = RsiRoleMappingService.DEFAULT_TEMPLATES;

      for (const template of templates) {
        // First mapping should have highest priority and admin permissions
        const topRank = template.mappings[0];
        expect(topRank.rbacPermissions.admin).toBe(true);
        expect(topRank.priority).toBeGreaterThan(0);
      }
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(rsiRoleMappingService).toBeDefined();
      expect(rsiRoleMappingService).toBeInstanceOf(RsiRoleMappingService);
    });
  });
});

describe('RsiRoleMappingService - Template Content', () => {
  let service: RsiRoleMappingService;

  beforeEach(() => {
    service = new RsiRoleMappingService();
  });

  describe('Standard template', () => {
    it('should have all 4 fixed RSI roles', () => {
      const template = service.getTemplateDetails('standard');

      expect(template).toBeDefined();
      const ranks = template?.mappings.map(m => m.rsiRank);

      expect(ranks).toContain('Founder');
      expect(ranks).toContain('Officer');
      expect(ranks).toContain('Recruitment');
      expect(ranks).toContain('Marketing');
    });

    it('should have all 6 star-based ranks', () => {
      const template = service.getTemplateDetails('standard');

      expect(template).toBeDefined();
      const ranks = template?.mappings.map(m => m.rsiRank);

      expect(ranks).toContain('Rank 5');
      expect(ranks).toContain('Rank 4');
      expect(ranks).toContain('Rank 3');
      expect(ranks).toContain('Rank 2');
      expect(ranks).toContain('Rank 1');
      expect(ranks).toContain('Rank 0');
    });

    it('should have 10 mappings total (4 roles + 6 ranks)', () => {
      const template = service.getTemplateDetails('standard');
      expect(template?.mappings).toHaveLength(10);
    });

    it('should have correct priority order', () => {
      const template = service.getTemplateDetails('standard');

      expect(template).toBeDefined();
      const priorities = template?.mappings.map(m => m.priority);

      // Verify priorities are in descending order
      if (priorities) {
        for (let i = 0; i < priorities.length - 1; i++) {
          expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i + 1]);
        }
      }
    });
  });

  describe('Military template', () => {
    it('should have all 4 fixed RSI roles', () => {
      const template = service.getTemplateDetails('military');

      expect(template).toBeDefined();
      const ranks = template?.mappings.map(m => m.rsiRank);

      expect(ranks).toContain('Founder');
      expect(ranks).toContain('Officer');
      expect(ranks).toContain('Recruitment');
      expect(ranks).toContain('Marketing');
    });

    it('should have expected military star-based ranks', () => {
      const template = service.getTemplateDetails('military');

      expect(template).toBeDefined();
      const ranks = template?.mappings.map(m => m.rsiRank);

      expect(ranks).toContain('Admiral');
      expect(ranks).toContain('Captain');
      expect(ranks).toContain('Commander');
      expect(ranks).toContain('Lieutenant');
    });

    it('should have 10 mappings total (4 roles + 6 ranks)', () => {
      const template = service.getTemplateDetails('military');
      expect(template?.mappings).toHaveLength(10);
    });
  });

  describe('Corporate template', () => {
    it('should have all 4 fixed RSI roles', () => {
      const template = service.getTemplateDetails('corporate');

      expect(template).toBeDefined();
      const ranks = template?.mappings.map(m => m.rsiRank);

      expect(ranks).toContain('Founder');
      expect(ranks).toContain('Officer');
      expect(ranks).toContain('Recruitment');
      expect(ranks).toContain('Marketing');
    });

    it('should have expected corporate star-based ranks', () => {
      const template = service.getTemplateDetails('corporate');

      expect(template).toBeDefined();
      const ranks = template?.mappings.map(m => m.rsiRank);

      expect(ranks).toContain('CEO');
      expect(ranks).toContain('Executive');
      expect(ranks).toContain('Manager');
      expect(ranks).toContain('Associate');
    });

    it('should have 10 mappings total (4 roles + 6 ranks)', () => {
      const template = service.getTemplateDetails('corporate');
      expect(template?.mappings).toHaveLength(10);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
