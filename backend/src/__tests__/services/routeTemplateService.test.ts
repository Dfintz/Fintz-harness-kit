import {
    RiskLevel,
    ROUTE_TEMPLATES,
    RouteCategory,
    RouteDifficulty,
    RouteTemplateService,
    routeTemplateServiceInstance,
} from '../../services/trade/trading/RouteTemplateService';

describe('RouteTemplateService', () => {
  let service: RouteTemplateService;

  beforeEach(() => {
    service = new RouteTemplateService();
  });

  describe('getAllTemplates', () => {
    it('should return the full ROUTE_TEMPLATES catalog', () => {
      const result = service.getAllTemplates();
      expect(result).toBe(ROUTE_TEMPLATES);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should filter templates by category', () => {
      const result = service.getTemplatesByCategory(RouteCategory.BEGINNER);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(t => t.category === RouteCategory.BEGINNER)).toBe(true);
    });

    it('should return an empty array when no templates match', () => {
      // Use a category that is unlikely to be populated
      const result = service.getTemplatesByCategory('nonexistent' as RouteCategory);
      expect(result).toEqual([]);
    });
  });

  describe('getTemplatesByDifficulty', () => {
    it('should filter templates by difficulty', () => {
      const result = service.getTemplatesByDifficulty(RouteDifficulty.EASY);
      expect(result.every(t => t.difficulty === RouteDifficulty.EASY)).toBe(true);
    });
  });

  describe('getTemplatesByRiskLevel', () => {
    it('should filter templates by risk level', () => {
      const result = service.getTemplatesByRiskLevel(RiskLevel.LOW);
      expect(result.every(t => t.riskLevel === RiskLevel.LOW)).toBe(true);
    });
  });

  describe('getTemplatesForCargoCapacity', () => {
    it('should return templates with minCargoCapacity <= provided capacity', () => {
      const result = service.getTemplatesForCargoCapacity(10);
      expect(result.every(t => t.minCargoCapacity <= 10)).toBe(true);
    });

    it('should return an empty array when capacity is below all templates', () => {
      const result = service.getTemplatesForCargoCapacity(0);
      expect(result.every(t => t.minCargoCapacity <= 0)).toBe(true);
    });
  });

  describe('getTemplateById', () => {
    it('should return the matching template by id', () => {
      const first = ROUTE_TEMPLATES[0];
      const result = service.getTemplateById(first.id);
      expect(result).toBe(first);
    });

    it('should return undefined for an unknown id', () => {
      expect(service.getTemplateById('does-not-exist')).toBeUndefined();
    });
  });

  describe('searchByTag', () => {
    it('should match tags case-insensitively', () => {
      const result = service.searchByTag('BEGINNER');
      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every(t => t.tags.some(tag => tag.toLowerCase().includes('beginner')))
      ).toBe(true);
    });

    it('should match partial tag substrings', () => {
      const result = service.searchByTag('safe');
      expect(result.every(t => t.tags.some(tag => tag.toLowerCase().includes('safe')))).toBe(true);
    });

    it('should return an empty array when no tags match', () => {
      const result = service.searchByTag('no-such-tag-anywhere');
      expect(result).toEqual([]);
    });
  });

  describe('templateToDto', () => {
    it('should convert a template into a CreateTradingRouteDto with provenance tags', () => {
      const template = ROUTE_TEMPLATES[0];
      const dto = service.templateToDto(template, 'user-1', 'org-1');

      expect(dto.name).toBe(template.name);
      expect(dto.description).toBe(template.description);
      expect(dto.creatorId).toBe('user-1');
      expect(dto.organizationId).toBe('org-1');
      expect(dto.stops).toBe(template.stops);
      expect(dto.estimatedProfit).toBe(template.estimatedProfit);
      expect(dto.estimatedDuration).toBe(template.estimatedDuration);
      expect(dto.minCargoCapacity).toBe(template.minCargoCapacity);
      expect(dto.tags).toEqual([...template.tags, 'from-template', template.id]);
    });
  });

  describe('getBeginnerTemplates', () => {
    it('should return templates that are EASY difficulty or BEGINNER category', () => {
      const result = service.getBeginnerTemplates();
      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every(
          t => t.difficulty === RouteDifficulty.EASY || t.category === RouteCategory.BEGINNER
        )
      ).toBe(true);
    });
  });

  describe('getMostProfitableTemplates', () => {
    it('should return templates sorted by estimatedProfit descending', () => {
      const result = service.getMostProfitableTemplates(5);
      expect(result.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].estimatedProfit).toBeGreaterThanOrEqual(result[i].estimatedProfit);
      }
    });

    it('should respect the limit parameter', () => {
      const result = service.getMostProfitableTemplates(2);
      expect(result.length).toBe(2);
    });

    it('should not mutate the original ROUTE_TEMPLATES order', () => {
      const before = ROUTE_TEMPLATES.map(t => t.id);
      service.getMostProfitableTemplates(5);
      expect(ROUTE_TEMPLATES.map(t => t.id)).toEqual(before);
    });
  });

  describe('getFastestTemplates', () => {
    it('should return templates sorted by estimatedDuration ascending', () => {
      const result = service.getFastestTemplates(5);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].estimatedDuration).toBeLessThanOrEqual(result[i].estimatedDuration);
      }
    });

    it('should respect the limit parameter', () => {
      const result = service.getFastestTemplates(3);
      expect(result.length).toBe(3);
    });
  });

  describe('getBestProfitPerMinute', () => {
    it('should return templates sorted by profit-per-minute descending', () => {
      const result = service.getBestProfitPerMinute(5);
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1].estimatedProfit / result[i - 1].estimatedDuration;
        const curr = result[i].estimatedProfit / result[i].estimatedDuration;
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should respect the limit parameter', () => {
      const result = service.getBestProfitPerMinute(1);
      expect(result.length).toBe(1);
    });
  });

  describe('routeTemplateServiceInstance', () => {
    it('should export a singleton-style instance of RouteTemplateService', () => {
      expect(routeTemplateServiceInstance).toBeInstanceOf(RouteTemplateService);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
