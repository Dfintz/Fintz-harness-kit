const mockRuleRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockAllianceRepository = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockFederationMemberRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
};

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      const name = typeof entity === 'function' ? entity.name : '';
      if (name === 'FleetVisibilityRule') return mockRuleRepository;
      if (name === 'AllianceDiplomacy') return mockAllianceRepository;
      if (name === 'FederationMember') return mockFederationMemberRepository;
      return mockRuleRepository;
    }),
  },
}));

import { FleetVisibilityService } from '../../../services/fleet/FleetVisibilityService';
import { NotFoundError, ValidationError } from '../../../utils/apiErrors';

describe('FleetVisibilityService', () => {
  let service: FleetVisibilityService;
  const orgId = 'org-123';
  const fleetId = 'fleet-456';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FleetVisibilityService();
  });

  describe('getRulesForFleet', () => {
    it('should return rules for a fleet', async () => {
      const rules = [{ id: 'rule-1', fleetId, organizationId: orgId, scope: 'organization' }];
      mockRuleRepository.find.mockResolvedValue(rules);

      const result = await service.getRulesForFleet(orgId, fleetId);

      expect(mockRuleRepository.find).toHaveBeenCalledWith({
        where: { fleetId, organizationId: orgId },
        order: { scope: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toEqual(rules);
    });
  });

  describe('createRule', () => {
    it('should create an organization-scope rule', async () => {
      const ruleData = {
        scope: 'organization' as const,
        accessLevel: 'summary' as const,
        minSecurityLevel: 3,
      };

      mockRuleRepository.create.mockReturnValue({
        id: 'new-rule',
        ...ruleData,
        fleetId,
        organizationId: orgId,
        isActive: true,
      });
      mockRuleRepository.save.mockImplementation((r: unknown) => Promise.resolve(r));

      const result = await service.createRule(orgId, fleetId, ruleData);

      expect(mockRuleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'organization',
          accessLevel: 'summary',
          minSecurityLevel: 3,
          fleetId,
          organizationId: orgId,
        })
      );
      expect(result).toBeDefined();
    });

    it('should reject organization scope without minSecurityLevel', async () => {
      await expect(
        service.createRule(orgId, fleetId, {
          scope: 'organization',
          accessLevel: 'full',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject alliance scope without active alliance', async () => {
      mockAllianceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createRule(orgId, fleetId, {
          scope: 'alliance',
          accessLevel: 'summary',
          targetAllianceOrgId: 'allied-org',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should create alliance-scope rule with valid alliance', async () => {
      mockAllianceRepository.findOne.mockResolvedValue({
        id: 'alliance-1',
        orgId1: orgId,
        orgId2: 'allied-org',
        status: 'active',
      });

      const ruleData = {
        scope: 'alliance' as const,
        accessLevel: 'composition' as const,
        targetAllianceOrgId: 'allied-org',
      };

      mockRuleRepository.create.mockReturnValue({
        id: 'new-rule',
        ...ruleData,
        fleetId,
        organizationId: orgId,
        isActive: true,
      });
      mockRuleRepository.save.mockImplementation((r: unknown) => Promise.resolve(r));

      const result = await service.createRule(orgId, fleetId, ruleData);
      expect(result).toBeDefined();
      expect(result.scope).toBe('alliance');
    });

    it('should reject federation scope without membership', async () => {
      mockFederationMemberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createRule(orgId, fleetId, {
          scope: 'federation',
          accessLevel: 'full',
          targetFederationId: 'fed-123',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should create federation-scope rule with valid membership', async () => {
      mockFederationMemberRepository.findOne.mockResolvedValue({
        federationId: 'fed-123',
        organizationId: orgId,
        status: 'active',
      });

      const ruleData = {
        scope: 'federation' as const,
        accessLevel: 'full' as const,
        targetFederationId: 'fed-123',
      };

      mockRuleRepository.create.mockReturnValue({
        id: 'new-rule',
        ...ruleData,
        fleetId,
        organizationId: orgId,
        isActive: true,
      });
      mockRuleRepository.save.mockImplementation((r: unknown) => Promise.resolve(r));

      const result = await service.createRule(orgId, fleetId, ruleData);
      expect(result.scope).toBe('federation');
    });

    it('should reject invalid minSecurityLevel range', async () => {
      await expect(
        service.createRule(orgId, fleetId, {
          scope: 'organization',
          accessLevel: 'full',
          minSecurityLevel: 0,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createRule(orgId, fleetId, {
          scope: 'organization',
          accessLevel: 'full',
          minSecurityLevel: 101,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateRule', () => {
    it('should update an existing rule', async () => {
      const existingRule = {
        id: 'rule-1',
        organizationId: orgId,
        scope: 'organization',
        accessLevel: 'summary',
        minSecurityLevel: 3,
        isActive: true,
      };
      mockRuleRepository.findOne.mockResolvedValue({ ...existingRule });
      mockRuleRepository.save.mockImplementation((r: unknown) => Promise.resolve(r));

      const result = await service.updateRule(orgId, 'rule-1', {
        accessLevel: 'full',
        minSecurityLevel: 5,
      });

      expect(result.accessLevel).toBe('full');
      expect(result.minSecurityLevel).toBe(5);
    });

    it('should throw NotFoundError for non-existent rule', async () => {
      mockRuleRepository.findOne.mockResolvedValue(null);

      await expect(service.updateRule(orgId, 'missing', { isActive: false })).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteRule', () => {
    it('should delete an existing rule', async () => {
      const rule = { id: 'rule-1', organizationId: orgId };
      mockRuleRepository.findOne.mockResolvedValue(rule);
      mockRuleRepository.remove.mockResolvedValue(rule);

      await service.deleteRule(orgId, 'rule-1');

      expect(mockRuleRepository.remove).toHaveBeenCalledWith(rule);
    });

    it('should throw NotFoundError for non-existent rule', async () => {
      mockRuleRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteRule(orgId, 'missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('resolveAccessLevel', () => {
    it('should return full access for same-org with no rules', async () => {
      mockRuleRepository.find.mockResolvedValue([]);

      const result = await service.resolveAccessLevel(orgId, orgId, fleetId, 5);

      expect(result).toBe('full');
    });

    it('should return highest matching access for org-level rules', async () => {
      mockRuleRepository.find.mockResolvedValue([
        { scope: 'organization', minSecurityLevel: 1, accessLevel: 'summary', isActive: true },
        { scope: 'organization', minSecurityLevel: 3, accessLevel: 'composition', isActive: true },
        { scope: 'organization', minSecurityLevel: 5, accessLevel: 'full', isActive: true },
      ]);

      const result = await service.resolveAccessLevel(orgId, orgId, fleetId, 3);

      expect(result).toBe('composition');
    });

    it('should return null for insufficient security level', async () => {
      mockRuleRepository.find.mockResolvedValue([
        { scope: 'organization', minSecurityLevel: 5, accessLevel: 'summary', isActive: true },
      ]);

      const result = await service.resolveAccessLevel(orgId, orgId, fleetId, 2);

      expect(result).toBeNull();
    });
  });
});
