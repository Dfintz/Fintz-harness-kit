import { createMockDataSource, createMockRepository } from '../../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../../services/organization/OrganizationMemberService');
jest.mock('../../../services/communication/notifications/NotificationService');

import { InvitationStatus } from '../../../models/Invitation';
import { NotificationService } from '../../../services/communication/notifications/NotificationService';
import {
  INVITATION_TERMINAL_STATUSES,
  InvitationService,
} from '../../../services/invitation/InvitationService';
import { OrganizationMemberService } from '../../../services/organization/OrganizationMemberService';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../utils/apiErrors';

// ── helpers ─────────────────────────────────────────────────────────

function makeOrg(overrides: Record<string, unknown> = {}) {
  return { id: 'org-1', settings: {}, ...overrides };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return { id: 'user-1', username: 'testuser', ...overrides };
}

function makeInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    organizationId: 'org-1',
    inviteeUserId: 'user-2',
    inviterId: 'user-1',
    inviterRole: 'admin',
    status: InvitationStatus.APPROVED,
    message: undefined,
    token: 'abc123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

// ── mocks ───────────────────────────────────────────────────────────

let mockInvitationRepo: ReturnType<typeof createMockRepository>;
let mockOrganizationRepo: ReturnType<typeof createMockRepository>;
let mockMembershipRepo: ReturnType<typeof createMockRepository>;
let mockUserRepo: ReturnType<typeof createMockRepository>;
let mockMemberService: jest.Mocked<OrganizationMemberService>;
let mockNotificationService: jest.Mocked<NotificationService>;

let service: InvitationService;

beforeEach(() => {
  jest.clearAllMocks();

  mockInvitationRepo = createMockRepository();
  mockOrganizationRepo = createMockRepository();
  mockMembershipRepo = createMockRepository();
  mockUserRepo = createMockRepository();

  // Map entity name → mock repository
  mockDataSource.getRepository.mockImplementation((entity: any) => {
    const name = typeof entity === 'function' ? entity.name : String(entity);
    switch (name) {
      case 'Invitation':
        return mockInvitationRepo;
      case 'Organization':
        return mockOrganizationRepo;
      case 'OrganizationMembership':
        return mockMembershipRepo;
      case 'User':
        return mockUserRepo;
      default:
        return createMockRepository();
    }
  });

  // Mock OrganizationMemberService
  mockMemberService = {
    addMember: jest.fn().mockResolvedValue({}),
  } as any;
  (OrganizationMemberService as jest.Mock).mockImplementation(() => mockMemberService);

  // Mock NotificationService (invitee-approval notifications)
  mockNotificationService = {
    create: jest.fn().mockResolvedValue({ success: true, channel: 'in-app', recipientCount: 1 }),
  } as any;
  (NotificationService as jest.Mock).mockImplementation(() => mockNotificationService);

  service = new InvitationService();
});

// ── INVITATION_TERMINAL_STATUSES ────────────────────────────────────

describe('INVITATION_TERMINAL_STATUSES', () => {
  it('includes ACCEPTED, REJECTED, DECLINED, and EXPIRED', () => {
    expect(INVITATION_TERMINAL_STATUSES).toContain(InvitationStatus.ACCEPTED);
    expect(INVITATION_TERMINAL_STATUSES).toContain(InvitationStatus.REJECTED);
    expect(INVITATION_TERMINAL_STATUSES).toContain(InvitationStatus.DECLINED);
    expect(INVITATION_TERMINAL_STATUSES).toContain(InvitationStatus.EXPIRED);
  });

  it('does NOT include PENDING or APPROVED', () => {
    expect(INVITATION_TERMINAL_STATUSES).not.toContain(InvitationStatus.PENDING);
    expect(INVITATION_TERMINAL_STATUSES).not.toContain(InvitationStatus.APPROVED);
  });
});

// ── invite() ────────────────────────────────────────────────────────

describe('InvitationService.invite()', () => {
  it('creates an APPROVED invitation when inviterRole is admin', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(null); // no duplicate
    mockInvitationRepo.count.mockResolvedValue(0); // no spam
    mockInvitationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockInvitationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-inv', ...entity })
    );

    const result = await service.invite('org-1', 'user-2', 'user-1', 'admin', 'Welcome!');

    expect(result.status).toBe(InvitationStatus.APPROVED);
    expect(result.message).toBe('Welcome!');
    expect(result.token).toBeDefined();
    expect(result.expiresAt).toBeDefined();
  });

  it('creates a PENDING invitation when inviterRole is member', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(null);
    mockInvitationRepo.count.mockResolvedValue(0);
    mockInvitationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockInvitationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-inv', ...entity })
    );

    const result = await service.invite('org-1', 'user-2', 'user-1', 'member');

    expect(result.status).toBe(InvitationStatus.PENDING);
  });

  it('creates an APPROVED invitation when inviterRole is officer', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(null);
    mockInvitationRepo.count.mockResolvedValue(0);
    mockInvitationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockInvitationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-inv', ...entity })
    );

    const result = await service.invite('org-1', 'user-2', 'user-1', 'officer');

    expect(result.status).toBe(InvitationStatus.APPROVED);
  });

  it('creates an APPROVED invitation and notifies the invitee when inviterRole is founder', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg({ name: 'Test Org' }));
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(null);
    mockInvitationRepo.count.mockResolvedValue(0);
    mockInvitationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockInvitationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-inv', ...entity })
    );

    const result = await service.invite('org-1', 'user-2', 'user-1', 'founder');

    expect(result.status).toBe(InvitationStatus.APPROVED);
    expect(mockNotificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        data: expect.objectContaining({
          kind: 'organization_invitation',
          organizationId: 'org-1',
          invitationId: 'new-inv',
        }),
      })
    );
  });

  it('does NOT notify the invitee when the invitation is pending (member-sent)', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(null);
    mockInvitationRepo.count.mockResolvedValue(0);
    mockInvitationRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockInvitationRepo.save.mockImplementation((entity: any) =>
      Promise.resolve({ id: 'new-inv', ...entity })
    );

    await service.invite('org-1', 'user-2', 'user-1', 'member');

    expect(mockNotificationService.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when org does not exist', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(null);

    await expect(service.invite('nonexistent', 'user-2', 'user-1', 'admin')).rejects.toThrow(
      NotFoundError
    );
  });

  it('throws NotFoundError when invitee does not exist', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(service.invite('org-1', 'nonexistent', 'user-1', 'admin')).rejects.toThrow(
      NotFoundError
    );
  });

  it('throws ConflictError when invitee is already a member', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValue({ userId: 'user-2', isActive: true });

    await expect(service.invite('org-1', 'user-2', 'user-1', 'admin')).rejects.toThrow(
      ConflictError
    );
  });

  it('throws ConflictError when a non-terminal invitation already exists', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(makeInvitation()); // existing

    await expect(service.invite('org-1', 'user-2', 'user-1', 'admin')).rejects.toThrow(
      ConflictError
    );
  });

  it('throws ValidationError when inviter exceeds max pending invitations (spam guard)', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(null); // no duplicate
    mockInvitationRepo.count.mockResolvedValue(10); // at limit

    await expect(service.invite('org-1', 'user-2', 'user-1', 'member')).rejects.toThrow(
      ValidationError
    );
  });

  it('throws ForbiddenError when inviter is not a member of the organization (B-01)', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // inviter not a member either

    await expect(service.invite('org-1', 'user-2', 'user-1', 'admin')).rejects.toThrow(
      ForbiddenError
    );
  });

  it('throws ValidationError when invitee has too many pending invitations globally (invitee spam guard)', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    mockInvitationRepo.findOne.mockResolvedValue(null); // no duplicate, no recent rejection
    mockInvitationRepo.count.mockResolvedValue(25); // invitee at global cap

    await expect(service.invite('org-1', 'user-2', 'user-1', 'admin')).rejects.toThrow(
      ValidationError
    );
  });

  it('throws ValidationError when re-inviting a user who recently declined (cooldown)', async () => {
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 'user-2' }));
    mockMembershipRepo.findOne.mockResolvedValueOnce(null); // invitee not a member
    mockMembershipRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', isActive: true }); // inviter is a member
    // First findOne: duplicate check returns null (no active invite).
    // Second findOne: cooldown check returns a recent declined invitation.
    mockInvitationRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        makeInvitation({ status: InvitationStatus.DECLINED, updatedAt: new Date() })
      );

    await expect(service.invite('org-1', 'user-2', 'user-1', 'admin')).rejects.toThrow(
      ValidationError
    );
  });
});

// ── approveInvitation() ─────────────────────────────────────────────

describe('InvitationService.approveInvitation()', () => {
  it('transitions pending invitation to approved and notifies the invitee', async () => {
    const inv = makeInvitation({ status: InvitationStatus.PENDING });
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.approveInvitation('inv-1', 'org-1', 'admin-1');

    expect(result.status).toBe(InvitationStatus.APPROVED);
    expect(mockNotificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        data: expect.objectContaining({ invitationId: 'inv-1' }),
      })
    );
  });

  it('throws NotFoundError when invitation does not exist', async () => {
    mockInvitationRepo.findOne.mockResolvedValue(null);

    await expect(service.approveInvitation('nonexistent', 'org-1', 'admin-1')).rejects.toThrow(
      NotFoundError
    );
  });
});

// ── rejectInvitation() ──────────────────────────────────────────────

describe('InvitationService.rejectInvitation()', () => {
  it('transitions pending invitation to rejected', async () => {
    const inv = makeInvitation({ status: InvitationStatus.PENDING });
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.rejectInvitation('inv-1', 'org-1', 'admin-1');

    expect(result.status).toBe(InvitationStatus.REJECTED);
  });
});

// ── acceptByToken() ─────────────────────────────────────────────────

describe('InvitationService.acceptByToken()', () => {
  it('accepts an approved invitation and adds member', async () => {
    const inv = makeInvitation({ status: InvitationStatus.APPROVED });
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.acceptByToken('abc123', 'user-2');

    expect(result.status).toBe(InvitationStatus.ACCEPTED);
    expect(mockMemberService.addMember).toHaveBeenCalledWith(
      'org-1',
      'user-2',
      'member',
      undefined,
      undefined,
      undefined,
      { acquisitionSource: 'invitation', acquisitionRefId: 'inv-1' }
    );
  });

  it('throws NotFoundError when token does not match any invitation', async () => {
    mockInvitationRepo.findOne.mockResolvedValue(null);

    await expect(service.acceptByToken('badtoken', 'user-2')).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when invitation is expired', async () => {
    const inv = makeInvitation({
      status: InvitationStatus.APPROVED,
      expiresAt: new Date(Date.now() - 1000), // expired
    });
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    await expect(service.acceptByToken('abc123', 'user-2')).rejects.toThrow(ValidationError);
    expect(inv.status).toBe(InvitationStatus.EXPIRED);
  });

  it('rolls back status when addMember fails', async () => {
    const inv = makeInvitation({ status: InvitationStatus.APPROVED });
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockMemberService.addMember.mockRejectedValue(new Error('Already a member'));

    await expect(service.acceptByToken('abc123', 'user-2')).rejects.toThrow('Already a member');
    expect(inv.status).toBe(InvitationStatus.APPROVED);
    expect(mockInvitationRepo.save).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when authenticated user is not the invitee (M-01)', async () => {
    const inv = makeInvitation({ status: InvitationStatus.APPROVED, inviteeUserId: 'user-2' });
    mockInvitationRepo.findOne.mockResolvedValue(inv);

    await expect(service.acceptByToken('abc123', 'wrong-user')).rejects.toThrow(ForbiddenError);
  });
});

// ── acceptByCode() ────────────────────────────────────────────────

describe('InvitationService.acceptByCode()', () => {
  it('accepts an invitation by short invite code for the authenticated invitee', async () => {
    const inv = makeInvitation({
      token: 'abcd1234ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      status: InvitationStatus.APPROVED,
      inviteeUserId: 'user-2',
    });

    mockInvitationRepo.find
      .mockResolvedValueOnce([inv]) // code resolution list
      .mockResolvedValueOnce([inv]); // acceptByToken list fallback reads
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockOrganizationRepo.findOne.mockResolvedValue(makeOrg());
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.acceptByCode('ABCD1234', 'user-2');

    expect(result.status).toBe(InvitationStatus.ACCEPTED);
    expect(mockMemberService.addMember).toHaveBeenCalled();
  });

  it('throws ValidationError when code format is invalid', async () => {
    await expect(service.acceptByCode('bad-code', 'user-2')).rejects.toThrow(ValidationError);
  });
});

// ── declineByToken() ────────────────────────────────────────────────

describe('InvitationService.declineByToken()', () => {
  it('declines an approved invitation', async () => {
    const inv = makeInvitation({ status: InvitationStatus.APPROVED });
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.declineByToken('abc123', 'user-2');

    expect(result.status).toBe(InvitationStatus.DECLINED);
    expect(mockMemberService.addMember).not.toHaveBeenCalled();
  });

  it('throws ValidationError when invitation is expired', async () => {
    const inv = makeInvitation({
      status: InvitationStatus.APPROVED,
      expiresAt: new Date(Date.now() - 1000),
    });
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    await expect(service.declineByToken('abc123', 'user-2')).rejects.toThrow(ValidationError);
  });

  it('throws ForbiddenError when authenticated user is not the invitee (M-01)', async () => {
    const inv = makeInvitation({ status: InvitationStatus.APPROVED, inviteeUserId: 'user-2' });
    mockInvitationRepo.findOne.mockResolvedValue(inv);

    await expect(service.declineByToken('abc123', 'wrong-user')).rejects.toThrow(ForbiddenError);
  });
});

// ── declineByCode() ───────────────────────────────────────────────

describe('InvitationService.declineByCode()', () => {
  it('declines an invitation by short invite code for the authenticated invitee', async () => {
    const inv = makeInvitation({
      token: 'zzzz9999ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      status: InvitationStatus.APPROVED,
      inviteeUserId: 'user-2',
    });

    mockInvitationRepo.find.mockResolvedValue([inv]);
    mockInvitationRepo.findOne.mockResolvedValue(inv);
    mockInvitationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

    const result = await service.declineByCode('ZZZZ9999', 'user-2');

    expect(result.status).toBe(InvitationStatus.DECLINED);
  });
});

// ── expireStale() ───────────────────────────────────────────────────

describe('InvitationService.expireStale()', () => {
  it('expires stale pending and approved invitations', async () => {
    const mockQb = mockInvitationRepo.createQueryBuilder();
    mockQb.update = jest.fn().mockReturnThis();
    mockQb.set = jest.fn().mockReturnThis();
    mockQb.execute.mockResolvedValue({ affected: 2 });

    const count = await service.expireStale();

    expect(count).toBe(2);
  });

  it('returns 0 when there are no stale invitations', async () => {
    const mockQb = mockInvitationRepo.createQueryBuilder();
    mockQb.update = jest.fn().mockReturnThis();
    mockQb.set = jest.fn().mockReturnThis();
    mockQb.execute.mockResolvedValue({ affected: 0 });

    const count = await service.expireStale();

    expect(count).toBe(0);
  });
});

// ── getMyInvitations() ──────────────────────────────────────────────

describe('InvitationService.getMyInvitations()', () => {
  it('returns invitations for the user excluding expired', async () => {
    const invitations = [makeInvitation({ inviteeUserId: 'user-1' })];
    mockInvitationRepo.find.mockResolvedValue(invitations);

    const result = await service.getMyInvitations('user-1');

    expect(result).toHaveLength(1);
    expect(mockInvitationRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inviteeUserId: 'user-1',
        }),
        order: { createdAt: 'DESC' },
      })
    );
  });

  it('includes token and organization display fields for invitee', async () => {
    const inv = makeInvitation({
      inviteeUserId: 'user-1',
      organization: { name: 'Test Org' },
    });
    mockInvitationRepo.find.mockResolvedValue([inv]);

    const result = await service.getMyInvitations('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('token');
    expect(result[0]).toHaveProperty('inviteCode');
    expect(result[0]).toHaveProperty('organizationName', 'Test Org');
  });
});

// ── getInvitationsForOrg() ──────────────────────────────────────────

describe('InvitationService.getInvitationsForOrg()', () => {
  it('returns paginated invitations for the org without token', async () => {
    const inv = makeInvitation({
      invitee: { username: 'bob' },
      inviter: { username: 'alice' },
    });
    mockInvitationRepo.findAndCount.mockResolvedValue([[inv], 1]);

    const result = await service.getInvitationsForOrg('org-1');

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    // Token must NOT be in admin view
    expect(result.data[0]).not.toHaveProperty('token');
    // Display fields should be populated
    expect(result.data[0]).toHaveProperty('inviteeUsername', 'bob');
    expect(result.data[0]).toHaveProperty('inviterUsername', 'alice');
  });

  it('supports status filtering', async () => {
    mockInvitationRepo.findAndCount.mockResolvedValue([[], 0]);

    await service.getInvitationsForOrg('org-1', { status: InvitationStatus.PENDING });

    expect(mockInvitationRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          status: InvitationStatus.PENDING,
        }),
      })
    );
  });

  it('clamps limit to 100 maximum', async () => {
    mockInvitationRepo.findAndCount.mockResolvedValue([[], 0]);

    const result = await service.getInvitationsForOrg('org-1', { limit: 200 });

    expect(result.limit).toBe(100);
  });
});
