"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipIntakeService = void 0;
const Invitation_1 = require("../../models/Invitation");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const OrgApplication_1 = require("../../models/OrgApplication");
const apiErrors_1 = require("../../utils/apiErrors");
const InvitationService_1 = require("../invitation/InvitationService");
const MembershipAuditLogger_1 = require("./MembershipAuditLogger");
const OrganizationPermissionService_1 = require("./OrganizationPermissionService");
const OrgApplicationService_1 = require("./OrgApplicationService");
const RecruitmentService_1 = require("./recruitment/RecruitmentService");
const PER_SOURCE_LIMIT = 100;
class MembershipIntakeService {
    orgApplicationService;
    invitationService;
    recruitmentService;
    permissionService;
    constructor() {
        this.orgApplicationService = new OrgApplicationService_1.OrgApplicationService();
        this.invitationService = new InvitationService_1.InvitationService();
        this.recruitmentService = RecruitmentService_1.RecruitmentService.getInstance();
        this.permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    }
    async getInbox(userId, organizationId) {
        const permissions = await this.resolvePermissions(userId, organizationId);
        if (!permissions.canReviewApplications && !permissions.canManageInvitations) {
            throw new apiErrors_1.ForbiddenError('You do not have permission to view membership intake');
        }
        const [applicationItems, recruitmentItems, invitationItems] = await Promise.all([
            permissions.canReviewApplications ? this.collectApplications(organizationId) : [],
            permissions.canReviewApplications ? this.collectRecruitmentApplicants(organizationId) : [],
            permissions.canManageInvitations ? this.collectInvitations(organizationId) : [],
        ]);
        const items = [...applicationItems, ...recruitmentItems, ...invitationItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        MembershipAuditLogger_1.membershipAuditLogger.logIntakeViewed(organizationId, items.length, userId);
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
    async resolvePermissions(userId, organizationId) {
        const [reviewResult, manageResult] = await Promise.all([
            this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.RECRUITMENT, OrganizationPermission_1.PermissionAction.APPROVE),
            this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.MEMBERS, OrganizationPermission_1.PermissionAction.MANAGE),
        ]);
        const canManageInvitations = manageResult.allowed;
        return {
            canReviewApplications: reviewResult.allowed || canManageInvitations,
            canManageInvitations,
        };
    }
    async collectApplications(organizationId) {
        const { data } = await this.orgApplicationService.getApplicationsForOrg(organizationId, {
            status: OrgApplication_1.OrgApplicationStatus.PENDING,
            page: 1,
            limit: PER_SOURCE_LIMIT,
        });
        return data.map(app => ({
            kind: 'org_application',
            id: app.id,
            status: app.status,
            displayName: app.applicant?.username,
            subjectUserId: app.applicantUserId,
            createdAt: toIso(app.createdAt),
            message: app.message,
            source: app.source,
        }));
    }
    async collectInvitations(organizationId) {
        const { data } = await this.invitationService.getInvitationsForOrg(organizationId, {
            status: Invitation_1.InvitationStatus.PENDING,
            page: 1,
            limit: PER_SOURCE_LIMIT,
        });
        return data.map(row => ({
            kind: 'invitation',
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
    async collectRecruitmentApplicants(organizationId) {
        const applicants = await this.recruitmentService.getPendingApplicantsForOrg(organizationId);
        return applicants.map(applicant => ({
            kind: 'recruitment_applicant',
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
exports.MembershipIntakeService = MembershipIntakeService;
function toIso(value) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
//# sourceMappingURL=MembershipIntakeService.js.map