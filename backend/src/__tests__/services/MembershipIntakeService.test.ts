/**
 * MembershipIntakeService — unit tests for the read-only aggregation seam.
 *
 * Verifies: the permission gate (least privilege per source), normalization +
 * newest-first ordering across all three sources, and audit emission.
 */

// Mock owner services, permission service, and audit logger before importing the SUT.
const mockGetApplicationsForOrg = jest.fn();
const mockGetInvitationsForOrg = jest.fn();
const mockGetPendingApplicantsForOrg = jest.fn();
const mockCheckPermission = jest.fn();
const mockLogIntakeViewed = jest.fn();

jest.mock('../../services/organization/OrgApplicationService', () => ({
  OrgApplicationService: jest.fn().mockImplementation(() => ({
    getApplicationsForOrg: mockGetApplicationsForOrg,
  })),
}));

jest.mock('../../services/invitation/InvitationService', () => ({
  InvitationService: jest.fn().mockImplementation(() => ({
    getInvitationsForOrg: mockGetInvitationsForOrg,
  })),
}));

jest.mock('../../services/organization/recruitment/RecruitmentService', () => ({
  RecruitmentService: {
    getInstance: jest.fn(() => ({
      getPendingApplicantsForOrg: mockGetPendingApplicantsForOrg,
    })),
  },
}));

jest.mock('../../services/organization/OrganizationPermissionService', () => ({
  OrganizationPermissionService: jest.fn().mockImplementation(() => ({
    checkPermission: mockCheckPermission,
  })),
}));

jest.mock('../../services/organization/MembershipAuditLogger', () => ({
  membershipAuditLogger: {
    logIntakeViewed: (...args: unknown[]) => mockLogIntakeViewed(...args),
  },
}));

import { PermissionAction, ResourceType } from '../../models/OrganizationPermission';
import { MembershipIntakeService } from '../../services/organization/MembershipIntakeService';
import { ForbiddenError } from '../../utils/apiErrors';

const ALLOW = { allowed: true };
const DENY = { allowed: false };

/** Configure the permission mock: which of the two intake permissions are granted. */
function grantPermissions(canReview: boolean, canManage: boolean): void {
  mockCheckPermission.mockImplementation(
    (_userId: string, _orgId: string, resource: string, action: string) => {
      if (resource === ResourceType.RECRUITMENT && action === PermissionAction.APPROVE) {
        return Promise.resolve(canReview ? ALLOW : DENY);
      }
      if (resource === ResourceType.MEMBERS && action === PermissionAction.MANAGE) {
        return Promise.resolve(canManage ? ALLOW : DENY);
      }
      return Promise.resolve(DENY);
    }
  );
}

describe('MembershipIntakeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws ForbiddenError when the viewer holds neither intake permission', async () => {
    grantPermissions(false, false);

    const service = new MembershipIntakeService();

    await expect(service.getInbox('user-1', 'org-1')).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockLogIntakeViewed).not.toHaveBeenCalled();
  });

  it('aggregates all three sources, orders newest-first, and audits the view', async () => {
    grantPermissions(true, true);
    mockGetApplicationsForOrg.mockResolvedValue({
      data: [
        {
          id: 'app-1',
          status: 'pending',
          applicant: { id: 'user-a', username: 'Alice' },
          applicantUserId: 'user-a',
          message: 'Let me in',
          source: 'web',
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    mockGetInvitationsForOrg.mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          status: 'pending',
          inviteeUserId: 'user-b',
          inviteeUsername: 'Bob',
          inviterUsername: 'Admin',
          message: 'Join us',
          createdAt: new Date('2026-06-03T00:00:00.000Z'),
          expiresAt: new Date('2026-06-10T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    mockGetPendingApplicantsForOrg.mockResolvedValue([
      {
        applicationId: 'rec-app-1',
        applicantId: 'user-c',
        applicantName: 'Carol',
        rsiHandle: 'carol',
        status: 'pending',
        appliedAt: new Date('2026-06-01T00:00:00.000Z'),
        recruitmentId: 'rec-1',
        recruitmentTitle: 'Pilots Wanted',
      },
    ]);

    const service = new MembershipIntakeService();
    const result = await service.getInbox('user-1', 'org-1');

    expect(result.counts).toEqual({
      orgApplications: 1,
      invitations: 1,
      recruitmentApplicants: 1,
      total: 3,
    });
    // Newest-first: inv-1 (06-03) → app-1 (06-02) → rec-app-1 (06-01)
    expect(result.items.map(item => item.id)).toEqual(['inv-1', 'app-1', 'rec-app-1']);
    expect(result.items.map(item => item.kind)).toEqual([
      'invitation',
      'org_application',
      'recruitment_applicant',
    ]);
    expect(result.permissions).toEqual({
      canReviewApplications: true,
      canManageInvitations: true,
    });
    expect(mockLogIntakeViewed).toHaveBeenCalledWith('org-1', 3, 'user-1');
  });

  it('includes only invitations when the viewer has MEMBERS.MANAGE but not RECRUITMENT.APPROVE', async () => {
    grantPermissions(false, true);
    mockGetApplicationsForOrg.mockResolvedValue({
      data: [
        {
          id: 'app-1',
          status: 'pending',
          applicant: { id: 'user-a', username: 'Alice' },
          applicantUserId: 'user-a',
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    mockGetPendingApplicantsForOrg.mockResolvedValue([
      {
        applicationId: 'rec-app-1',
        applicantId: 'user-c',
        applicantName: 'Carol',
        rsiHandle: 'carol',
        status: 'pending',
        appliedAt: new Date('2026-06-01T00:00:00.000Z'),
        recruitmentId: 'rec-1',
        recruitmentTitle: 'Pilots Wanted',
      },
    ]);
    mockGetInvitationsForOrg.mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          status: 'pending',
          inviteeUserId: 'user-b',
          inviteeUsername: 'Bob',
          createdAt: new Date('2026-06-03T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });

    const service = new MembershipIntakeService();
    const result = await service.getInbox('user-1', 'org-1');

    expect(mockGetApplicationsForOrg).toHaveBeenCalledTimes(1);
    expect(mockGetPendingApplicantsForOrg).toHaveBeenCalledTimes(1);
    expect(mockGetInvitationsForOrg).toHaveBeenCalledTimes(1);
    expect(result.counts).toEqual({
      orgApplications: 1,
      invitations: 1,
      recruitmentApplicants: 1,
      total: 3,
    });
    expect(result.items).toHaveLength(3);
    expect(result.items.map(item => item.kind)).toEqual([
      'invitation',
      'org_application',
      'recruitment_applicant',
    ]);
    expect(result.permissions).toEqual({
      canReviewApplications: true,
      canManageInvitations: true,
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
