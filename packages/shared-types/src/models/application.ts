/**
 * Unified Application types — shared between frontend and backend.
 *
 * Supports two application flows:
 *   1. User → Organization (user applies to join an org)
 *   2. Organization → Alliance (org applies to join an alliance/federation)
 *
 * Discriminated by `targetType` and `applicantType`.
 */

// ─── Discriminator Enums ─────────────────────────────────────────────

/** What the applicant is trying to join. */
export enum ApplicationTargetType {
  ORGANIZATION = 'organization',
  ALLIANCE = 'alliance',
  FEDERATION = 'federation',
}

/** What kind of entity is applying. */
export enum ApplicantType {
  USER = 'user',
  ORGANIZATION = 'organization',
}

// ─── Status Enum ─────────────────────────────────────────────────────

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

// ─── Transition Map ──────────────────────────────────────────────────

/**
 * Valid status transitions for applications (both user→org and org→alliance).
 * Mirrors APPLICATION_TRANSITIONS in backend MembershipWorkflow.
 */
export const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.PENDING]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.APPROVED]: [], // terminal — member was added
  [ApplicationStatus.REJECTED]: [], // terminal — can re-apply later
  [ApplicationStatus.WITHDRAWN]: [], // terminal — can re-apply later
};

// ─── Application Question Types ──────────────────────────────────────

/** Question field types for adaptive application forms */
export type ApplicationQuestionType = 'short' | 'paragraph' | 'select' | 'checkbox' | 'rules';

/** Application mode determined by org settings */
export type ApplicationMode = 'simple' | 'custom' | 'discord';

/** Source of an application submission */
export type ApplicationSource = 'web' | 'discord' | 'api';

/**
 * A single question in an organization's adaptive application form.
 * Stored as JSON in Organization.settings.applicationQuestions.
 */
export interface ApplicationQuestion {
  id: string;
  label: string;
  /**
   * Stable semantic identifier used by consumers that need canonical mapping.
   * Example keys: rsiHandle, timezone, message, availablePlaytimes.
   * Optional for backward compatibility with existing saved questions.
   */
  fieldKey?: string;
  type: ApplicationQuestionType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
  order: number;
}

/**
 * Response shape for GET /organizations/:orgId/application-mode
 */
export interface ApplicationModeResponse {
  mode: ApplicationMode;
  discordInviteUrl?: string;
  questions?: ApplicationQuestion[];
}

// ─── DTO ─────────────────────────────────────────────────────────────

export interface ApplicationDto {
  id: string;

  /** Discriminator: what is being applied to */
  targetType: ApplicationTargetType;
  /** Discriminator: who is applying */
  applicantType: ApplicantType;

  /**
   * The ID of the target entity.
   * - When targetType = 'organization' → organizationId
   * - When targetType = 'alliance' → allianceId
   *
   * Also exposed as `organizationId` for backward compat when targetType = 'organization'.
   */
  targetId: string;

  /**
   * The ID of the applicant entity.
   * - When applicantType = 'user' → userId
   * - When applicantType = 'organization' → organizationId
   *
   * Also exposed as `applicantUserId` for backward compat when applicantType = 'user'.
   */
  applicantId: string;

  status: ApplicationStatus;
  message?: string;

  /** Structured responses to org-defined application questions */
  formResponses?: Record<string, string>;

  /** Where the application was submitted from */
  source?: ApplicationSource;

  // Review fields
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // ── Backward-compat aliases (present when applicable) ──
  /** @deprecated Use targetId instead */
  organizationId?: string;
  /** @deprecated Use applicantId instead */
  applicantUserId?: string;
}

// ─── Backward-Compat Re-exports ──────────────────────────────────────

/** @deprecated Use ApplicationStatus instead */
export const OrgApplicationStatus = ApplicationStatus;
/** @deprecated Use ApplicationStatus instead */
export type OrgApplicationStatus = ApplicationStatus;

/** @deprecated Use APPLICATION_STATUS_TRANSITIONS instead */
export const ORG_APPLICATION_STATUS_TRANSITIONS = APPLICATION_STATUS_TRANSITIONS;

/** @deprecated Use ApplicationDto instead */
export type OrgApplicationDto = ApplicationDto;
