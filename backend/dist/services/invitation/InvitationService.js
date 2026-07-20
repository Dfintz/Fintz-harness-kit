"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationService = exports.INVITATION_TERMINAL_STATUSES = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Invitation_1 = require("../../models/Invitation");
const Notification_1 = require("../../models/Notification");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const NotificationService_1 = require("../communication/notifications/NotificationService");
const MembershipAuditLogger_1 = require("../organization/MembershipAuditLogger");
const OrganizationMemberService_1 = require("../organization/OrganizationMemberService");
const MembershipWorkflow_1 = require("../shared/MembershipWorkflow");
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING_PER_INVITER = 10;
const MAX_PENDING_PER_INVITEE = 25;
const RE_INVITE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
exports.INVITATION_TERMINAL_STATUSES = [
    Invitation_1.InvitationStatus.ACCEPTED,
    Invitation_1.InvitationStatus.REJECTED,
    Invitation_1.InvitationStatus.DECLINED,
    Invitation_1.InvitationStatus.EXPIRED,
];
const AUTO_APPROVE_MIN_PRIORITY = (0, roleUtils_1.getRolePriority)('officer');
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_REGEX = /^[A-Z0-9]{8}$/;
class InvitationService {
    invitationRepository;
    organizationRepository;
    membershipRepository;
    userRepository;
    memberService;
    notificationService;
    constructor() {
        this.invitationRepository = data_source_1.AppDataSource.getRepository(Invitation_1.Invitation);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.memberService = new OrganizationMemberService_1.OrganizationMemberService();
        this.notificationService = new NotificationService_1.NotificationService();
    }
    async invite(orgId, inviteeUserId, inviterId, inviterRole, message) {
        const org = await this.organizationRepository.findOne({ where: { id: orgId } });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const invitee = await this.userRepository.findOne({ where: { id: inviteeUserId } });
        if (!invitee) {
            throw new apiErrors_1.NotFoundError('User not found');
        }
        const existingMember = await this.membershipRepository.findOne({
            where: { organizationId: orgId, userId: inviteeUserId, isActive: true },
        });
        if (existingMember) {
            throw new apiErrors_1.ConflictError('User is already a member of this organization');
        }
        const inviterMember = await this.membershipRepository.findOne({
            where: { organizationId: orgId, userId: inviterId, isActive: true },
        });
        if (!inviterMember) {
            throw new apiErrors_1.ForbiddenError('You must be a member of this organization to send invitations');
        }
        const existing = await this.invitationRepository.findOne({
            where: {
                organizationId: orgId,
                inviteeUserId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)(exports.INVITATION_TERMINAL_STATUSES)),
            },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('An active invitation already exists for this user');
        }
        const cooldownThreshold = new Date(Date.now() - RE_INVITE_COOLDOWN_MS);
        const recentRejection = await this.invitationRepository.findOne({
            where: {
                organizationId: orgId,
                inviteeUserId,
                status: (0, typeorm_1.In)([Invitation_1.InvitationStatus.DECLINED, Invitation_1.InvitationStatus.REJECTED]),
                updatedAt: (0, typeorm_1.MoreThan)(cooldownThreshold),
            },
            order: { updatedAt: 'DESC' },
        });
        if (recentRejection) {
            const cooldownDays = Math.ceil(RE_INVITE_COOLDOWN_MS / (24 * 60 * 60 * 1000));
            throw new apiErrors_1.ValidationError(`This user recently declined an invitation from your organization. ` +
                `Please wait ${cooldownDays} days before inviting them again.`);
        }
        const inviteePendingCount = await this.invitationRepository.count({
            where: {
                inviteeUserId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)(exports.INVITATION_TERMINAL_STATUSES)),
            },
        });
        if (inviteePendingCount >= MAX_PENDING_PER_INVITEE) {
            throw new apiErrors_1.ValidationError(`This user has reached the maximum number of active invitations ` +
                `(${MAX_PENDING_PER_INVITEE}). They must resolve existing invitations ` +
                'before receiving new ones.');
        }
        const pendingCount = await this.invitationRepository.count({
            where: {
                organizationId: orgId,
                inviterId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)(exports.INVITATION_TERMINAL_STATUSES)),
            },
        });
        if (pendingCount >= MAX_PENDING_PER_INVITER) {
            throw new apiErrors_1.ValidationError(`You have too many pending invitations (max ${MAX_PENDING_PER_INVITER}). ` +
                'Please wait for existing invitations to be resolved before sending more.');
        }
        const token = node_crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
        const autoApprove = (0, roleUtils_1.getRolePriority)(inviterRole) >= AUTO_APPROVE_MIN_PRIORITY;
        const initialStatus = autoApprove ? Invitation_1.InvitationStatus.APPROVED : Invitation_1.InvitationStatus.PENDING;
        const invitation = this.invitationRepository.create({
            organizationId: orgId,
            inviteeUserId,
            inviterId,
            inviterRole,
            status: initialStatus,
            message: message ?? undefined,
            token,
            expiresAt,
        });
        const saved = await this.invitationRepository.save(invitation);
        logger_1.logger.info(`Invitation created: ${saved.id}`, {
            organizationId: orgId,
            inviteeUserId,
            inviterId,
            inviterRole,
            status: saved.status,
            autoApproved: autoApprove,
        });
        MembershipAuditLogger_1.membershipAuditLogger.logInvitationEvent(MembershipAuditLogger_1.MembershipAuditAction.INVITATION_SENT, saved.id, inviteeUserId, orgId, inviterId);
        if (saved.status === Invitation_1.InvitationStatus.APPROVED) {
            await this.notifyInviteeOfApproval(saved, org.name);
        }
        return saved;
    }
    async approveInvitation(invitationId, orgId, adminId) {
        const invitation = await this.invitationRepository.findOne({
            where: { id: invitationId, organizationId: orgId },
            relations: ['organization'],
        });
        if (!invitation) {
            throw new apiErrors_1.NotFoundError('Invitation not found');
        }
        MembershipWorkflow_1.MembershipWorkflow.validateTransition(MembershipWorkflow_1.INVITATION_TRANSITIONS, invitation.status, 'approved', 'admin');
        invitation.status = Invitation_1.InvitationStatus.APPROVED;
        const saved = await this.invitationRepository.save(invitation);
        logger_1.logger.info(`Invitation ${invitationId} approved by admin`, {
            organizationId: orgId,
            adminId,
        });
        MembershipAuditLogger_1.membershipAuditLogger.logInvitationEvent(MembershipAuditLogger_1.MembershipAuditAction.INVITATION_APPROVED, invitationId, invitation.inviteeUserId, orgId, adminId);
        await this.notifyInviteeOfApproval(saved, invitation.organization?.name);
        return saved;
    }
    async notifyInviteeOfApproval(invitation, organizationName = 'an organization') {
        await this.notificationService.create({
            userId: invitation.inviteeUserId,
            type: Notification_1.NotificationType.INFO,
            title: 'Organization invitation',
            message: `You've been invited to join ${organizationName}. Review it in your inbox to accept.`,
            senderId: invitation.inviterId ?? undefined,
            data: {
                kind: 'organization_invitation',
                organizationId: invitation.organizationId,
                invitationId: invitation.id,
                actionUrl: '/inbox?tab=invitations',
            },
        });
    }
    async rejectInvitation(invitationId, orgId, adminId) {
        const invitation = await this.invitationRepository.findOne({
            where: { id: invitationId, organizationId: orgId },
        });
        if (!invitation) {
            throw new apiErrors_1.NotFoundError('Invitation not found');
        }
        MembershipWorkflow_1.MembershipWorkflow.validateTransition(MembershipWorkflow_1.INVITATION_TRANSITIONS, invitation.status, 'rejected', 'admin');
        invitation.status = Invitation_1.InvitationStatus.REJECTED;
        const saved = await this.invitationRepository.save(invitation);
        logger_1.logger.info(`Invitation ${invitationId} rejected by admin`, {
            organizationId: orgId,
            adminId,
        });
        MembershipAuditLogger_1.membershipAuditLogger.logInvitationEvent(MembershipAuditLogger_1.MembershipAuditAction.INVITATION_REJECTED, invitationId, invitation.inviteeUserId, orgId, adminId);
        return saved;
    }
    async resolveTokenFromInviteCode(code, userId) {
        const normalized = code.trim().toUpperCase();
        if (!INVITE_CODE_REGEX.test(normalized)) {
            throw new apiErrors_1.ValidationError('Invalid invitation code format');
        }
        const invitations = await this.invitationRepository.find({
            where: {
                inviteeUserId: userId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)([Invitation_1.InvitationStatus.EXPIRED])),
            },
            select: ['id', 'token'],
        });
        const match = invitations.find(inv => this.getInviteCode(inv.token) === normalized);
        if (!match) {
            throw new apiErrors_1.NotFoundError('Invitation not found');
        }
        return match.token;
    }
    getInviteCode(token) {
        return token.slice(0, INVITE_CODE_LENGTH).toUpperCase();
    }
    async acceptByToken(token, userId) {
        const invitation = await this.invitationRepository.findOne({ where: { token } });
        if (!invitation) {
            throw new apiErrors_1.NotFoundError('Invitation not found');
        }
        if (invitation.inviteeUserId !== userId) {
            throw new apiErrors_1.ForbiddenError('This invitation was not sent to you');
        }
        if (invitation.expiresAt < new Date()) {
            invitation.status = Invitation_1.InvitationStatus.EXPIRED;
            await this.invitationRepository.save(invitation);
            throw new apiErrors_1.ValidationError('This invitation has expired');
        }
        MembershipWorkflow_1.MembershipWorkflow.validateTransition(MembershipWorkflow_1.INVITATION_TRANSITIONS, invitation.status, 'accepted', 'member');
        const org = await this.organizationRepository.findOne({
            where: { id: invitation.organizationId },
        });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization no longer exists');
        }
        const previousStatus = invitation.status;
        invitation.status = Invitation_1.InvitationStatus.ACCEPTED;
        try {
            await this.memberService.addMember(invitation.organizationId, invitation.inviteeUserId, 'member', undefined, undefined, undefined, { acquisitionSource: 'invitation', acquisitionRefId: invitation.id });
        }
        catch (error) {
            invitation.status = previousStatus;
            logger_1.logger.error(`Failed to add member while accepting invitation ${invitation.id}`, {
                organizationId: invitation.organizationId,
                inviteeUserId: invitation.inviteeUserId,
                error,
            });
            throw error;
        }
        const saved = await this.invitationRepository.save(invitation);
        logger_1.logger.info(`Invitation ${invitation.id} accepted`, {
            organizationId: invitation.organizationId,
            inviteeUserId: invitation.inviteeUserId,
        });
        MembershipAuditLogger_1.membershipAuditLogger.logInvitationEvent(MembershipAuditLogger_1.MembershipAuditAction.INVITATION_ACCEPTED, invitation.id, invitation.inviteeUserId, invitation.organizationId, userId);
        return saved;
    }
    async acceptByCode(code, userId) {
        const token = await this.resolveTokenFromInviteCode(code, userId);
        return this.acceptByToken(token, userId);
    }
    async declineByToken(token, userId) {
        const invitation = await this.invitationRepository.findOne({ where: { token } });
        if (!invitation) {
            throw new apiErrors_1.NotFoundError('Invitation not found');
        }
        if (invitation.inviteeUserId !== userId) {
            throw new apiErrors_1.ForbiddenError('This invitation was not sent to you');
        }
        if (invitation.expiresAt < new Date()) {
            invitation.status = Invitation_1.InvitationStatus.EXPIRED;
            await this.invitationRepository.save(invitation);
            throw new apiErrors_1.ValidationError('This invitation has expired');
        }
        MembershipWorkflow_1.MembershipWorkflow.validateTransition(MembershipWorkflow_1.INVITATION_TRANSITIONS, invitation.status, 'declined', 'member');
        invitation.status = Invitation_1.InvitationStatus.DECLINED;
        const saved = await this.invitationRepository.save(invitation);
        logger_1.logger.info(`Invitation ${invitation.id} declined`, {
            organizationId: invitation.organizationId,
            inviteeUserId: invitation.inviteeUserId,
        });
        MembershipAuditLogger_1.membershipAuditLogger.logInvitationEvent(MembershipAuditLogger_1.MembershipAuditAction.INVITATION_DECLINED, invitation.id, invitation.inviteeUserId, invitation.organizationId, userId);
        return saved;
    }
    async declineByCode(code, userId) {
        const token = await this.resolveTokenFromInviteCode(code, userId);
        return this.declineByToken(token, userId);
    }
    async expireStale() {
        const result = await this.invitationRepository
            .createQueryBuilder()
            .update(Invitation_1.Invitation)
            .set({ status: Invitation_1.InvitationStatus.EXPIRED })
            .where('status IN (:...statuses)', {
            statuses: [Invitation_1.InvitationStatus.PENDING, Invitation_1.InvitationStatus.APPROVED],
        })
            .andWhere('expiresAt < :now', { now: new Date() })
            .execute();
        const affected = result.affected ?? 0;
        if (affected > 0) {
            logger_1.logger.info(`Expired ${affected} stale invitations`);
        }
        return affected;
    }
    async getInvitationsForOrg(orgId, options) {
        const page = options?.page ?? 1;
        const limit = Math.min(options?.limit ?? 20, 100);
        const skip = (page - 1) * limit;
        const where = { organizationId: orgId };
        if (options?.status) {
            where.status = options.status;
        }
        const [rawData, total] = await this.invitationRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
            relations: ['invitee', 'inviter'],
        });
        const data = rawData.map(inv => ({
            id: inv.id,
            organizationId: inv.organizationId,
            inviteeUserId: inv.inviteeUserId,
            inviterId: inv.inviterId,
            inviterRole: inv.inviterRole,
            status: inv.status,
            message: inv.message,
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt,
            inviteeUsername: inv.invitee?.username,
            inviterUsername: inv.inviter?.username,
        }));
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getMyInvitations(userId) {
        const invitations = await this.invitationRepository.find({
            where: {
                inviteeUserId: userId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)([Invitation_1.InvitationStatus.EXPIRED])),
            },
            order: { createdAt: 'DESC' },
            relations: ['organization'],
        });
        return invitations.map(inv => ({
            id: inv.id,
            organizationId: inv.organizationId,
            inviteeUserId: inv.inviteeUserId,
            inviterId: inv.inviterId,
            inviterRole: inv.inviterRole,
            status: inv.status,
            message: inv.message,
            token: inv.token,
            inviteCode: this.getInviteCode(inv.token),
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt,
            organizationName: inv.organization?.name,
        }));
    }
}
exports.InvitationService = InvitationService;
//# sourceMappingURL=InvitationService.js.map