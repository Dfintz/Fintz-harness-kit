/**
 * Membership Intake types — unified "membership inbox" contract shared between
 * frontend and backend.
 *
 * The inbox consolidates the three member-acquisition queues into one normalized
 * list so a single surface can handle invites AND applications:
 *   1. Organization join applications (OrgApplication)
 *   2. Organization invitations (Invitation)
 *   3. Recruitment-post applicants (Activity.applications)
 *
 * Items are a discriminated union on `kind`. Permission semantics remain
 * per-source (least privilege) — see `MembershipIntakePermissions`.
 */

/** Discriminator for a membership intake item. */
export type MembershipIntakeKind = 'org_application' | 'invitation' | 'recruitment_applicant';

/** Fields common to every intake item, regardless of source. */
export interface MembershipIntakeItemBase {
  kind: MembershipIntakeKind;
  /** Source-entity identifier (application id, invitation id, or applicationId). */
  id: string;
  /** Source-specific status string (e.g. 'pending'). */
  status: string;
  /** Best-effort display name of the person (applicant or invitee), PII-safe. */
  displayName?: string;
  /** Internal user id of the subject person, when known. */
  subjectUserId?: string;
  /** ISO timestamp the item was created / applied / invited. */
  createdAt: string;
  /** Optional free-text message attached to the item. */
  message?: string;
}

/** A pending organization join application. */
export interface OrgApplicationIntakeItem extends MembershipIntakeItemBase {
  kind: 'org_application';
  /** Channel the application was submitted from ('web' | 'discord' | 'api'). */
  source?: string;
}

/** A pending organization invitation. */
export interface InvitationIntakeItem extends MembershipIntakeItemBase {
  kind: 'invitation';
  /** Display name of the inviter, PII-safe. */
  inviterName?: string;
  /** ISO timestamp the invitation expires. */
  expiresAt?: string;
}

/** A pending applicant on a recruitment post. */
export interface RecruitmentApplicantIntakeItem extends MembershipIntakeItemBase {
  kind: 'recruitment_applicant';
  /** Recruitment post (Activity) the applicant applied to. */
  recruitmentId: string;
  /** Recruitment post title for display. */
  recruitmentTitle: string;
  /** Applicant RSI handle, when provided. */
  rsiHandle?: string;
}

/** Discriminated union of all intake item kinds. */
export type MembershipIntakeItem =
  | OrgApplicationIntakeItem
  | InvitationIntakeItem
  | RecruitmentApplicantIntakeItem;

/** Per-source pending counts for the inbox. */
export interface MembershipIntakeCounts {
  orgApplications: number;
  invitations: number;
  recruitmentApplicants: number;
  total: number;
}

/**
 * Which intake sources the viewer is permitted to see/handle.
 * The inbox is one surface, but visibility stays per-source (least privilege):
 * applications + recruitment applicants require RECRUITMENT.APPROVE; invitations
 * require MEMBERS.MANAGE.
 */
export interface MembershipIntakePermissions {
  canReviewApplications: boolean;
  canManageInvitations: boolean;
}

/** Response shape for GET /api/v2/organizations/:orgId/membership/inbox. */
export interface MembershipInboxResponse {
  items: MembershipIntakeItem[];
  counts: MembershipIntakeCounts;
  permissions: MembershipIntakePermissions;
}
