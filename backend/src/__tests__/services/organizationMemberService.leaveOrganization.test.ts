/**
 * Tests for OrganizationMemberService.leaveOrganization
 * Covers: membership validation, owner guard, member removal, activeOrgId cleanup
 */

import { Repository } from 'typeorm';

import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';

// Variables for the transaction manager mock — referenced by tests via closure
let transactionSaveSpy: jest.Mock;
let transactionFindOneSpy: jest.Mock;

// Mock dependencies
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/shared/DomainEventBus', () => ({
  domainEvents: { emit: jest.fn() },
}));

jest.mock('../../services/security/core/RoleService', () => ({
  getRoleService: jest.fn(() => ({
    getDefaultRole: jest.fn().mockResolvedValue({ id: 'role-member', name: 'member' }),
    findRoleByName: jest.fn(),
  })),
}));

import { AppDataSource } from '../../data-source';
import { OrganizationMemberService } from '../../services/organization/OrganizationMemberService';

describe('OrganizationMemberService - leaveOrganization', () => {
  let service: OrganizationMemberService;
  let mockMembershipRepo: jest.Mocked<Repository<OrganizationMembership>>;
  let mockOrgRepo: jest.Mocked<Repository<Organization>>;
  let mockUserRepo: jest.Mocked<Repository<User>>;

  beforeAll(() => {
    mockMembershipRepo = {
      findOne: jest.fn(),
      save: jest.fn(entity => Promise.resolve(entity as OrganizationMembership)),
      count: jest.fn().mockResolvedValue(5),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<OrganizationMembership>>;

    mockOrgRepo = {
      findOne: jest.fn(),
      save: jest.fn(entity => Promise.resolve(entity as Organization)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<Repository<Organization>>;

    mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn(entity => Promise.resolve(entity as User)),
    } as unknown as jest.Mocked<Repository<User>>;

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === OrganizationMembership) return mockMembershipRepo;
      if (entity === Organization) return mockOrgRepo;
      if (entity === User) return mockUserRepo;
      return {};
    });

    service = new OrganizationMemberService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockMembershipRepo.count.mockResolvedValue(5);

    // Set up transaction mock: executes callback with a fake EntityManager
    transactionSaveSpy = jest.fn((entity: unknown) => Promise.resolve(entity));
    transactionFindOneSpy = jest.fn();

    (AppDataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (manager: { save: jest.Mock; findOne: jest.Mock }) => Promise<void>) => {
        await cb({ save: transactionSaveSpy, findOne: transactionFindOneSpy });
      }
    );
  });

  const ORG_ID = 'org-111';
  const USER_ID = 'user-222';

  function makeMembership(roleName: string): OrganizationMembership {
    return {
      id: 'mem-1',
      organizationId: ORG_ID,
      userId: USER_ID,
      isActive: true,
      role: { id: 'role-1', name: roleName },
    } as unknown as OrganizationMembership;
  }

  it('should remove an active non-owner member', async () => {
    const membership = makeMembership('member');
    mockMembershipRepo.findOne.mockResolvedValueOnce(membership);
    transactionFindOneSpy.mockResolvedValue({
      id: USER_ID,
      username: 'TestUser',
      activeOrgId: 'other-org',
    } as User);

    await service.leaveOrganization(ORG_ID, USER_ID, USER_ID);

    // membership should be deactivated inside the transaction
    expect(transactionSaveSpy).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    // activeOrgId should NOT be updated (different org)
    expect(transactionSaveSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit platform_left event with the actual username, not the userId', async () => {
    const { domainEvents } = require('../../services/shared/DomainEventBus');
    const membership = makeMembership('member');
    mockMembershipRepo.findOne.mockResolvedValueOnce(membership);
    transactionFindOneSpy.mockResolvedValue({
      id: USER_ID,
      username: 'ActualDisplayName',
      activeOrgId: 'other-org',
    } as User);

    await service.leaveOrganization(ORG_ID, USER_ID, USER_ID);

    expect(domainEvents.emit).toHaveBeenCalledWith(
      'member:platform_left',
      expect.objectContaining({
        userId: USER_ID,
        organizationId: ORG_ID,
        username: 'ActualDisplayName',
      })
    );
  });

  it('should clear activeOrgId when the user was viewing the left org', async () => {
    const membership = makeMembership('officer');
    mockMembershipRepo.findOne.mockResolvedValueOnce(membership);
    const user = { id: USER_ID, username: 'OfficerUser', activeOrgId: ORG_ID } as User;
    transactionFindOneSpy.mockResolvedValue(user);

    await service.leaveOrganization(ORG_ID, USER_ID, USER_ID);

    // Both membership deactivation and user activeOrgId clear
    expect(transactionSaveSpy).toHaveBeenCalledTimes(2);
    expect(transactionSaveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeOrgId: undefined })
    );
  });

  it('should throw ForbiddenError when userId does not match authenticatedUserId', async () => {
    await expect(service.leaveOrganization(ORG_ID, USER_ID, 'different-user-id')).rejects.toThrow(
      'You can only remove yourself'
    );
  });

  it('should throw NotFoundError when membership does not exist', async () => {
    mockMembershipRepo.findOne.mockResolvedValue(null);

    await expect(service.leaveOrganization(ORG_ID, USER_ID, USER_ID)).rejects.toThrow('not found');
  });

  it('should throw ForbiddenError when member is the owner', async () => {
    const ownership = makeMembership('owner');
    mockMembershipRepo.findOne.mockResolvedValue(ownership);

    await expect(service.leaveOrganization(ORG_ID, USER_ID, USER_ID)).rejects.toThrow(
      'Organization owners cannot leave'
    );
  });

  it('should throw ForbiddenError when member is the founder', async () => {
    const ownership = makeMembership('founder');
    mockMembershipRepo.findOne.mockResolvedValue(ownership);

    await expect(service.leaveOrganization(ORG_ID, USER_ID, USER_ID)).rejects.toThrow(
      'Organization owners cannot leave'
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
