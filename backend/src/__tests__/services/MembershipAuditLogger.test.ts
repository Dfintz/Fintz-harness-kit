/**
 * MembershipAuditLogger — unit tests for the lifecycle transition events.
 *
 * The base DomainAuditLogger delegates to auditService.log; we mock it and
 * assert the category, action, actor, and resource for each new convenience
 * method.
 */

jest.mock('../../services/audit/AuditService', () => ({
  AuditCategory: { MEMBERSHIP: 'MEMBERSHIP' },
  auditService: { log: jest.fn() },
}));

import { auditService } from '../../services/audit/AuditService';
import {
  MembershipAuditAction,
  MembershipAuditLogger,
} from '../../services/organization/MembershipAuditLogger';

const mockLog = auditService.log as jest.Mock;

describe('MembershipAuditLogger', () => {
  let logger: MembershipAuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    MembershipAuditLogger.resetInstance();
    logger = MembershipAuditLogger.getInstance();
  });

  afterEach(() => {
    MembershipAuditLogger.resetInstance();
  });

  it('emits APPLICATION_APPROVED with the reviewer as actor and a membership resource', () => {
    logger.logApplicationReviewed('app-1', 'user-a', 'org-1', 'admin-1', 'approved');

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'MEMBERSHIP',
        action: MembershipAuditAction.APPLICATION_APPROVED,
        organizationId: 'org-1',
        userId: 'admin-1',
        resource: 'organization/org-1/membership/app-1',
      })
    );
  });

  it('emits APPLICATION_REJECTED for a rejection decision', () => {
    logger.logApplicationReviewed('app-2', 'user-b', 'org-1', 'admin-1', 'rejected');

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: MembershipAuditAction.APPLICATION_REJECTED })
    );
  });

  it('emits invitation lifecycle events with the actor and subject', () => {
    logger.logInvitationEvent(
      MembershipAuditAction.INVITATION_ACCEPTED,
      'inv-1',
      'user-c',
      'org-1',
      'user-c'
    );

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'MEMBERSHIP',
        action: MembershipAuditAction.INVITATION_ACCEPTED,
        organizationId: 'org-1',
        userId: 'user-c',
        resource: 'organization/org-1/membership/inv-1',
      })
    );
  });

  it('still emits INTAKE_VIEWED with the intake-queue resource', () => {
    logger.logIntakeViewed('org-1', 3, 'admin-1');

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: MembershipAuditAction.INTAKE_VIEWED,
        resource: 'organization/org-1/membership-intake',
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
