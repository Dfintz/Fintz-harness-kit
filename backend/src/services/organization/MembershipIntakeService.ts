import type {
  MembershipInboxResponse,
  MembershipIntakeItem,
  MembershipIntakePermissions,
} from '@sc-fleet-manager/shared-types';

import { InvitationStatus } from '../../models/Invitation';
import { PermissionAction, ResourceType } from '../../models/OrganizationPermission';
import { OrgApplicationStatus } from '../../models/OrgApplication';
import { ForbiddenError } from '../../utils/apiErrors';
import { InvitationService } from '../invitation/InvitationService';

import { membershipAuditLogger } from './MembershipAuditLogger';
import { OrganizationPermissionService } from './OrganizationPermissionService';
import { OrgApplicationService } from './OrgApplicationService';
import { RecruitmentService } from './recruitment/RecruitmentService';

/** Per-source fetch cap for the intake seam (cross-source pagination is a follow-up). */
const PER_SOURCE_LIMIT = 100;

/**
 * Minimal shape of an invitation row returned by
 * InvitationService.getInvitationsForOrg (which returns Record<string, unknown>[]).
 * Declared here so we can map at the service boundary without `any`.
 */
interface InvitationRow {
  id: string;
  status: string;
  inviteeUserId?: string;
  inviteeUsername?: string;
  inviterUsername?: string;
  message?: string;
  createdAt: Date | string;
  expiresAt?: Date | string;
}

/**
 * MembershipIntakeService
 *
 * Read-only aggregation seam that unifies the three member-acquisition queues —
 * organization join applications, invitations, and recruitment-post applicants —
 * into a single normalized "membership inbox".
 *
 * Ownership (Gate 3 — Tell-Don't-Ask): this service NEVER touches OrgApplication,
 * Invitation, or Activity.applications directly. It orchestrates each owner
 * service's public list method and normalizes the results.
 *
 * Permissions (Gate 4b — least privilege): the inbox is one surface, but
 * visibility stays per-source. Applications + recruitment applicants require
 * RECRUITMENT.APPROVE; invitations require MEMBERS.MANAGE. A viewer with neither
 * is forbidden.
 */
export class MembershipIntakeService {
  private readonly orgApplicationService: OrgApplicationService;
  private readonly invitationService: InvitationService;
  private readonly recruitmentService: RecruitmentService;
  private readonly permissionService: OrganizationPermissionService;

  constructor() {
    this.orgApplicationService = new OrgApplicationService();
    this.invitationService = new InvitationService();
    this.recruitmentService = RecruitmentService.getInstance();
    this.permissionService = new OrganizationPermissionService();
  }

  /**
   * Build the unified pending membership intake inbox for an organization.
   *
   * @throws ForbiddenError when the viewer holds neither intake permission.
   */
  async getInbox(userId: string, organizationId: string): Promise<MembershipInboxResponse> {
    const permissions = await this.resolvePermissions(userId, organizationId);

    if (!permissions.canReviewApplications && !permissions.canManageInvitations) {
      throw new ForbiddenError('You do not have permission to view membership intake');
    }

    const [applicationItems, recruitmentItems, invitationItems] = await Promise.all([
      permissions.canReviewApplications ? this.collectApplications(organizationId) : [],
      permissions.canReviewApplications ? this.collectRecruitmentApplicants(organizationId) : [],
      permissions.canManageInvitations ? this.collectInvitations(organizationId) : [],
    ]);

    const items = [...applicationItems, ...recruitmentItems, ...invitationItems].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

    // Audit the access (counts only — never PII). Non-fatal by design.
    membershipAuditLogger.logIntakeViewed(organizationId, items.length, userId);

    return {
      items,
      counts: {
        orgApplications: applicationItems.length,
        invitations: invitationItems.length,
        recruitmentApplicants: recruitmentItems.length,
        total: items.length,
      },
      permissions,
    };
  }

  /** Resolve the viewer's per-source intake permissions. */
  private async resolvePermissions(
    userId: string,
    organizationId: string
  ): Promise<MembershipIntakePermissions> {
    const [reviewResult, manageResult] = await Promise.all([
      this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.RECRUITMENT,
        PermissionAction.APPROVE
      ),
      this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.MEMBERS,
        PermissionAction.MANAGE
      ),
    ]);

    // Backward compatibility: some organizations rely on members-manage roles
    // as their reviewer cohort for application queues.
    const canManageInvitations = manageResult.allowed;
    return {
      canReviewApplications: reviewResult.allowed || canManageInvitations,
      canManageInvitations,
    };
  }

  /** Pending organization join applications, normalized. */
  private async collectApplications(organizationId: string): Promise<MembershipIntakeItem[]> {
    const { data } = await this.orgApplicationService.getApplicationsForOrg(organizationId, {
      status: OrgApplicationStatus.PENDING,
      page: 1,
      limit: PER_SOURCE_LIMIT,
    });

    return data.map(app => ({
      kind: 'org_application' as const,
      id: app.id,
      status: app.status,
      displayName: app.applicant?.username,
      subjectUserId: app.applicantUserId,
      createdAt: toIso(app.createdAt),
      message: app.message,
      source: app.source,
    }));
  }

  /** Pending invitations, normalized. */
  private async collectInvitations(organizationId: string): Promise<MembershipIntakeItem[]> {
    const { data } = await this.invitationService.getInvitationsForOrg(organizationId, {
      status: InvitationStatus.PENDING,
      page: 1,
      limit: PER_SOURCE_LIMIT,
    });

    // Boundary cast: the owner returns a loose Record shape it constructs itself.
    return (data as unknown as InvitationRow[]).map(row => ({
      kind: 'invitation' as const,
      id: row.id,
      status: row.status,
      displayName: row.inviteeUsername,
      subjectUserId: row.inviteeUserId,
      createdAt: toIso(row.createdAt),
      message: row.message,
      inviterName: row.inviterUsername,
      expiresAt: row.expiresAt ? toIso(row.expiresAt) : undefined,
    }));
  }

  /** Pending recruitment-post applicants, normalized. */
  private async collectRecruitmentApplicants(
    organizationId: string
  ): Promise<MembershipIntakeItem[]> {
    const applicants = await this.recruitmentService.getPendingApplicantsForOrg(organizationId);

    return applicants.map(applicant => ({
      kind: 'recruitment_applicant' as const,
      id: applicant.applicationId,
      status: applicant.status,
      displayName: applicant.applicantName,
      subjectUserId: applicant.applicantId,
      createdAt: toIso(applicant.appliedAt),
      recruitmentId: applicant.recruitmentId,
      recruitmentTitle: applicant.recruitmentTitle,
      rsiHandle: applicant.rsiHandle,
    }));
  }
}

/** Normalize a Date or ISO string to an ISO string. */
function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
