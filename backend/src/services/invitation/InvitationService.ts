import crypto from 'node:crypto';

import { In, MoreThan, Not, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Invitation, InvitationStatus } from '../../models/Invitation';
import { NotificationType } from '../../models/Notification';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { getRolePriority } from '../../utils/roleUtils';
import { NotificationService } from '../communication/notifications/NotificationService';
import {
  MembershipAuditAction,
  membershipAuditLogger,
} from '../organization/MembershipAuditLogger';
import { OrganizationMemberService } from '../organization/OrganizationMemberService';
import { INVITATION_TRANSITIONS, MembershipWorkflow } from '../shared/MembershipWorkflow';

// ── Constants ────────────────────────────────────────────────────────

/** Default invitation TTL: 7 days */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Max pending (non-terminal) invitations a single user can have per org. */
const MAX_PENDING_PER_INVITER = 10;

/**
 * Invitee spam guard: max active (non-terminal) invitations a single invitee
 * can receive globally across all organizations. Protects users from being
 * spammed by many different orgs at once.
 */
const MAX_PENDING_PER_INVITEE = 25;

/**
 * Invitee spam guard: cooldown window after an invitee declines an invitation
 * (or an admin rejects a member-initiated invite) before the same organization
 * may re-invite the same user. Protects users from being repeatedly re-invited
 * by an organization they've already turned down.
 */
const RE_INVITE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Terminal statuses — invitations in these states cannot transition further. */
export const INVITATION_TERMINAL_STATUSES = [
  InvitationStatus.ACCEPTED,
  InvitationStatus.REJECTED,
  InvitationStatus.DECLINED,
  InvitationStatus.EXPIRED,
];

/**
 * Minimum role priority that triggers auto-approve (skip pending → approved directly).
 * Officer and above (officer / senior_officer / admin / owner / founder) may invite without a
 * separate admin approval step; members and recruits produce a pending invitation. Derived from
 * the shared role hierarchy so new/aliased privileged roles stay in sync automatically.
 */
const AUTO_APPROVE_MIN_PRIORITY = getRolePriority('officer');

/**
 * Human-shareable invitation code settings.
 * Format: 8 uppercase alphanumeric chars from token digest.
 */
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_REGEX = /^[A-Z0-9]{8}$/;

// ── Service ─────────────────────────────────────────────────────────

export class InvitationService {
  private readonly invitationRepository: Repository<Invitation>;
  private readonly organizationRepository: Repository<Organization>;
  private readonly membershipRepository: Repository<OrganizationMembership>;
  private readonly userRepository: Repository<User>;
  private readonly memberService: OrganizationMemberService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.invitationRepository = AppDataSource.getRepository(Invitation);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.userRepository = AppDataSource.getRepository(User);
    this.memberService = new OrganizationMemberService();
    this.notificationService = new NotificationService();
  }

  // ────────────────────── Invite ─────────────────────────────────

  /**
   * Send an invitation to join an organization.
   *
   * Rules:
   *  - Organization must exist
   *  - Invitee must exist and not already be a member
   *  - No duplicate non-terminal invitation for same org + invitee
   *  - If inviterRole is officer/admin/owner → auto-approve (APPROVED)
   *  - If inviterRole is member → PENDING (needs admin approval)
   */
  async invite(
    orgId: string,
    inviteeUserId: string,
    inviterId: string,
    inviterRole: string,
    message?: string
  ): Promise<Invitation> {
    // Validate org exists
    const org = await this.organizationRepository.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    // Validate invitee exists
    const invitee = await this.userRepository.findOne({ where: { id: inviteeUserId } });
    if (!invitee) {
      throw new NotFoundError('User not found');
    }

    // Check invitee is not already a member
    const existingMember = await this.membershipRepository.findOne({
      where: { organizationId: orgId, userId: inviteeUserId, isActive: true },
    });
    if (existingMember) {
      throw new ConflictError('User is already a member of this organization');
    }

    // B-01 Fix: Verify inviter is a member of the organization
    const inviterMember = await this.membershipRepository.findOne({
      where: { organizationId: orgId, userId: inviterId, isActive: true },
    });
    if (!inviterMember) {
      throw new ForbiddenError('You must be a member of this organization to send invitations');
    }

    // Duplicate check: same org + invitee, non-terminal status
    const existing = await this.invitationRepository.findOne({
      where: {
        organizationId: orgId,
        inviteeUserId,
        status: Not(In(INVITATION_TERMINAL_STATUSES)),
      },
    });
    if (existing) {
      throw new ConflictError('An active invitation already exists for this user');
    }

    // Invitee spam guard: re-invite cooldown.
    // If the invitee declined (or admin rejected) an invitation from this org
    // within RE_INVITE_COOLDOWN_MS, block re-invitation. The invitee has already
    // signalled they're not interested; allowing immediate re-invite is spam.
    const cooldownThreshold = new Date(Date.now() - RE_INVITE_COOLDOWN_MS);
    const recentRejection = await this.invitationRepository.findOne({
      where: {
        organizationId: orgId,
        inviteeUserId,
        status: In([InvitationStatus.DECLINED, InvitationStatus.REJECTED]),
        updatedAt: MoreThan(cooldownThreshold),
      },
      order: { updatedAt: 'DESC' },
    });
    if (recentRejection) {
      const cooldownDays = Math.ceil(RE_INVITE_COOLDOWN_MS / (24 * 60 * 60 * 1000));
      throw new ValidationError(
        `This user recently declined an invitation from your organization. ` +
          `Please wait ${cooldownDays} days before inviting them again.`
      );
    }

    // Invitee spam guard: cap total active invitations a user can receive
    // globally. Without this, many different orgs can each send a single
    // invitation and overwhelm a user with notifications/decisions.
    const inviteePendingCount = await this.invitationRepository.count({
      where: {
        inviteeUserId,
        status: Not(In(INVITATION_TERMINAL_STATUSES)),
      },
    });
    if (inviteePendingCount >= MAX_PENDING_PER_INVITEE) {
      throw new ValidationError(
        `This user has reached the maximum number of active invitations ` +
          `(${MAX_PENDING_PER_INVITEE}). They must resolve existing invitations ` +
          'before receiving new ones.'
      );
    }

    // Spam guard: limit pending invitations per inviter per org
    const pendingCount = await this.invitationRepository.count({
      where: {
        organizationId: orgId,
        inviterId,
        status: Not(In(INVITATION_TERMINAL_STATUSES)),
      },
    });
    if (pendingCount >= MAX_PENDING_PER_INVITER) {
      throw new ValidationError(
        `You have too many pending invitations (max ${MAX_PENDING_PER_INVITER}). ` +
          'Please wait for existing invitations to be resolved before sending more.'
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);

    // Determine initial status based on inviter role. Officer-and-above (by role priority)
    // auto-approve; members/recruits produce a pending invitation needing admin approval.
    const autoApprove = getRolePriority(inviterRole) >= AUTO_APPROVE_MIN_PRIORITY;
    const initialStatus = autoApprove ? InvitationStatus.APPROVED : InvitationStatus.PENDING;

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

    logger.info(`Invitation created: ${saved.id}`, {
      organizationId: orgId,
      inviteeUserId,
      inviterId,
      inviterRole,
      status: saved.status,
      autoApproved: autoApprove,
    });

    membershipAuditLogger.logInvitationEvent(
      MembershipAuditAction.INVITATION_SENT,
      saved.id,
      inviteeUserId,
      orgId,
      inviterId
    );
    // If the invitation is immediately actionable (auto-approved), notify the invitee so they
    // can accept and join. Member-sent invites are notified later, on admin approval.
    if (saved.status === InvitationStatus.APPROVED) {
      await this.notifyInviteeOfApproval(saved, org.name);
    }
    return saved;
  }

  // ────────────────────── Admin Approve (member-sent invite) ─────

  /**
   * Admin approves a member-initiated invitation.
   * Transitions: pending → approved
   */
  async approveInvitation(
    invitationId: string,
    orgId: string,
    adminId: string
  ): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, organizationId: orgId },
      relations: ['organization'],
    });
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    MembershipWorkflow.validateTransition(
      INVITATION_TRANSITIONS,
      invitation.status,
      'approved',
      'admin'
    );

    invitation.status = InvitationStatus.APPROVED;

    const saved = await this.invitationRepository.save(invitation);

    logger.info(`Invitation ${invitationId} approved by admin`, {
      organizationId: orgId,
      adminId,
    });

    membershipAuditLogger.logInvitationEvent(
      MembershipAuditAction.INVITATION_APPROVED,
      invitationId,
      invitation.inviteeUserId,
      orgId,
      adminId
    );

    // Invitation is now actionable — notify the invitee so they can accept and join.
    await this.notifyInviteeOfApproval(saved, invitation.organization?.name);

    return saved;
  }

  // ───────────────────── Notify Invitee ─────────────────

  /**
   * Notify the invitee that an invitation is actionable (approved) so they can accept and join.
   * Best-effort: NotificationService.create swallows its own errors, so a notification failure
   * never blocks the invitation transition. Fired when an invite auto-approves and when an admin
   * approves a member-sent invite.
   */
  private async notifyInviteeOfApproval(
    invitation: Invitation,
    organizationName = 'an organization'
  ): Promise<void> {
    await this.notificationService.create({
      userId: invitation.inviteeUserId,
      type: NotificationType.INFO,
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

  // ────────────────────── Admin Reject (member-sent invite) ──────

  /**
   * Admin rejects a member-initiated invitation.
   * Transitions: pending → rejected
   */
  async rejectInvitation(
    invitationId: string,
    orgId: string,
    adminId: string
  ): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    MembershipWorkflow.validateTransition(
      INVITATION_TRANSITIONS,
      invitation.status,
      'rejected',
      'admin'
    );

    invitation.status = InvitationStatus.REJECTED;

    const saved = await this.invitationRepository.save(invitation);

    logger.info(`Invitation ${invitationId} rejected by admin`, {
      organizationId: orgId,
      adminId,
    });

    membershipAuditLogger.logInvitationEvent(
      MembershipAuditAction.INVITATION_REJECTED,
      invitationId,
      invitation.inviteeUserId,
      orgId,
      adminId
    );

    return saved;
  }

  // ────────────────────── Accept ─────────────────────────────────

  /**
   * Resolve a user-entered invitation code to the canonical invitation token.
   * Codes are derived from token material and scoped by invitee identity.
   */
  private async resolveTokenFromInviteCode(code: string, userId: string): Promise<string> {
    const normalized = code.trim().toUpperCase();
    if (!INVITE_CODE_REGEX.test(normalized)) {
      throw new ValidationError('Invalid invitation code format');
    }

    const invitations = await this.invitationRepository.find({
      where: {
        inviteeUserId: userId,
        status: Not(In([InvitationStatus.EXPIRED])),
      },
      select: ['id', 'token'],
    });

    const match = invitations.find(inv => this.getInviteCode(inv.token) === normalized);
    if (!match) {
      throw new NotFoundError('Invitation not found');
    }

    return match.token;
  }

  /**
   * Derive a short human-shareable invite code from an invitation token.
   */
  private getInviteCode(token: string): string {
    return token.slice(0, INVITE_CODE_LENGTH).toUpperCase();
  }

  /**
   * Invitee accepts an invitation via secure token.
   * Transitions: approved → accepted
   * On accept: calls OrganizationMemberService.addMember()
   */
  async acceptByToken(token: string, userId: string): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({ where: { token } });
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    // M-01: Verify the authenticated user is the intended invitee
    if (invitation.inviteeUserId !== userId) {
      throw new ForbiddenError('This invitation was not sent to you');
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new ValidationError('This invitation has expired');
    }

    MembershipWorkflow.validateTransition(
      INVITATION_TRANSITIONS,
      invitation.status,
      'accepted',
      'member'
    );

    // H2 FIX: Cross-tenant security verification (defense-in-depth)
    // Verify the invitation's organization exists and is valid before accepting
    const org = await this.organizationRepository.findOne({
      where: { id: invitation.organizationId },
    });
    if (!org) {
      throw new NotFoundError('Organization no longer exists');
    }

    const previousStatus = invitation.status;
    invitation.status = InvitationStatus.ACCEPTED;

    try {
      // Add member first — invitation is only persisted as ACCEPTED if this succeeds.
      // Roll back in-memory status on failure so it's never saved in an inconsistent state.
      await this.memberService.addMember(
        invitation.organizationId,
        invitation.inviteeUserId,
        'member',
        undefined,
        undefined,
        undefined,
        { acquisitionSource: 'invitation', acquisitionRefId: invitation.id }
      );
    } catch (error: unknown) {
      // Roll back in-memory status
      invitation.status = previousStatus;
      logger.error(`Failed to add member while accepting invitation ${invitation.id}`, {
        organizationId: invitation.organizationId,
        inviteeUserId: invitation.inviteeUserId,
        error,
      });
      throw error;
    }

    const saved = await this.invitationRepository.save(invitation);

    logger.info(`Invitation ${invitation.id} accepted`, {
      organizationId: invitation.organizationId,
      inviteeUserId: invitation.inviteeUserId,
    });

    membershipAuditLogger.logInvitationEvent(
      MembershipAuditAction.INVITATION_ACCEPTED,
      invitation.id,
      invitation.inviteeUserId,
      invitation.organizationId,
      userId
    );

    return saved;
  }

  /**
   * Invitee accepts an invitation via short invite code.
   * Code resolution is invitee-scoped to prevent cross-user access.
   */
  async acceptByCode(code: string, userId: string): Promise<Invitation> {
    const token = await this.resolveTokenFromInviteCode(code, userId);
    return this.acceptByToken(token, userId);
  }

  // ────────────────────── Decline ────────────────────────────────

  /**
   * Invitee declines an invitation via secure token.
   * Transitions: approved → declined
   */
  async declineByToken(token: string, userId: string): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({ where: { token } });
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    // M-01: Verify the authenticated user is the intended invitee
    if (invitation.inviteeUserId !== userId) {
      throw new ForbiddenError('This invitation was not sent to you');
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new ValidationError('This invitation has expired');
    }

    MembershipWorkflow.validateTransition(
      INVITATION_TRANSITIONS,
      invitation.status,
      'declined',
      'member'
    );

    invitation.status = InvitationStatus.DECLINED;

    const saved = await this.invitationRepository.save(invitation);

    logger.info(`Invitation ${invitation.id} declined`, {
      organizationId: invitation.organizationId,
      inviteeUserId: invitation.inviteeUserId,
    });

    membershipAuditLogger.logInvitationEvent(
      MembershipAuditAction.INVITATION_DECLINED,
      invitation.id,
      invitation.inviteeUserId,
      invitation.organizationId,
      userId
    );

    return saved;
  }

  /**
   * Invitee declines an invitation via short invite code.
   * Code resolution is invitee-scoped to prevent cross-user access.
   */
  async declineByCode(code: string, userId: string): Promise<Invitation> {
    const token = await this.resolveTokenFromInviteCode(code, userId);
    return this.declineByToken(token, userId);
  }

  // ────────────────────── Expire Stale ──────────────────────────

  /**
   * System: expire invitations past their TTL.
   * Called by background job.
   * Returns count of expired invitations.
   */
  async expireStale(): Promise<number> {
    // M-07: Use bulk UPDATE instead of loading all stale invitations into memory
    const result = await this.invitationRepository
      .createQueryBuilder()
      .update(Invitation)
      .set({ status: InvitationStatus.EXPIRED })
      .where('status IN (:...statuses)', {
        statuses: [InvitationStatus.PENDING, InvitationStatus.APPROVED],
      })
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();

    const affected = result.affected ?? 0;
    if (affected > 0) {
      logger.info(`Expired ${affected} stale invitations`);
    }

    return affected;
  }

  // ────────────────────── Queries ───────────────────────────────

  /**
   * Get paginated invitations for an org (admin view).
   * Supports status filter.
   * Returns InvitationDto shape with populated display fields.
   */
  async getInvitationsForOrg(
    orgId: string,
    options?: { status?: InvitationStatus; page?: number; limit?: number }
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId: orgId };
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

    // Map to InvitationDto — strip PII and token (admin list should not expose tokens)
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
      // Populated display fields (PII-safe)
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

  /**
   * Get invitations received by the authenticated user.
   * Returns InvitationDto shape with populated org display fields.
   *
   * NOTE: We project the organization relation to a minimal shape
   * to avoid leaking internal org settings (e.g., IP whitelist, GDPR config).
   */
  async getMyInvitations(userId: string): Promise<Record<string, unknown>[]> {
    const invitations = await this.invitationRepository.find({
      where: {
        inviteeUserId: userId,
        status: Not(In([InvitationStatus.EXPIRED])),
      },
      order: { createdAt: 'DESC' },
      relations: ['organization'],
    });

    // Map to InvitationDto — strip internal org fields, include token for accept/decline
    return invitations.map(inv => ({
      id: inv.id,
      organizationId: inv.organizationId,
      inviteeUserId: inv.inviteeUserId,
      inviterId: inv.inviterId,
      inviterRole: inv.inviterRole,
      status: inv.status,
      message: inv.message,
      token: inv.token, // Token is safe here — only the invitee sees their own invitations
      inviteCode: this.getInviteCode(inv.token),
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      // Populated display fields (PII-safe)
      organizationName: inv.organization?.name,
    }));
  }
}
