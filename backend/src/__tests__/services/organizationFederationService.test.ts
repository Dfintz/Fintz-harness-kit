import type { FederationGovernance, FederationTreaty } from '@sc-fleet-manager/shared-types';
import { AppDataSource } from '../../data-source';
import { AllianceDiplomacy } from '../../models/AllianceDiplomacy';
import { Federation } from '../../models/Federation';
import { FederationAmbassador } from '../../models/FederationAmbassador';
import { FederationMember } from '../../models/FederationMember';
import { FederationProposal } from '../../models/FederationProposal';
import { Organization } from '../../models/Organization';
import { OrganizationRelationship } from '../../models/OrganizationRelationship';
import { PublicOrgProfile } from '../../models/PublicOrgProfile';
import { User } from '../../models/User';
import { OrganizationFederationService } from '../../services/organization/OrganizationFederationService';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    createQueryRunner: jest.fn(),
    isInitialized: true,
  },
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    createQueryRunner: jest.fn(),
    isInitialized: true,
  },
}));

jest.mock('../../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return { logger: mockLogger, default: mockLogger, __esModule: true };
});

// ── Mock Repositories ──────────────────────────────────────────────────────────

const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

/**
 * Create a mock QueryRunner for transaction-based methods.
 * The `manager.create` and `manager.save` calls delegate to entity-specific
 * mock repositories via the provided repo map.
 */
const createMockQueryRunner = (repoMap: Map<unknown, ReturnType<typeof createMockRepository>>) => {
  const mockManager = {
    create: jest.fn((entity: unknown, data: unknown) => {
      const repo = repoMap.get(entity);
      return repo ? repo.create(data) : data;
    }),
    save: jest.fn((entity: unknown, data: unknown) => {
      const repo = repoMap.get(entity);
      return repo ? repo.save(data) : Promise.resolve(data);
    }),
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 'user-founder', username: 'founder', displayName: 'Founder User' }),
  };
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: mockManager,
  };
};

const createQueryBuilderMock = (results: unknown[] = []) => {
  const qb: Record<string, jest.Mock> = {};
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.addOrderBy = jest.fn().mockReturnValue(qb);
  qb.skip = jest.fn().mockReturnValue(qb);
  qb.take = jest.fn().mockReturnValue(qb);
  qb.select = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue(results);
  qb.getOne = jest.fn().mockResolvedValue(results[0] ?? null);
  qb.getCount = jest.fn().mockResolvedValue(results.length);
  return qb;
};

let mockFederationRepo: ReturnType<typeof createMockRepository>;
let mockMemberRepo: ReturnType<typeof createMockRepository>;
let mockProposalRepo: ReturnType<typeof createMockRepository>;
let mockOrgRepo: ReturnType<typeof createMockRepository>;
let mockRelationshipRepo: ReturnType<typeof createMockRepository>;
let mockDiplomacyRepo: ReturnType<typeof createMockRepository>;
let mockProfileRepo: ReturnType<typeof createMockRepository>;
let mockAmbassadorRepo: ReturnType<typeof createMockRepository>;
let mockQueryRunner: ReturnType<typeof createMockQueryRunner>;

// ── Test Data ──────────────────────────────────────────────────────────────────

const defaultGovernance: FederationGovernance = {
  votingSystem: 'majority',
  requiredApprovalThreshold: 51,
  councilSize: 5,
  leaderTermDays: 90,
  amendmentThreshold: 67,
};

const founderMemberEntity: Partial<FederationMember> = {
  id: 'member-001',
  federationId: 'fed-001',
  organizationId: 'org-founder',
  organizationName: 'Founder Org',
  role: 'founder',
  joinedAt: new Date('2025-01-01'),
  status: 'active',
  votingPower: 1,
  contributions: 0,
};

const secondMemberEntity: Partial<FederationMember> = {
  id: 'member-002',
  federationId: 'fed-001',
  organizationId: 'org-member',
  organizationName: 'Member Org',
  role: 'member',
  joinedAt: new Date('2025-01-10'),
  status: 'active',
  votingPower: 1,
  contributions: 0,
};

const pendingMemberEntity: Partial<FederationMember> = {
  id: 'member-003',
  federationId: 'fed-001',
  organizationId: 'org-pending',
  organizationName: 'Pending Org',
  role: 'member',
  joinedAt: new Date('2025-01-15'),
  status: 'pending',
  votingPower: 1,
  contributions: 0,
};

const baseFederationEntity: Partial<Federation> = {
  id: 'fed-001',
  name: 'Test Federation',
  description: 'A test federation',
  founderId: 'user-founder',
  founderOrgId: 'org-founder',
  createdAt: new Date('2025-01-01'),
  governance: defaultGovernance,
  members: [founderMemberEntity as FederationMember, secondMemberEntity as FederationMember],
  sharedResources: [],
  treaties: [],
  status: 'active',
  isPublic: true,
  tags: ['combat', 'defense'],
};

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('OrganizationFederationService', () => {
  let service: OrganizationFederationService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (OrganizationFederationService as any).instance = undefined;

    // Create fresh mock repos
    mockFederationRepo = createMockRepository();
    mockMemberRepo = createMockRepository();
    mockProposalRepo = createMockRepository();
    mockOrgRepo = createMockRepository();
    mockRelationshipRepo = createMockRepository();
    mockDiplomacyRepo = createMockRepository();
    mockProfileRepo = createMockRepository();
    mockAmbassadorRepo = createMockRepository();

    // Route getRepository calls to the correct mock based on entity class
    const repoMap = new Map<unknown, ReturnType<typeof createMockRepository>>();
    repoMap.set(Federation, mockFederationRepo);
    repoMap.set(FederationMember, mockMemberRepo);
    repoMap.set(FederationProposal, mockProposalRepo);
    repoMap.set(Organization, mockOrgRepo);
    repoMap.set(OrganizationRelationship, mockRelationshipRepo);
    repoMap.set(AllianceDiplomacy, mockDiplomacyRepo);
    repoMap.set(PublicOrgProfile, mockProfileRepo);
    repoMap.set(FederationAmbassador, mockAmbassadorRepo);
    repoMap.set(User, { ...createMockRepository() });

    // Create mock query runner for transaction-based methods
    mockQueryRunner = createMockQueryRunner(repoMap);
    (AppDataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      return repoMap.get(entity) ?? createMockRepository();
    });

    service = OrganizationFederationService.getInstance();

    // Default: memberRepo.findOne resolves members from baseFederationEntity
    // so that `findMember()` (targeted query) works the same as the old
    // in-memory `.find()` on `federation.members`.
    mockMemberRepo.findOne.mockImplementation(
      async (opts: { where: { federationId?: string; organizationId?: string } }) => {
        const orgId = opts?.where?.organizationId;
        return (
          [founderMemberEntity, secondMemberEntity].find(m => m.organizationId === orgId) ?? null
        );
      }
    );
  });

  // ── Singleton ──────────────────────────────────────────────────────────────

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = OrganizationFederationService.getInstance();
      const instance2 = OrganizationFederationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ── createFederation ───────────────────────────────────────────────────────

  describe('createFederation', () => {
    it('should create a federation with default governance', async () => {
      const savedFederation = { ...baseFederationEntity, status: 'forming' };
      mockFederationRepo.create.mockReturnValue(savedFederation);
      mockFederationRepo.save.mockResolvedValue(savedFederation);
      mockMemberRepo.create.mockReturnValue(founderMemberEntity);
      mockMemberRepo.save.mockResolvedValue(founderMemberEntity);
      // loadFederation returns the saved entity with members
      mockFederationRepo.findOne.mockResolvedValue({
        ...savedFederation,
        members: [founderMemberEntity],
      });
      // Duplicate name check returns no match
      mockFederationRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

      const result = await service.createFederation('user-founder', 'org-founder', 'Founder Org', {
        name: 'Test Federation',
        description: 'A test federation',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Federation');
      expect(result.status).toBe('forming');
      expect(result.members.length).toBe(1);
      expect(result.members[0].role).toBe('founder');
      expect(mockFederationRepo.create).toHaveBeenCalled();
      expect(mockFederationRepo.save).toHaveBeenCalled();
      expect(mockMemberRepo.create).toHaveBeenCalled();
      expect(mockMemberRepo.save).toHaveBeenCalled();
      // Founder ambassador auto-created with all permissions
      expect(mockAmbassadorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-founder',
          organizationId: 'org-founder',
          role: 'council',
          permissions: expect.arrayContaining(['view', 'vote', 'announce', 'settings']),
          title: 'Founder',
        })
      );
      expect(mockAmbassadorRepo.save).toHaveBeenCalled();
      // Transaction lifecycle
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should apply custom governance settings', async () => {
      const customGovernance: Partial<FederationGovernance> = {
        votingSystem: 'unanimous',
        councilSize: 3,
      };
      const savedFederation = {
        ...baseFederationEntity,
        governance: { ...defaultGovernance, ...customGovernance },
        status: 'forming',
      };
      mockFederationRepo.create.mockReturnValue(savedFederation);
      mockFederationRepo.save.mockResolvedValue(savedFederation);
      mockMemberRepo.create.mockReturnValue(founderMemberEntity);
      mockMemberRepo.save.mockResolvedValue(founderMemberEntity);
      mockFederationRepo.findOne.mockResolvedValue({
        ...savedFederation,
        members: [founderMemberEntity],
      });
      // Duplicate name check returns no match
      mockFederationRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

      const result = await service.createFederation('user-founder', 'org-founder', 'Founder Org', {
        name: 'Test Federation',
        description: 'A test federation',
        governance: customGovernance,
      });

      expect(result.governance.votingSystem).toBe('unanimous');
      expect(result.governance.councilSize).toBe(3);
      // Defaults still applied for unset fields
      expect(result.governance.requiredApprovalThreshold).toBe(51);
    });

    it('should set isPublic and tags when provided', async () => {
      const savedFederation = {
        ...baseFederationEntity,
        status: 'forming',
        isPublic: true,
        tags: ['mining', 'trade'],
      };
      mockFederationRepo.create.mockReturnValue(savedFederation);
      mockFederationRepo.save.mockResolvedValue(savedFederation);
      mockMemberRepo.create.mockReturnValue(founderMemberEntity);
      mockMemberRepo.save.mockResolvedValue(founderMemberEntity);
      mockFederationRepo.findOne.mockResolvedValue({
        ...savedFederation,
        members: [founderMemberEntity],
      });
      // Duplicate name check returns no match
      mockFederationRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

      const result = await service.createFederation('user-founder', 'org-founder', 'Founder Org', {
        name: 'Test Federation',
        description: 'Test',
        isPublic: true,
        tags: ['mining', 'trade'],
      });

      expect(result.isPublic).toBe(true);
      expect(result.tags).toEqual(['mining', 'trade']);
    });

    it('should look up org name from DB when founderOrgName is undefined', async () => {
      const savedFederation = { ...baseFederationEntity, status: 'forming' };
      mockFederationRepo.create.mockReturnValue(savedFederation);
      mockFederationRepo.save.mockResolvedValue(savedFederation);
      mockMemberRepo.create.mockReturnValue(founderMemberEntity);
      mockMemberRepo.save.mockResolvedValue(founderMemberEntity);
      mockFederationRepo.findOne.mockResolvedValue({
        ...savedFederation,
        members: [founderMemberEntity],
      });
      mockOrgRepo.findOne.mockResolvedValue({ name: 'Resolved Org Name' });
      // Duplicate name check returns no match
      mockFederationRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

      const result = await service.createFederation('user-founder', 'org-founder', undefined, {
        name: 'Test Federation',
        description: 'A test federation',
      });

      expect(result).toBeDefined();
      expect(mockOrgRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'org-founder' },
        select: ['name'],
      });
      expect(mockMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationName: 'Resolved Org Name' })
      );
    });

    it('should reject duplicate federation names', async () => {
      // Duplicate name check returns an existing federation
      mockFederationRepo.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock([{ id: 'fed-existing', name: 'Duplicate Name' }])
      );

      await expect(
        service.createFederation('user-founder', 'org-founder', 'Founder Org', {
          name: 'Duplicate Name',
          description: 'A test federation',
        })
      ).rejects.toThrow('already exists');
    });

    it('should rollback transaction when member creation fails', async () => {
      const savedFederation = { ...baseFederationEntity, status: 'forming' };
      mockFederationRepo.create.mockReturnValue(savedFederation);
      mockFederationRepo.save.mockResolvedValue(savedFederation);
      mockMemberRepo.create.mockReturnValue(founderMemberEntity);
      mockMemberRepo.save.mockRejectedValue(new Error('DB constraint violation'));
      // Duplicate name check returns no match
      mockFederationRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

      await expect(
        service.createFederation('user-founder', 'org-founder', 'Founder Org', {
          name: 'Test Federation',
          description: 'A test federation',
        })
      ).rejects.toThrow('DB constraint violation');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ── getFederation ──────────────────────────────────────────────────────────

  describe('getFederation', () => {
    it('should return federation config when found', async () => {
      mockFederationRepo.findOne.mockResolvedValue(baseFederationEntity);

      const result = await service.getFederation('fed-001');

      expect(result).toBeDefined();
      expect(result.id).toBe('fed-001');
      expect(result.name).toBe('Test Federation');
      expect(result.members.length).toBe(2);
    });

    it('should return null when federation not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue(null);

      const result = await service.getFederation('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ── getOrganizationFederations ─────────────────────────────────────────────

  describe('getOrganizationFederations', () => {
    it('should return federations where org is a member', async () => {
      mockMemberRepo.find.mockResolvedValue([{ federationId: 'fed-001' }]);
      const qb = createQueryBuilderMock([baseFederationEntity]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getOrganizationFederations('org-founder');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('fed-001');
    });

    it('should return empty array when org has no memberships', async () => {
      mockMemberRepo.find.mockResolvedValue([]);

      const result = await service.getOrganizationFederations('org-loner');

      expect(result).toEqual([]);
    });
  });

  // ── searchFederations ──────────────────────────────────────────────────────

  describe('searchFederations', () => {
    it('should return public non-dissolved federations', async () => {
      const qb = createQueryBuilderMock([baseFederationEntity]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchFederations();

      expect(result.length).toBe(1);
      expect(qb.where).toHaveBeenCalledWith('federation.isPublic = :isPublic', { isPublic: true });
    });

    it('should filter by name', async () => {
      const qb = createQueryBuilderMock([baseFederationEntity]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchFederations({ name: 'Test' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(federation.name)'),
        expect.objectContaining({ search: '%test%' })
      );
    });

    it('should filter by tags', async () => {
      const qb = createQueryBuilderMock([baseFederationEntity]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchFederations({ tags: ['combat'] });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('?|'),
        expect.objectContaining({ tags: ['combat'] })
      );
    });

    it('should filter by minMembers in-memory', async () => {
      const fedWith1Member = {
        ...baseFederationEntity,
        members: [founderMemberEntity as FederationMember],
      };
      const qb = createQueryBuilderMock([fedWith1Member]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchFederations({ minMembers: 2 });

      expect(result.length).toBe(0);
    });
  });

  // ── updateFederation ───────────────────────────────────────────────────────

  describe('updateFederation', () => {
    it('should update federation name when actor has permission', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));
      // Duplicate name check returns no match
      mockFederationRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

      const result = await service.updateFederation('fed-001', 'org-founder', {
        name: 'Updated Name',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Name');
      expect(mockFederationRepo.save).toHaveBeenCalled();
    });

    it('should throw when actor lacks permission', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      await expect(
        service.updateFederation('fed-001', 'org-nobody', { name: 'Nope' })
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should return null when federation not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue(null);

      const result = await service.updateFederation('nonexistent', 'org-founder', {
        name: 'X',
      });

      expect(result).toBeNull();
    });

    it('should reject renaming to a duplicate name', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      // Duplicate name check returns an existing federation with different id
      mockFederationRepo.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock([{ id: 'fed-other', name: 'Taken Name' }])
      );

      await expect(
        service.updateFederation('fed-001', 'org-founder', { name: 'Taken Name' })
      ).rejects.toThrow('already exists');
    });

    it('should reject direct governance update when multiple active members exist', async () => {
      // baseFederationEntity has 2 active members (founder + member)
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      await expect(
        service.updateFederation('fed-001', 'org-founder', {
          governance: { ...defaultGovernance, votingSystem: 'unanimous' },
        })
      ).rejects.toThrow('Governance changes require a proposal');
    });

    it('should allow direct governance update when only one active member exists', async () => {
      const singleMemberFed = {
        ...baseFederationEntity,
        members: [founderMemberEntity as FederationMember],
      };
      mockFederationRepo.findOne.mockResolvedValue(singleMemberFed);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const newGovernance = { ...defaultGovernance, votingSystem: 'unanimous' as const };
      const result = await service.updateFederation('fed-001', 'org-founder', {
        governance: newGovernance,
      });

      expect(result).toBeDefined();
      expect(mockFederationRepo.save).toHaveBeenCalled();
    });

    it('should allow direct governance update when second member is pending (not active)', async () => {
      const fedWithPending = {
        ...baseFederationEntity,
        members: [founderMemberEntity as FederationMember, pendingMemberEntity as FederationMember],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithPending);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const newGovernance = { ...defaultGovernance, councilSize: 7 };
      const result = await service.updateFederation('fed-001', 'org-founder', {
        governance: newGovernance,
      });

      expect(result).toBeDefined();
      expect(mockFederationRepo.save).toHaveBeenCalled();
    });
  });

  // ── activateFederation ─────────────────────────────────────────────────────

  describe('activateFederation', () => {
    it('should activate a forming federation with >= 2 active members', async () => {
      const formingFed = { ...baseFederationEntity, status: 'forming' };
      mockFederationRepo.findOne.mockResolvedValue(formingFed);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.activateFederation('fed-001', 'org-founder');

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
    });

    it('should throw when non-founder tries to activate', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity, status: 'forming' });

      await expect(service.activateFederation('fed-001', 'org-member')).rejects.toThrow(
        'Only founder can activate'
      );
    });

    it('should throw when fewer than 2 active members', async () => {
      const fedWith1 = {
        ...baseFederationEntity,
        status: 'forming',
        members: [founderMemberEntity as FederationMember],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWith1);

      await expect(service.activateFederation('fed-001', 'org-founder')).rejects.toThrow(
        'at least 2 active members'
      );
    });
  });

  // ── inviteMember ───────────────────────────────────────────────────────────

  describe('inviteMember', () => {
    it('should invite a new member with pending status', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      const newMember = { ...pendingMemberEntity };
      mockMemberRepo.create.mockReturnValue(newMember);
      mockMemberRepo.save.mockResolvedValue(newMember);

      const result = await service.inviteMember(
        'fed-001',
        'org-founder',
        'org-pending',
        'Pending Org'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.organizationId).toBe('org-pending');
    });

    it('should throw when federation not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.inviteMember('nonexistent', 'org-founder', 'org-new', 'New Org')
      ).rejects.toThrow('Federation not found');
    });

    it('should throw when inviter lacks permission', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      await expect(
        service.inviteMember('fed-001', 'org-nobody', 'org-new', 'New Org')
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should throw when target is already a member', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      await expect(
        service.inviteMember('fed-001', 'org-founder', 'org-member', 'Member Org')
      ).rejects.toThrow('already a member');
    });

    it('should downgrade founder role to member on invite', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      const newMember = { ...pendingMemberEntity, role: 'member' };
      mockMemberRepo.create.mockReturnValue(newMember);
      mockMemberRepo.save.mockResolvedValue(newMember);

      await service.inviteMember('fed-001', 'org-founder', 'org-new', 'New Org', 'founder');

      expect(mockMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member' })
      );
    });
  });

  // ── acceptInvitation ───────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should accept a pending invitation', async () => {
      const fedWithPending = {
        ...baseFederationEntity,
        members: [founderMemberEntity as FederationMember, pendingMemberEntity as FederationMember],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithPending);
      const pendingEntity = { ...pendingMemberEntity };
      mockMemberRepo.findOne.mockResolvedValue(pendingEntity);
      mockMemberRepo.save.mockImplementation(entity => Promise.resolve(entity));
      // createMemberRelationships: no existing relationships
      mockRelationshipRepo.findOne.mockResolvedValue(null);
      mockRelationshipRepo.create.mockImplementation(data => data);
      mockRelationshipRepo.save.mockResolvedValue({});

      const result = await service.acceptInvitation('fed-001', 'org-pending');

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
    });

    it('should throw when no pending invitation found', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(service.acceptInvitation('fed-001', 'org-unknown')).rejects.toThrow(
        'Pending invitation not found'
      );
    });

    it('should throw when invitation already processed', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockMemberRepo.findOne.mockResolvedValue({ ...secondMemberEntity, status: 'active' });

      await expect(service.acceptInvitation('fed-001', 'org-member')).rejects.toThrow(
        'already been processed'
      );
    });
  });

  // ── removeMember ───────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('should remove a member when actor is founder', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockMemberRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removeMember('fed-001', 'org-founder', 'org-member');

      expect(mockMemberRepo.delete).toHaveBeenCalledWith({
        federationId: 'fed-001',
        organizationId: 'org-member',
      });
    });

    it('should allow self-removal for non-founders', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockMemberRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removeMember('fed-001', 'org-member', 'org-member');

      expect(mockMemberRepo.delete).toHaveBeenCalled();
    });

    it('should throw when trying to remove founder', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      await expect(service.removeMember('fed-001', 'org-founder', 'org-founder')).rejects.toThrow(
        'Cannot remove the federation founder'
      );
    });

    it('should throw when actor lacks permission', async () => {
      const thirdMember = {
        ...pendingMemberEntity,
        status: 'active',
        organizationId: 'org-third',
      } as FederationMember;
      const fedWith3Members = {
        ...baseFederationEntity,
        members: [
          founderMemberEntity as FederationMember,
          secondMemberEntity as FederationMember,
          thirdMember,
        ],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWith3Members);
      // Mock findMember: actor (org-member) is a member but not leader/founder
      mockMemberRepo.findOne.mockImplementation(
        async (opts: { where: { organizationId?: string } }) => {
          const orgId = opts?.where?.organizationId;
          return (
            [founderMemberEntity, secondMemberEntity, thirdMember].find(
              m => m.organizationId === orgId
            ) ?? null
          );
        }
      );

      await expect(service.removeMember('fed-001', 'org-member', 'org-third')).rejects.toThrow(
        'Insufficient permissions'
      );
    });
  });

  // ── updateMemberRole ───────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('should update member role when actor has permission', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      const targetEntity = { ...secondMemberEntity };
      // First call: findMember for actor (founder), second call: findOne for target
      mockMemberRepo.findOne
        .mockResolvedValueOnce(founderMemberEntity) // actor check
        .mockResolvedValueOnce(targetEntity); // target lookup
      mockMemberRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.updateMemberRole(
        'fed-001',
        'org-founder',
        'org-member',
        'council'
      );

      expect(result).toBeDefined();
      expect(result.role).toBe('council');
    });

    it('should throw when trying to change founder role', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockMemberRepo.findOne
        .mockResolvedValueOnce(founderMemberEntity) // actor check
        .mockResolvedValueOnce(founderMemberEntity); // target lookup

      await expect(
        service.updateMemberRole('fed-001', 'org-founder', 'org-founder', 'leader')
      ).rejects.toThrow('Cannot modify founder role');
    });

    it('should set votingPower to 0 for observer role', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      const targetEntity = { ...secondMemberEntity };
      mockMemberRepo.findOne
        .mockResolvedValueOnce(founderMemberEntity) // actor check
        .mockResolvedValueOnce(targetEntity); // target lookup
      mockMemberRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.updateMemberRole(
        'fed-001',
        'org-founder',
        'org-member',
        'observer'
      );

      expect(result.votingPower).toBe(0);
    });
  });

  // ── createProposal ─────────────────────────────────────────────────────────

  describe('createProposal', () => {
    it('should create a proposal when proposer is active member', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      const proposalEntity = {
        id: 'prop-001',
        federationId: 'fed-001',
        type: 'custom',
        title: 'Test Proposal',
        description: 'A test proposal',
        proposedBy: 'Founder',
        proposedByOrg: 'org-founder',
        createdAt: new Date(),
        votingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        votes: [],
        status: 'open',
        requiredApproval: 51,
        metadata: null,
      };
      mockProposalRepo.create.mockReturnValue(proposalEntity);
      mockProposalRepo.save.mockResolvedValue(proposalEntity);

      const result = await service.createProposal('fed-001', 'org-founder', 'Founder', {
        type: 'custom',
        title: 'Test Proposal',
        description: 'A test proposal',
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Proposal');
      expect(result.status).toBe('open');
    });

    it('should use amendment threshold for governance proposals', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      const proposalEntity = {
        id: 'prop-002',
        federationId: 'fed-001',
        type: 'amend_governance',
        title: 'Governance Change',
        description: 'Amend governance',
        proposedBy: 'Founder',
        proposedByOrg: 'org-founder',
        createdAt: new Date(),
        votingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        votes: [],
        status: 'open',
        requiredApproval: 67,
        metadata: null,
      };
      mockProposalRepo.create.mockReturnValue(proposalEntity);
      mockProposalRepo.save.mockResolvedValue(proposalEntity);

      await service.createProposal('fed-001', 'org-founder', 'Founder', {
        type: 'amend_governance',
        title: 'Governance Change',
        description: 'Amend governance',
      });

      expect(mockProposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ requiredApproval: 67 })
      );
    });

    it('should throw when observer tries to create proposal', async () => {
      const observerMember = {
        ...secondMemberEntity,
        role: 'observer',
        organizationId: 'org-observer',
        status: 'active',
      } as FederationMember;

      const fedWithObserver = {
        ...baseFederationEntity,
        members: [founderMemberEntity as FederationMember, observerMember],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithObserver);
      mockMemberRepo.findOne.mockResolvedValue(observerMember);

      await expect(
        service.createProposal('fed-001', 'org-observer', 'Observer', {
          type: 'custom',
          title: 'Nope',
          description: 'Should fail',
        })
      ).rejects.toThrow('Observers cannot create proposals');
    });
  });

  // ── castVote ────────────────────────────────────────────────────────────────

  describe('castVote', () => {
    const baseProposal: Partial<FederationProposal> = {
      id: 'prop-001',
      federationId: 'fed-001',
      type: 'custom',
      title: 'Test Proposal',
      description: 'A test',
      proposedBy: 'Founder',
      proposedByOrg: 'org-founder',
      createdAt: new Date(),
      votingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      votes: [],
      status: 'open',
      requiredApproval: 51,
      metadata: null,
    };

    it('should cast a vote on an open proposal', async () => {
      const proposalCopy = { ...baseProposal, votes: [] };
      mockProposalRepo.findOne.mockResolvedValue(proposalCopy);
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockProposalRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.castVote(
        'prop-001',
        'org-founder',
        'Founder Org',
        'voter-001',
        'approve'
      );

      expect(result).toBeDefined();
      expect(result.votes.length).toBe(1);
      expect(result.votes[0].vote).toBe('approve');
    });

    it('should throw when proposal not found', async () => {
      mockProposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.castVote('nonexistent', 'org-founder', 'Org', 'voter', 'approve')
      ).rejects.toThrow('Proposal not found');
    });

    it('should throw when voting is closed', async () => {
      mockProposalRepo.findOne.mockResolvedValue({
        ...baseProposal,
        status: 'passed',
      });

      await expect(
        service.castVote('prop-001', 'org-founder', 'Org', 'voter', 'approve')
      ).rejects.toThrow('Voting is closed');
    });

    it('should throw when organization has already voted', async () => {
      const withExistingVote = {
        ...baseProposal,
        votes: [
          {
            organizationId: 'org-founder',
            organizationName: 'Founder Org',
            vote: 'approve',
            votedBy: 'voter-001',
            votedAt: new Date(),
            weight: 1,
          },
        ],
      };
      mockProposalRepo.findOne.mockResolvedValue(withExistingVote);
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      await expect(
        service.castVote('prop-001', 'org-founder', 'Org', 'voter-001', 'reject')
      ).rejects.toThrow('already voted');
    });
  });

  // ── getProposal ────────────────────────────────────────────────────────────

  describe('getProposal', () => {
    it('should return proposal when found', async () => {
      const proposal = {
        id: 'prop-001',
        federationId: 'fed-001',
        type: 'custom',
        title: 'Test',
        description: 'Desc',
        proposedBy: 'User',
        proposedByOrg: 'org-founder',
        createdAt: new Date(),
        votingEndsAt: new Date(),
        votes: [],
        status: 'open',
        requiredApproval: 51,
        metadata: null,
      };
      mockProposalRepo.findOne.mockResolvedValue(proposal);

      const result = await service.getProposal('prop-001');

      expect(result).toBeDefined();
      expect(result.id).toBe('prop-001');
    });

    it('should return null when proposal not found', async () => {
      mockProposalRepo.findOne.mockResolvedValue(null);

      const result = await service.getProposal('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ── getFederationProposals ──────────────────────────────────────────────────

  describe('getFederationProposals', () => {
    it('should return all proposals for a federation', async () => {
      const proposals = [
        {
          id: 'prop-001',
          federationId: 'fed-001',
          type: 'custom',
          title: 'P1',
          description: 'D1',
          proposedBy: 'User',
          proposedByOrg: 'org-founder',
          createdAt: new Date(),
          votingEndsAt: new Date(),
          votes: [],
          status: 'open',
          requiredApproval: 51,
          metadata: null,
        },
      ];
      mockProposalRepo.find.mockResolvedValue(proposals);

      const result = await service.getFederationProposals('fed-001');

      expect(result.length).toBe(1);
    });

    it('should filter proposals by status', async () => {
      mockProposalRepo.find.mockResolvedValue([]);

      await service.getFederationProposals('fed-001', 'open');

      expect(mockProposalRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ federationId: 'fed-001', status: 'open' }),
      });
    });
  });

  // ── addSharedResource ──────────────────────────────────────────────────────

  describe('addSharedResource', () => {
    it('should add a shared resource and increment contributions', async () => {
      const fedCopy = { ...baseFederationEntity, sharedResources: [] };
      mockFederationRepo.findOne.mockResolvedValue(fedCopy);
      const memberEntity = { ...founderMemberEntity, contributions: 0 };
      mockMemberRepo.findOne.mockResolvedValue(memberEntity);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));
      mockMemberRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.addSharedResource('fed-001', 'org-founder', {
        type: 'ship',
        name: 'Carrier Alpha',
        description: 'Large carrier',
        providedBy: 'org-founder',
        quantity: 1,
        accessLevel: 'all_members',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Carrier Alpha');
      expect(memberEntity.contributions).toBe(1);
    });

    it('should throw when org is not active member', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addSharedResource('fed-001', 'org-nobody', {
          type: 'ship',
          name: 'Ship',
          description: 'Desc',
          providedBy: 'org-nobody',
          quantity: 1,
          accessLevel: 'all_members',
        })
      ).rejects.toThrow('not an active member');
    });
  });

  // ── removeSharedResource ───────────────────────────────────────────────────

  describe('removeSharedResource', () => {
    it('should remove resource when actor is provider', async () => {
      const resourceId = 'resource-001';
      const fedWithResource = {
        ...baseFederationEntity,
        sharedResources: [
          {
            id: resourceId,
            type: 'ship',
            name: 'Ship',
            description: 'Desc',
            providedBy: 'org-founder',
            quantity: 1,
            accessLevel: 'all_members',
          },
        ],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithResource);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      await service.removeSharedResource('fed-001', resourceId, 'org-founder');

      expect(mockFederationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sharedResources: [],
        })
      );
    });

    it('should throw when resource not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue({
        ...baseFederationEntity,
        sharedResources: [],
      });

      await expect(
        service.removeSharedResource('fed-001', 'nonexistent', 'org-founder')
      ).rejects.toThrow('Resource not found');
    });
  });

  // ── createTreaty ───────────────────────────────────────────────────────────

  describe('createTreaty', () => {
    it('should create a treaty proposal with creator auto-signed', async () => {
      const fedCopy = { ...baseFederationEntity, treaties: [] };
      mockFederationRepo.findOne.mockResolvedValue(fedCopy);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.createTreaty('fed-001', 'org-founder', {
        name: 'Defense Pact',
        type: 'mutual_defense',
        terms: ['Defend each other'],
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Defense Pact');
      expect(result.status).toBe('proposed');
      expect(result.proposedBy).toBe('org-founder');
      expect(result.signatories).toContain('org-founder');
      expect(result.signatures).toHaveLength(2);
      // Creator auto-signed
      const creatorSig = result.signatures?.find(s => s.organizationId === 'org-founder');
      expect(creatorSig?.status).toBe('signed');
      // Other member pending
      const memberSig = result.signatures?.find(s => s.organizationId === 'org-member');
      expect(memberSig?.status).toBe('pending');
    });

    it('should throw when actor lacks permission', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      await expect(
        service.createTreaty('fed-001', 'org-nobody', {
          name: 'Nope',
          type: 'trade',
          terms: [],
        })
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  // ── respondToTreaty ────────────────────────────────────────────────────────

  describe('respondToTreaty', () => {
    const proposedTreaty = {
      id: 'treaty-001',
      name: 'Defense Pact',
      type: 'mutual_defense',
      signatories: ['org-founder'],
      terms: ['Defend each other'],
      effectiveDate: new Date().toISOString(),
      status: 'proposed',
      proposedBy: 'org-founder',
      signatures: [
        {
          organizationId: 'org-founder',
          organizationName: 'Founder Org',
          status: 'signed',
          respondedAt: new Date().toISOString(),
        },
        { organizationId: 'org-member', organizationName: 'Member Org', status: 'pending' },
      ],
    };

    it('should allow an org to sign a proposed treaty', async () => {
      const fedWithTreaty = {
        ...baseFederationEntity,
        treaties: [
          { ...proposedTreaty, signatures: [...proposedTreaty.signatures.map(s => ({ ...s }))] },
        ],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithTreaty);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.respondToTreaty('fed-001', 'treaty-001', 'org-member', 'sign');

      expect(result.signatories).toContain('org-member');
      // All responded — should become active (2 signed)
      expect(result.status).toBe('active');
    });

    it('should allow an org to reject a proposed treaty', async () => {
      const fedWithTreaty = {
        ...baseFederationEntity,
        treaties: [
          { ...proposedTreaty, signatures: [...proposedTreaty.signatures.map(s => ({ ...s }))] },
        ],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithTreaty);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.respondToTreaty('fed-001', 'treaty-001', 'org-member', 'reject');

      expect(result.signatories).not.toContain('org-member');
      // Only 1 signed, so treaty is terminated
      expect(result.status).toBe('terminated');
    });

    it('should throw when treaty is not proposed', async () => {
      const activeTreaty = { ...proposedTreaty, status: 'active' };
      const fedWithTreaty = {
        ...baseFederationEntity,
        treaties: [activeTreaty],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithTreaty);

      await expect(
        service.respondToTreaty('fed-001', 'treaty-001', 'org-member', 'sign')
      ).rejects.toThrow('Only proposed treaties');
    });

    it('should throw when org already responded', async () => {
      const alreadySigned = {
        ...proposedTreaty,
        signatures: [
          {
            organizationId: 'org-founder',
            organizationName: 'Founder Org',
            status: 'signed',
            respondedAt: new Date().toISOString(),
          },
          {
            organizationId: 'org-member',
            organizationName: 'Member Org',
            status: 'signed',
            respondedAt: new Date().toISOString(),
          },
        ],
      };
      const fedWithTreaty = {
        ...baseFederationEntity,
        treaties: [alreadySigned],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithTreaty);

      await expect(
        service.respondToTreaty('fed-001', 'treaty-001', 'org-member', 'sign')
      ).rejects.toThrow('already signed');
    });
  });

  // ── terminateTreaty ────────────────────────────────────────────────────────

  describe('terminateTreaty', () => {
    it('should terminate an active treaty', async () => {
      const treatyId = 'treaty-001';
      const fedWithTreaty = {
        ...baseFederationEntity,
        treaties: [
          {
            id: treatyId,
            name: 'Defense Pact',
            type: 'defense',
            description: 'Mutual defense',
            signatories: ['org-founder', 'org-member'],
            terms: ['Defend'],
            effectiveDate: new Date(),
            status: 'active',
            proposedBy: 'org-founder',
          },
        ],
      };
      mockFederationRepo.findOne.mockResolvedValue(fedWithTreaty);
      mockFederationRepo.save.mockImplementation(entity => Promise.resolve(entity));

      await service.terminateTreaty('fed-001', treatyId, 'org-founder');

      expect(mockFederationRepo.save).toHaveBeenCalled();
      // The treaty status should have been mutated to 'terminated'
      expect((fedWithTreaty.treaties[0] as FederationTreaty).status).toBe('terminated');
    });

    it('should throw when treaty not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue({
        ...baseFederationEntity,
        treaties: [],
      });

      await expect(
        service.terminateTreaty('fed-001', 'nonexistent', 'org-founder')
      ).rejects.toThrow('Treaty not found');
    });
  });

  // ── getFederationStats ─────────────────────────────────────────────────────

  describe('getFederationStats', () => {
    it('should return computed statistics', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });
      mockProposalRepo.count.mockResolvedValue(2);
      mockRelationshipRepo.find.mockResolvedValue([]);
      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1', totalMembers: 10 });

      const result = await service.getFederationStats('fed-001');

      expect(result).toBeDefined();
      expect(result.totalMembers).toBe(2);
      expect(result.activeMembers).toBe(2);
      expect(result.openProposals).toBe(2);
    });

    it('should throw when federation not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue(null);

      await expect(service.getFederationStats('nonexistent')).rejects.toThrow(
        'Federation not found'
      );
    });
  });

  // ── seedDemoFederations ────────────────────────────────────────────────────

  describe('seedDemoFederations', () => {
    it('should skip when federations already exist', async () => {
      mockFederationRepo.count.mockResolvedValue(3);

      await service.seedDemoFederations();

      expect(mockFederationRepo.save).not.toHaveBeenCalled();
    });

    it('should seed when no federations exist', async () => {
      mockFederationRepo.count.mockResolvedValue(0);
      mockFederationRepo.create.mockImplementation(data => data);
      mockFederationRepo.save.mockResolvedValue({});
      mockMemberRepo.create.mockImplementation(data => data);
      mockMemberRepo.save.mockResolvedValue({});

      await service.seedDemoFederations();

      // Should have created at least 3 federations
      expect(mockFederationRepo.create).toHaveBeenCalled();
      expect(mockFederationRepo.save).toHaveBeenCalled();
      expect(mockMemberRepo.create).toHaveBeenCalled();
      expect(mockMemberRepo.save).toHaveBeenCalled();
    });
  });

  // ── getMemberContributions ─────────────────────────────────────────────────

  describe('getMemberContributions', () => {
    it('should return contributions for all active members', async () => {
      mockFederationRepo.findOne.mockResolvedValue({
        ...baseFederationEntity,
        sharedResources: [
          { id: 'r1', type: 'hangar', providedBy: 'org-founder', name: 'Main Hangar' },
        ],
      });
      // No closed proposals
      mockProposalRepo.find.mockResolvedValue([]);

      const result = await service.getMemberContributions('fed-001');

      expect(result).toHaveLength(2);
      expect(result[0].organizationId).toBeDefined();
      expect(result[0].organizationName).toBeDefined();
      expect(result[0]).toHaveProperty('contributions');
      expect(result[0]).toHaveProperty('sharedResources');
      expect(result[0]).toHaveProperty('votingParticipation');
    });

    it('should throw when federation not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue(null);

      await expect(service.getMemberContributions('nonexistent')).rejects.toThrow(
        'Federation not found'
      );
    });

    it('should calculate voting participation percentage', async () => {
      const federationWithResources = {
        ...baseFederationEntity,
        sharedResources: [
          { id: 'r1', type: 'hangar', providedBy: 'org-founder', name: 'Main Hangar' },
        ],
      };
      mockFederationRepo.findOne.mockResolvedValue(federationWithResources);
      // Return a closed proposal where founder voted but member didn't
      mockProposalRepo.find.mockResolvedValue([
        {
          id: 'p1',
          federationId: 'fed-001',
          status: 'passed',
          votes: [
            {
              organizationId: 'org-founder',
              vote: 'approve',
              votedAt: new Date().toISOString(),
            },
          ],
          type: 'custom',
          title: 'Test',
          description: 'Test',
          proposedBy: 'user-1',
          proposedByOrg: 'org-founder',
          createdAt: new Date(),
          votingEndsAt: new Date(),
          requiredApproval: 51,
        },
      ]);

      const result = await service.getMemberContributions('fed-001');

      // Founder voted on the proposal (100%), member didn't (0%)
      const founderContrib = result.find(r => r.organizationId === 'org-founder');
      const memberContrib = result.find(r => r.organizationId === 'org-member');

      expect(founderContrib?.votingParticipation).toBe(100);
      expect(memberContrib?.votingParticipation).toBe(0);
      expect(founderContrib?.sharedResources).toBe(1);
    });
  });

  // ── getPublicFederations ───────────────────────────────────────────────────

  describe('getPublicFederations', () => {
    it('should return paginated public federations', async () => {
      const publicFed = {
        ...baseFederationEntity,
        isPublic: true,
        status: 'active',
        sharedResources: [],
        treaties: [],
      };

      const qb = createQueryBuilderMock([publicFed]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);
      mockProfileRepo.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock([
          { organizationId: 'org-founder' },
          { organizationId: 'org-member' },
        ])
      );

      const result = await service.getPublicFederations();

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.data[0].name).toBe('Test Federation');
      expect(result.data[0].slug).toBe('test-federation');
    });

    it('should return empty results when no public federations', async () => {
      const qb = createQueryBuilderMock([]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPublicFederations();

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should filter by minimum member count', async () => {
      const fedWithOneActiveMember = {
        ...baseFederationEntity,
        members: [founderMemberEntity as FederationMember],
        isPublic: true,
        status: 'active',
        sharedResources: [],
        treaties: [],
      };

      const qb = createQueryBuilderMock([fedWithOneActiveMember]);
      mockFederationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPublicFederations({ minMembers: 3 });

      expect(result.data).toHaveLength(0);
    });
  });

  // ── getPublicFederation ────────────────────────────────────────────────────

  describe('getPublicFederation', () => {
    it('should return a public federation by ID', async () => {
      const publicFed = {
        ...baseFederationEntity,
        isPublic: true,
        status: 'active',
        sharedResources: [],
        treaties: [],
      };
      mockFederationRepo.findOne.mockResolvedValue(publicFed);
      mockProfileRepo.createQueryBuilder.mockReturnValue(
        createQueryBuilderMock([{ organizationId: 'org-founder' }])
      );

      const result = await service.getPublicFederation('00000000-0000-4000-a000-000000000001');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Federation');
      expect(result?.memberCount).toBe(2);
      expect(result?.slug).toBe('test-federation');
    });

    it('should return null when federation not found or not public', async () => {
      mockFederationRepo.findOne.mockResolvedValue(null);

      const result = await service.getPublicFederation('00000000-0000-4000-a000-999999999999');

      expect(result).toBeNull();
    });
  });

  // ── getPublicFederationStats ───────────────────────────────────────────────

  describe('getPublicFederationStats', () => {
    it('should return aggregate stats for public federations', async () => {
      const publicFed = {
        ...baseFederationEntity,
        isPublic: true,
        status: 'active',
      };
      mockFederationRepo.find.mockResolvedValue([publicFed]);

      // Mock the memberRepository.createQueryBuilder chain used for SQL aggregation
      const memberQb: Record<string, jest.Mock> = {};
      memberQb.select = jest.fn().mockReturnValue(memberQb);
      memberQb.addSelect = jest.fn().mockReturnValue(memberQb);
      memberQb.where = jest.fn().mockReturnValue(memberQb);
      memberQb.andWhere = jest.fn().mockReturnValue(memberQb);
      memberQb.getRawOne = jest.fn().mockResolvedValue({ uniqueOrgs: 2, totalMembers: 2 });
      mockMemberRepo.createQueryBuilder.mockReturnValue(memberQb);

      const result = await service.getPublicFederationStats();

      expect(result).toBeDefined();
      expect(result.totalFederations).toBe(1);
      expect(result.totalMemberOrganizations).toBe(2); // 2 unique orgs
      expect(result.averageMembersPerFederation).toBe(2);
      expect(result.byTag).toEqual({ combat: 1, defense: 1 });
    });

    it('should return zeros when no public federations exist', async () => {
      mockFederationRepo.find.mockResolvedValue([]);

      const result = await service.getPublicFederationStats();

      expect(result.totalFederations).toBe(0);
      expect(result.totalMemberOrganizations).toBe(0);
      expect(result.averageMembersPerFederation).toBe(0);
      expect(result.byTag).toEqual({});
    });
  });

  // ── hasAllianceManageAccess ────────────────────────────────────────────────

  describe('hasAllianceManageAccess', () => {
    it('should return true for a user who is a founder/leader via their org', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      // Mock OrganizationMembership repository — getRepository will be called with
      // OrganizationMembership entity, returning user's org memberships
      const mockMembershipRepo = createMockRepository();
      mockMembershipRepo.find.mockResolvedValue([
        { organizationId: 'org-founder', userId: 'user-founder', isActive: true },
      ]);
      (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
        if (entity === Federation) return mockFederationRepo;
        if (entity === FederationMember) return mockMemberRepo;
        if (entity === FederationProposal) return mockProposalRepo;
        // OrganizationMembership check
        return mockMembershipRepo;
      });

      const result = await service.hasAllianceManageAccess('fed-001', 'user-founder');

      expect(result).toBe(true);
    });

    it('should return false when federation not found', async () => {
      mockFederationRepo.findOne.mockResolvedValue(null);

      const result = await service.hasAllianceManageAccess('nonexistent', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false for a regular member without leader/founder role', async () => {
      mockFederationRepo.findOne.mockResolvedValue({ ...baseFederationEntity });

      const mockMembershipRepo = createMockRepository();
      mockMembershipRepo.find.mockResolvedValue([
        { organizationId: 'org-member', userId: 'user-member', isActive: true },
      ]);
      (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
        if (entity === Federation) return mockFederationRepo;
        if (entity === FederationMember) return mockMemberRepo;
        if (entity === FederationProposal) return mockProposalRepo;
        return mockMembershipRepo;
      });

      const result = await service.hasAllianceManageAccess('fed-001', 'user-member');

      expect(result).toBe(false);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
