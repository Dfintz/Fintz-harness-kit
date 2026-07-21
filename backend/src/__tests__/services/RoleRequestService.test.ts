import { ApprovalRequestStatus, ApprovalRequestType } from '../../models/ApprovalRequest';
import { ConflictError, ForbiddenError, ValidationError } from '../../utils/apiErrors';

// ── Mocks (mock-prefixed so jest factory hoisting can reference them) ─────────
const mockApprovalService = {
  createApproval: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  getApproval: jest.fn(),
  listApprovals: jest.fn(),
};
const mockMemberRoleAssignmentService = {
  applyRoleAssignment: jest.fn(),
  emitRoleChanged: jest.fn(),
  assignRole: jest.fn(),
};
const mockNotificationService = { create: jest.fn() };

const mockMembershipRepo = { findOne: jest.fn(), find: jest.fn() };
const mockRoleRepo = { findOne: jest.fn() };
const mockTxApprovalRepo = { findOne: jest.fn() };
const mockTxMembershipRepo = { findOne: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    getRepository: jest.fn((entity: { name?: string }) => {
      if (entity?.name === 'ApprovalRequest') return mockTxApprovalRepo;
      if (entity?.name === 'OrganizationMembership') return mockTxMembershipRepo;
      return { findOne: jest.fn() };
    }),
  },
};

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: { name?: string }) => {
      if (entity?.name === 'OrganizationMembership') return mockMembershipRepo;
      if (entity?.name === 'Role') return mockRoleRepo;
      return { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
    }),
    createQueryRunner: jest.fn(() => mockQueryRunner),
    manager: { getRepository: jest.fn() },
  },
}));
jest.mock('../../services/approval/ApprovalService', () => ({
  ApprovalService: jest.fn(() => mockApprovalService),
}));
jest.mock('../../services/organization/MemberRoleAssignmentService', () => ({
  MemberRoleAssignmentService: jest.fn(() => mockMemberRoleAssignmentService),
}));
jest.mock('../../services/communication/notifications/NotificationService', () => ({
  NotificationService: jest.fn(() => mockNotificationService),
}));
jest.mock('../../utils/roleUtils', () => ({
  getRoleName: jest.fn((role?: { name?: string }) => role?.name ?? ''),
}));

// Imported after mocks are registered.
import { RoleRequestService } from '../../services/organization/RoleRequestService';

const ORG = 'org-1';
const REQUESTER = 'user-requester';
const APPROVER = 'user-approver';

const adminMembership = (userId: string) => ({
  userId,
  organizationId: ORG,
  roleId: 'role-admin',
  isActive: true,
  role: { name: 'admin' },
});

describe('RoleRequestService', () => {
  let service: RoleRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoleRequestService();
  });

  describe('requestRoleChange', () => {
    const officerRole = { id: 'role-officer', name: 'Officer', organizationId: ORG };

    beforeEach(() => {
      mockRoleRepo.findOne.mockResolvedValue(officerRole);
      // requester membership (active, holds a different role)
      mockMembershipRepo.findOne.mockResolvedValue({
        userId: REQUESTER,
        organizationId: ORG,
        roleId: 'role-member',
        isActive: true,
        role: { name: 'member' },
      });
      mockMembershipRepo.find.mockResolvedValue([
        adminMembership(APPROVER),
        { userId: REQUESTER, role: { name: 'member' } },
      ]);
      mockApprovalService.createApproval.mockResolvedValue({
        id: 'appr-1',
        requestedBy: REQUESTER,
      });
      mockNotificationService.create.mockResolvedValue({ success: true });
    });

    it('creates a role_change approval and notifies eligible approvers (not the requester)', async () => {
      await service.requestRoleChange(ORG, REQUESTER, officerRole.id, 'please promote me');

      expect(mockApprovalService.createApproval).toHaveBeenCalledWith(
        ORG,
        REQUESTER,
        expect.objectContaining({
          type: ApprovalRequestType.ROLE_CHANGE,
          resourceId: officerRole.id,
          metadata: { roleName: 'Officer' },
        })
      );
      // assignedTo intentionally omitted so any authorized approver can act.
      expect(mockApprovalService.createApproval.mock.calls[0][2]).not.toHaveProperty('assignedTo');
      expect(mockNotificationService.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: APPROVER, type: 'role_request' })
      );
    });

    it('blocks self-service requests for governance roles', async () => {
      mockRoleRepo.findOne.mockResolvedValue({
        id: 'role-admin',
        name: 'admin',
        organizationId: ORG,
      });

      await expect(
        service.requestRoleChange(ORG, REQUESTER, 'role-admin', 'gimme')
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockApprovalService.createApproval).not.toHaveBeenCalled();
    });

    it('fails with ConflictError when no eligible approver exists (no orphan request)', async () => {
      mockMembershipRepo.find.mockResolvedValue([{ userId: REQUESTER, role: { name: 'member' } }]);

      await expect(
        service.requestRoleChange(ORG, REQUESTER, officerRole.id, 'please')
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockApprovalService.createApproval).not.toHaveBeenCalled();
    });

    it('rejects when the requester already holds the role', async () => {
      mockMembershipRepo.findOne.mockResolvedValue({
        userId: REQUESTER,
        organizationId: ORG,
        roleId: officerRole.id,
        isActive: true,
        role: { name: 'member' },
      });

      await expect(
        service.requestRoleChange(ORG, REQUESTER, officerRole.id, 'please')
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects when the requester is not an active member', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.requestRoleChange(ORG, REQUESTER, officerRole.id, 'please')
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('approveRoleChange', () => {
    const pendingApproval = {
      id: 'appr-1',
      organizationId: ORG,
      type: ApprovalRequestType.ROLE_CHANGE,
      status: ApprovalRequestStatus.PENDING,
      requestedBy: REQUESTER,
      resourceId: 'role-officer',
    };

    beforeEach(() => {
      mockMembershipRepo.findOne.mockResolvedValue(adminMembership(APPROVER));
      mockTxApprovalRepo.findOne.mockResolvedValue({ ...pendingApproval });
      mockTxMembershipRepo.findOne.mockResolvedValue({ userId: REQUESTER, isActive: true });
      mockMemberRoleAssignmentService.applyRoleAssignment.mockResolvedValue({
        targetUserId: REQUESTER,
        roleId: 'role-officer',
        roleName: 'Officer',
        previousRoleName: 'member',
      });
      mockMemberRoleAssignmentService.emitRoleChanged.mockResolvedValue(undefined);
      mockApprovalService.approve.mockResolvedValue({
        ...pendingApproval,
        status: ApprovalRequestStatus.APPROVED,
      });
      mockNotificationService.create.mockResolvedValue({ success: true });
    });

    it('grants the role and approves atomically inside one transaction', async () => {
      await service.approveRoleChange(ORG, 'appr-1', APPROVER, 'looks good');

      // grant + approval status transition both go through the tx manager
      expect(mockMemberRoleAssignmentService.applyRoleAssignment).toHaveBeenCalledWith(
        mockQueryRunner.manager,
        expect.objectContaining({
          organizationId: ORG,
          targetUserId: REQUESTER,
          roleId: 'role-officer',
          actorUserId: APPROVER,
        })
      );
      expect(mockApprovalService.approve).toHaveBeenCalledWith(
        'appr-1',
        ORG,
        APPROVER,
        'looks good',
        mockQueryRunner.manager
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
      // side-effects fire only after commit
      expect(mockMemberRoleAssignmentService.emitRoleChanged).toHaveBeenCalledWith(
        ORG,
        REQUESTER,
        APPROVER
      );
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: REQUESTER, type: 'role_request_approved' })
      );
    });

    it('rejects an unauthorized approver before opening a transaction', async () => {
      mockMembershipRepo.findOne.mockResolvedValue({
        userId: APPROVER,
        organizationId: ORG,
        isActive: true,
        role: { name: 'member' },
      });

      await expect(service.approveRoleChange(ORG, 'appr-1', APPROVER, 'ok')).rejects.toBeInstanceOf(
        ForbiddenError
      );
      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
      expect(mockMemberRoleAssignmentService.applyRoleAssignment).not.toHaveBeenCalled();
    });

    it('blocks self-approval and rolls back', async () => {
      mockTxApprovalRepo.findOne.mockResolvedValue({ ...pendingApproval, requestedBy: APPROVER });

      await expect(
        service.approveRoleChange(ORG, 'appr-1', APPROVER, 'self')
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(mockMemberRoleAssignmentService.applyRoleAssignment).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('rejects a non-pending request (idempotency guard)', async () => {
      mockTxApprovalRepo.findOne.mockResolvedValue({
        ...pendingApproval,
        status: ApprovalRequestStatus.APPROVED,
      });

      await expect(
        service.approveRoleChange(ORG, 'appr-1', APPROVER, 'again')
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mockMemberRoleAssignmentService.applyRoleAssignment).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('aborts when the requester is no longer an active member', async () => {
      mockTxMembershipRepo.findOne.mockResolvedValue(null);

      await expect(service.approveRoleChange(ORG, 'appr-1', APPROVER, 'ok')).rejects.toBeInstanceOf(
        ConflictError
      );
      expect(mockMemberRoleAssignmentService.applyRoleAssignment).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('rolls back and propagates when the grant fails', async () => {
      mockMemberRoleAssignmentService.applyRoleAssignment.mockRejectedValue(
        new Error('grant boom')
      );

      await expect(service.approveRoleChange(ORG, 'appr-1', APPROVER, 'ok')).rejects.toThrow(
        'grant boom'
      );
      expect(mockApprovalService.approve).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejectRoleChange', () => {
    beforeEach(() => {
      mockMembershipRepo.findOne.mockResolvedValue(adminMembership(APPROVER));
      mockApprovalService.getApproval.mockResolvedValue({
        id: 'appr-1',
        type: ApprovalRequestType.ROLE_CHANGE,
        requestedBy: REQUESTER,
        metadata: { roleName: 'Officer' },
      });
      mockApprovalService.reject.mockResolvedValue({
        id: 'appr-1',
        status: ApprovalRequestStatus.REJECTED,
      });
      mockNotificationService.create.mockResolvedValue({ success: true });
    });

    it('rejects the request and notifies the requester', async () => {
      await service.rejectRoleChange(ORG, 'appr-1', APPROVER, 'not now');

      expect(mockApprovalService.reject).toHaveBeenCalledWith('appr-1', ORG, APPROVER, 'not now');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: REQUESTER, type: 'role_request_rejected' })
      );
    });

    it('rejects an unauthorized approver', async () => {
      mockMembershipRepo.findOne.mockResolvedValue({
        userId: APPROVER,
        organizationId: ORG,
        isActive: true,
        role: { name: 'member' },
      });

      await expect(service.rejectRoleChange(ORG, 'appr-1', APPROVER, 'no')).rejects.toBeInstanceOf(
        ForbiddenError
      );
      expect(mockApprovalService.reject).not.toHaveBeenCalled();
    });
  });

  describe('listPendingForApprover', () => {
    it('returns pending role-change requests for an authorized approver', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(adminMembership(APPROVER));
      mockApprovalService.listApprovals.mockResolvedValue({
        approvals: [{ id: 'appr-1' }],
        total: 1,
      });

      const result = await service.listPendingForApprover(ORG, APPROVER);

      expect(mockApprovalService.listApprovals).toHaveBeenCalledWith(ORG, {
        status: ApprovalRequestStatus.PENDING,
        type: ApprovalRequestType.ROLE_CHANGE,
      });
      expect(result).toHaveLength(1);
    });

    it('rejects an unauthorized approver', async () => {
      mockMembershipRepo.findOne.mockResolvedValue({
        userId: APPROVER,
        organizationId: ORG,
        isActive: true,
        role: { name: 'member' },
      });

      await expect(service.listPendingForApprover(ORG, APPROVER)).rejects.toBeInstanceOf(
        ForbiddenError
      );
      expect(mockApprovalService.listApprovals).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
