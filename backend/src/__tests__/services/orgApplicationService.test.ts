import { createMockDataSource, createMockRepository } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../services/organization/OrganizationMemberService');

import {
  ApplicantType,
  ApplicationTargetType,
  OrgApplicationStatus,
} from '../../models/OrgApplication';
import {
  OrgApplicationService,
  TERMINAL_STATUSES,
} from '../../services/organization/OrgApplicationService';
import { OrganizationMemberService } from '../../services/organization/OrganizationMemberService';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';

// ── helpers ─────────────────────────────────────────────────────────

function makeOrg(overrides: Record<string, unknown> = {}) {
  return { id: 'org-1', settings: { requireApproval: true }, ...overrides };
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return { organizationId: 'org-1', isRecruiting: true, ...overrides };
}

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    organizationId: 'org-1',
    applicantUserId: 'user-1',
    targetType: ApplicationTargetType.ORGANIZATION,
    applicantType: ApplicantType.USER,
    status: OrgApplicationStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── mocks ───────────────────────────────────────────────────────────

let mockApplicationRepo: ReturnType<typeof createMockRepository>;
let mockOrganizationRepo: ReturnType<typeof createMockRepository>;
let mockProfileRepo: ReturnType<typeof createMockRepository>;
let mockMembershipRepo: ReturnType<typeof createMockRepository>;
let mockWatchlistRepo: ReturnType<typeof createMockRepository>;
let mockUserRepo: ReturnType<typeof createMockRepository>;
let mockMemberService: jest.Mocked<OrganizationMemberService>;
let mockQueryRunner: ReturnType<typeof mockDataSource.createQueryRunner>;

let service: OrgApplicationService;

beforeEach(() => {
  jest.clearAllMocks();

  mockApplicationRepo = createMockRepository();
  mockOrganizationRepo = createMockRepository();
  mockProfileRepo = createMockRepository();
  mockMembershipRepo = createMockRepository();
  mockWatchlistRepo = createMockRepository();
  mockUserRepo = createMockRepository();

  // Map entity name → mock repository
  mockDataSource.getRepository.mockImplementation((entity: any) => {
    const name = typeof entity === 'function' ? entity.name : String(entity);
    switch (name) {
      case 'OrgApplication':
        return mockApplicationRepo;
      case 'Organization':
        return mockOrganizationRepo;
      case 'PublicOrgProfile':
        return mockProfileRepo;
      case 'OrganizationMembership':
        return mockMembershipRepo;
      case 'OrgWatchlistEntry':
        return mockWatchlistRepo;
      case 'User':
        return mockUserRepo;
        return mockMembershipRepo;
      default:
        return createMockRepository();
    }
  });

  // Configure QueryRunner mock to return saved entities properly
  mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      save: jest
        .fn()
        .mockImplementation((entity: any) =>
          Promise.resolve({ id: entity.id || 'new-app', ...entity })
        ),
      find: jest.fn(),
      findOne: jest.fn(),
    },
  };
  mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner as any);

  // Mock OrganizationMemberService
  mockMemberService = {
    addMember: jest.fn().mockResolvedValue({}),
  } as any;
  (OrganizationMemberService as jest.Mock).mockImplementation(() => mockMemberService);

  service = new OrgApplicationService();
});

// ── TERMINAL_STATUSES constant ──────────────────────────────────────

describe('TERMINAL_STATUSES', () => {
  it('includes APPROVED, REJECTED, and WITHDRAWN', () => {
    expect(TERMINAL_STATUSES).toContain(OrgApplicationStatus.APPROVED);
    expect(TERMINAL_STATUSES).toContain(OrgApplicationStatus.REJECTED);
    expect(TERMINAL_STATUSES).toContain(OrgApplicationStatus.WITHDRAWN);
  });

  it('does NOT include PENDING', () => {
    expect(TERMINAL_STATUSES).not.toContain(OrgApplicationStatus.PENDING);
  });
});

// ── apply() ─────────────────────────────────────────────────────────

describe('OrgApplicationService.apply()', () => {
  // Default: user has no RSI handle, not on watchlist
  beforeEach(() => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: null });
    mockWatchlistRepo.findOne.mockResolvedValue(null);
  });

  it('creates a PENDING application when org requires approval', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null); // not a member
    mockApplicationRepo.findOne.mockResolvedValue(null); // no existing app
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1', 'Hello!');

    expect(result.status).toBe(OrgApplicationStatus.PENDING);
    expect(result.message).toBe('Hello!');
    expect(result.targetType).toBe(ApplicationTargetType.ORGANIZATION);
    expect(result.applicantType).toBe(ApplicantType.USER);
    expect(mockMemberService.addMember).not.toHaveBeenCalled();
  });

  it('auto-approves and adds member when requireApproval is false', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(
      makeOrg({ settings: { requireApproval: false } })
    );
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1');

    expect(result.status).toBe(OrgApplicationStatus.APPROVED);
    expect(result.reviewedAt).toBeDefined();
    expect(result.targetType).toBe(ApplicationTargetType.ORGANIZATION);
    expect(result.applicantType).toBe(ApplicantType.USER);
    expect(mockMemberService.addMember).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'member',
      undefined,
      undefined,
      mockQueryRunner.manager,
      { acquisitionSource: 'application' }
    );
  });

  it('throws NotFoundError when org does not exist', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(null);

    await expect(service.apply('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when org is not recruiting', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile({ isRecruiting: false }));

    await expect(service.apply('org-1', 'user-1')).rejects.toThrow(ValidationError);
  });

  it('throws ConflictError when user is already a member', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue({ userId: 'user-1', isActive: true });

    await expect(service.apply('org-1', 'user-1')).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when user has a non-terminal application', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(makeApp()); // existing pending app

    await expect(service.apply('org-1', 'user-1')).rejects.toThrow(ConflictError);
  });

  it('propagates addMember error during auto-approval (member added before app saved)', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(
      makeOrg({ settings: { requireApproval: false } })
    );
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockMemberService.addMember.mockRejectedValue(new Error('DB constraint'));

    await expect(service.apply('org-1', 'user-1')).rejects.toThrow('DB constraint');
    // Application should not be saved since member addition failed first
    expect(mockApplicationRepo.save).not.toHaveBeenCalled();
  });
});

// ── reviewApplication() ─────────────────────────────────────────────

describe('OrgApplicationService.reviewApplication()', () => {
  it('approves a pending application and adds member', async () => {
    const app = makeApp();
    mockApplicationRepo.findOne.mockResolvedValue(app);
    mockApplicationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.reviewApplication('app-1', 'org-1', 'admin-1', 'approved');

    expect(result.status).toBe(OrgApplicationStatus.APPROVED);
    expect(result.reviewedBy).toBe('admin-1');
    expect(result.reviewedAt).toBeDefined();
    expect(mockMemberService.addMember).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'member',
      undefined,
      undefined,
      mockQueryRunner.manager,
      { acquisitionSource: 'application', acquisitionRefId: 'app-1' }
    );
  });

  it('rejects a pending application without adding member', async () => {
    const app = makeApp();
    mockApplicationRepo.findOne.mockResolvedValue(app);
    mockApplicationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.reviewApplication(
      'app-1',
      'org-1',
      'admin-1',
      'rejected',
      'Not a fit'
    );

    expect(result.status).toBe(OrgApplicationStatus.REJECTED);
    expect(result.reviewNote).toBe('Not a fit');
    expect(mockMemberService.addMember).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when application does not exist', async () => {
    mockApplicationRepo.findOne.mockResolvedValue(null);

    await expect(
      service.reviewApplication('nonexistent', 'org-1', 'admin-1', 'approved')
    ).rejects.toThrow(NotFoundError);
  });

  it('rolls back transaction when addMember fails during approval', async () => {
    const app = makeApp();
    mockApplicationRepo.findOne.mockResolvedValue(app);
    mockMemberService.addMember.mockRejectedValue(new Error('Already a member'));

    await expect(
      service.reviewApplication('app-1', 'org-1', 'admin-1', 'approved')
    ).rejects.toThrow('Already a member');

    // Member addition should have been attempted and then failed
    expect(mockMemberService.addMember).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'member',
      undefined,
      undefined,
      mockQueryRunner.manager,
      { acquisitionSource: 'application', acquisitionRefId: 'app-1' }
    );

    // Transaction should be rolled back and not committed, and no changes persisted
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });
});

// ── withdrawApplication() ───────────────────────────────────────────

describe('OrgApplicationService.withdrawApplication()', () => {
  it('withdraws own pending application', async () => {
    const app = makeApp();
    mockApplicationRepo.findOne.mockResolvedValue(app);
    mockApplicationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.withdrawApplication('app-1', 'user-1');

    expect(result.status).toBe(OrgApplicationStatus.WITHDRAWN);
  });

  it('throws NotFoundError when application does not exist', async () => {
    mockApplicationRepo.findOne.mockResolvedValue(null);

    await expect(service.withdrawApplication('nonexistent', 'user-1')).rejects.toThrow(
      NotFoundError
    );
  });

  it('throws ForbiddenError when user is not the applicant', async () => {
    const app = makeApp({ applicantUserId: 'other-user' });
    mockApplicationRepo.findOne.mockResolvedValue(app);

    await expect(service.withdrawApplication('app-1', 'user-1')).rejects.toThrow(ForbiddenError);
  });
});

// ── hasActiveApplication() ──────────────────────────────────────────

describe('OrgApplicationService.hasActiveApplication()', () => {
  it('returns true when a pending application exists', async () => {
    mockApplicationRepo.count.mockResolvedValue(1);

    const result = await service.hasActiveApplication('org-1', 'user-1');

    expect(result).toBe(true);
  });

  it('returns false when no non-terminal applications exist', async () => {
    mockApplicationRepo.count.mockResolvedValue(0);

    const result = await service.hasActiveApplication('org-1', 'user-1');

    expect(result).toBe(false);
  });
});

// ── apply() with formResponses and source ────────────────────────────

describe('OrgApplicationService.apply() — formResponses & source', () => {
  // Default: user has no RSI handle, not on watchlist
  beforeEach(() => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: null });
    mockWatchlistRepo.findOne.mockResolvedValue(null);
  });

  it('stores formResponses and source on the application', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const formResponses = { 'q-1': 'Answer 1', 'q-2': 'Answer 2' };
    const result = await service.apply('org-1', 'user-1', 'Hello', formResponses, 'web');

    expect(result.formResponses).toEqual(formResponses);
    expect(result.source).toBe('web');
  });

  it('defaults source to web when not specified', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1', 'Hello');

    expect(result.source).toBe('web');
  });

  it('validates required form questions are answered', async () => {
    const orgWithQuestions = makeOrg({
      settings: {
        requireApproval: true,
        applicationQuestions: [
          { id: 'q-1', label: 'RSI Handle', type: 'short', required: true, order: 0 },
          { id: 'q-2', label: 'Why join?', type: 'paragraph', required: false, order: 1 },
        ],
      },
    });
    mockOrganizationRepo.findOne.mockResolvedValue(orgWithQuestions);
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);

    // Missing required question q-1
    await expect(
      service.apply('org-1', 'user-1', 'Hi', { 'q-2': 'Optional answer' })
    ).rejects.toThrow(ValidationError);
  });

  it('accepts application when all required questions are answered', async () => {
    const orgWithQuestions = makeOrg({
      settings: {
        requireApproval: true,
        applicationQuestions: [
          { id: 'q-1', label: 'RSI Handle', type: 'short', required: true, order: 0 },
          { id: 'q-2', label: 'Why join?', type: 'paragraph', required: false, order: 1 },
        ],
      },
    });
    mockOrganizationRepo.findOne.mockResolvedValue(orgWithQuestions);
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1', 'Hi', {
      'q-1': 'MyHandle',
      'q-2': 'Because reasons',
    });

    expect(result.status).toBe(OrgApplicationStatus.PENDING);
    expect(result.formResponses).toEqual({ 'q-1': 'MyHandle', 'q-2': 'Because reasons' });
  });

  it('allows empty formResponses when no questions are defined', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1', 'Hi', undefined, 'api');

    expect(result.status).toBe(OrgApplicationStatus.PENDING);
    expect(result.source).toBe('api');
  });
});

// ── getApplicationMode() ────────────────────────────────────────────

describe('OrgApplicationService.getApplicationMode()', () => {
  it('returns simple mode when no questions and no Discord', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());

    const result = await service.getApplicationMode('org-1');

    expect(result.mode).toBe('simple');
    expect(result.questions).toBeUndefined();
    expect(result.discordInviteUrl).toBeUndefined();
  });

  it('returns custom mode when applicationQuestions are defined', async () => {
    const questions = [{ id: 'q-1', label: 'RSI Handle', type: 'short', required: true, order: 0 }];
    mockOrganizationRepo.findOne.mockResolvedValue(
      makeOrg({ settings: { requireApproval: true, applicationQuestions: questions } })
    );

    const result = await service.getApplicationMode('org-1');

    expect(result.mode).toBe('custom');
    expect(result.questions).toEqual(questions);
  });

  it('returns discord mode when discordRecruitment is enabled and guild connected', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(
      makeOrg({
        settings: {
          requireApproval: true,
          customFields: { discordRecruitment: { enabled: true } },
        },
        metadata: { discordGuildId: 'guild-123' },
      })
    );
    mockProfileRepo.findOne.mockResolvedValue(
      makeProfile({ discordInvite: 'https://discord.gg/test' })
    );

    const result = await service.getApplicationMode('org-1');

    expect(result.mode).toBe('discord');
    expect(result.discordInviteUrl).toBe('https://discord.gg/test');
  });

  it('throws NotFoundError when org does not exist', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(null);

    await expect(service.getApplicationMode('nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('returns discord mode with questions when both questions AND discord are configured', async () => {
    const questions = [{ id: 'q-1', label: 'RSI Handle', type: 'short', required: true, order: 0 }];
    mockOrganizationRepo.findOne.mockResolvedValue(
      makeOrg({
        settings: {
          requireApproval: true,
          applicationQuestions: questions,
          customFields: { discordRecruitment: { enabled: true } },
        },
        metadata: { discordGuildId: 'guild-123' },
      })
    );
    mockProfileRepo.findOne.mockResolvedValue(
      makeProfile({ discordInvite: 'https://discord.gg/test' })
    );

    const result = await service.getApplicationMode('org-1');

    expect(result.mode).toBe('discord');
    expect(result.questions).toEqual(questions);
  });
});

// ── apply() with formResponses in auto-approve flow ─────────────────

describe('OrgApplicationService.apply() — formResponses with auto-approve', () => {
  // Default: user has no RSI handle, not on watchlist
  beforeEach(() => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: null });
    mockWatchlistRepo.findOne.mockResolvedValue(null);
  });

  it('stores formResponses and source when auto-approving', async () => {
    const orgWithQuestionsAutoApprove = makeOrg({
      settings: {
        requireApproval: false,
        applicationQuestions: [
          { id: 'q-1', label: 'RSI Handle', type: 'short', required: true, order: 0 },
        ],
      },
    });
    mockOrganizationRepo.findOne.mockResolvedValue(orgWithQuestionsAutoApprove);
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));

    const result = await service.apply('org-1', 'user-1', 'Hello', { 'q-1': 'MyHandle' }, 'web');

    expect(result.status).toBe(OrgApplicationStatus.APPROVED);
    expect(result.formResponses).toEqual({ 'q-1': 'MyHandle' });
    expect(result.source).toBe('web');
    expect(mockMemberService.addMember).toHaveBeenCalled();
  });

  it('filters out extra formResponse keys not matching configured question IDs', async () => {
    const orgWithQuestions = makeOrg({
      settings: {
        requireApproval: true,
        applicationQuestions: [
          { id: 'q-1', label: 'RSI Handle', type: 'short', required: true, order: 0 },
        ],
      },
    });
    mockOrganizationRepo.findOne.mockResolvedValue(orgWithQuestions);
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1', 'Hi', {
      'q-1': 'MyHandle',
      'fake-id': 'Injected data',
    });

    expect(result.formResponses).toEqual({ 'q-1': 'MyHandle' });
    expect(result.formResponses).not.toHaveProperty('fake-id');
  });
});

// ── apply() — watchlist check ───────────────────────────────────────

describe('OrgApplicationService.apply() — watchlist check', () => {
  it('throws ForbiddenError when user RSI handle is on the org watchlist', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: 'FlaggedCitizen' });
    mockWatchlistRepo.findOne.mockResolvedValue({
      id: 'wl-1',
      organizationId: 'org-1',
      rsiHandle: 'FLAGGEDCITIZEN',
      threatLevel: 'high',
    });

    await expect(service.apply('org-1', 'user-1')).rejects.toThrow(ForbiddenError);
    // Should not reach duplicate-check or application creation
    expect(mockApplicationRepo.findOne).not.toHaveBeenCalled();
  });

  it('allows application when user RSI handle is NOT on the watchlist', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: 'SafeCitizen' });
    mockWatchlistRepo.findOne.mockResolvedValue(null); // not on watchlist
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1', 'Hello');

    expect(result.status).toBe(OrgApplicationStatus.PENDING);
    expect(mockWatchlistRepo.findOne).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        rsiHandle: 'SAFECITIZEN',
      },
    });
  });

  it('skips watchlist check when user has no RSI handle', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockProfileRepo.findOne.mockResolvedValue(makeProfile());
    mockMembershipRepo.findOne.mockResolvedValue(null);
    mockApplicationRepo.findOne.mockResolvedValue(null);
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: null });
    mockApplicationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockApplicationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-app', ...entity })
    );

    const result = await service.apply('org-1', 'user-1', 'Hello');

    expect(result.status).toBe(OrgApplicationStatus.PENDING);
    expect(mockWatchlistRepo.findOne).not.toHaveBeenCalled();
  });
});

// ── checkWatchlist() ────────────────────────────────────────────────

describe('OrgApplicationService.checkWatchlist()', () => {
  it('throws ForbiddenError when RSI handle matches a watchlist entry', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: 'FlaggedCitizen' });
    mockWatchlistRepo.findOne.mockResolvedValue({
      id: 'wl-1',
      organizationId: 'org-1',
      rsiHandle: 'FLAGGEDCITIZEN',
    });

    await expect(service.checkWatchlist('org-1', 'user-1')).rejects.toThrow(ForbiddenError);
  });

  it('resolves when RSI handle is not on watchlist', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: 'SafeCitizen' });
    mockWatchlistRepo.findOne.mockResolvedValue(null);

    await expect(service.checkWatchlist('org-1', 'user-1')).resolves.toBeUndefined();
  });

  it('resolves when user has no RSI handle (watchlist lookup skipped)', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', rsiHandle: null });

    await expect(service.checkWatchlist('org-1', 'user-1')).resolves.toBeUndefined();
    expect(mockWatchlistRepo.findOne).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
