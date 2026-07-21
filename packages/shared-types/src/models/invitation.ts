/**
 * Invitation types — shared between frontend and backend.
 *
 * Invitations are push-based (someone sends an invite to join).
 * Supports two flows:
 *   1. User invited → Organization (officer/admin/member invites a user)
 *   2. Organization invited → Alliance (federation admin invites an org)
 */

// ─── Status Enum ─────────────────────────────────────────────────────

export enum InvitationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

// ─── Transition Map ──────────────────────────────────────────────────

/**
 * Valid status transitions for invitations.
 * Mirrors INVITATION_TRANSITIONS in backend MembershipWorkflow.
 *
 * Flow:
 *   pending → approved (admin approves member-sent invite)
 *           → rejected (admin rejects member-sent invite)
 *           → expired  (TTL reached)
 *   approved → accepted (invitee accepts)
 *           → declined (invitee declines)
 *           → expired  (TTL reached)
 *   accepted / rejected / declined / expired → terminal
 *
 * Officer-sent invites skip to 'approved' status immediately.
 */
export const INVITATION_STATUS_TRANSITIONS: Record<InvitationStatus, InvitationStatus[]> = {
  [InvitationStatus.PENDING]: [
    InvitationStatus.APPROVED,
    InvitationStatus.REJECTED,
    InvitationStatus.EXPIRED,
  ],
  [InvitationStatus.APPROVED]: [
    InvitationStatus.ACCEPTED,
    InvitationStatus.DECLINED,
    InvitationStatus.EXPIRED,
  ],
  [InvitationStatus.ACCEPTED]: [], // terminal — member was added
  [InvitationStatus.REJECTED]: [], // terminal
  [InvitationStatus.DECLINED]: [], // terminal
  [InvitationStatus.EXPIRED]: [], // terminal
};

// ─── DTO ─────────────────────────────────────────────────────────────

/**
 * InvitationDto — Matches the backend Invitation entity shape.
 *
 * The backend returns `organizationId` / `inviteeUserId` / `inviterId`
 * directly from the entity columns.  Populated display fields
 * (`inviteeUsername`, `inviterUsername`, `organizationName`) are added
 * by the service-layer DTO mapper when relations are loaded.
 */
export interface InvitationDto {
  id: string;

  /** Organization the invitee is being invited to */
  organizationId: string;
  /** User ID of the invitee */
  inviteeUserId: string;

  /** ID of the user who sent the invitation */
  inviterId: string | null;
  /** Role of the inviter within the org */
  inviterRole: string;

  status: InvitationStatus;
  message?: string;

  /**
   * Secure token for accept/decline links.
   * Only present in the invitee's own invitation list (`getMyInvitations`).
   * Never exposed to inviters or org admins.
   */
  token?: string;
  /**
   * Human-shareable short code derived from token material.
   * Only present in the invitee's own invitation list.
   */
  inviteCode?: string;
  /** When the invitation expires (ISO 8601) */
  expiresAt: string;
  /** When the invitation was created (ISO 8601) */
  createdAt: string;

  // ── Populated display fields (from relations, PII-safe) ──
  /** Invitee username (from User relation) */
  inviteeUsername?: string;
  /** Inviter username (from User relation) */
  inviterUsername?: string;
  /** Organization name (from Organization relation) */
  organizationName?: string;
}
