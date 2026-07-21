import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';
import { User } from './User';

/**
 * What the applicant is trying to join.
 */
export enum ApplicationTargetType {
  ORGANIZATION = 'organization',
  ALLIANCE = 'alliance',
  FEDERATION = 'federation',
}

/**
 * What kind of entity is applying.
 */
export enum ApplicantType {
  USER = 'user',
  ORGANIZATION = 'organization',
}

/**
 * Application status lifecycle:
 *   pending → approved | rejected | withdrawn
 *   approved (terminal — member was added)
 *   rejected (terminal — can re-apply later)
 *   withdrawn (terminal — applicant-initiated)
 */
export enum OrgApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

/** Canonical alias */
export { OrgApplicationStatus as ApplicationStatus };

/**
 * OrgApplication entity — tracks requests to join an Organization or Alliance.
 *
 * Unified model supporting two flows:
 *   1. User → Organization  (targetType=organization, applicantType=user)
 *   2. Organization → Alliance  (targetType=alliance, applicantType=organization)
 *
 * Discriminated by `targetType` (what is being joined) and `applicantType`
 * (who is applying). Existing columns `organizationId` and `applicantUserId`
 * are preserved as the physical FK columns.
 */
@Entity('org_applications')
@Index(['organizationId', 'status'])
export class OrgApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ── discriminators ─────────────────────────────────────────────

  @Column({
    type: 'varchar',
    length: 20,
    default: 'organization',
  })
  @Index()
  targetType!: ApplicationTargetType;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'user',
  })
  applicantType!: ApplicantType;

  // ── relationships ──────────────────────────────────────────────

  /**
   * The target entity ID.
   * Currently always stores an Organization FK.
   *
   * FUTURE(alliance): When targetType='alliance' this column would store an
   * alliance ID, but the FK constraint below points to Organization.
   * Options: nullable FK, separate allianceId column, or polymorphic lookup.
   */
  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  /**
   * The applicant entity ID.
   * Currently always stores a User FK.
   *
   * FUTURE(alliance): When applicantType='organization' this column would
   * store an org ID, but the FK constraint below points to User.
   * Same resolution options as organizationId above.
   */
  @Column()
  @Index()
  applicantUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicantUserId' })
  applicant?: User;

  // ── application details ────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: OrgApplicationStatus,
    default: OrgApplicationStatus.PENDING,
  })
  @Index()
  status!: OrgApplicationStatus;

  /** Optional message from the applicant */
  @Column({ type: 'text', nullable: true })
  message?: string;

  /** Structured responses to org-defined application questions (questionId → answer) */
  @Column({ type: 'jsonb', nullable: true })
  formResponses?: Record<string, string>;

  /** Where the application was submitted from */
  @Column({ type: 'varchar', length: 10, nullable: true })
  source?: 'web' | 'discord' | 'api';

  /** Organization ID of the applicant (for federation applications where applicantType='organization') */
  @Column({ type: 'varchar', nullable: true })
  applicantOrgId?: string;

  /** Denormalized organization name of the applicant */
  @Column({ type: 'varchar', length: 200, nullable: true })
  applicantOrgName?: string;

  // ── review fields ──────────────────────────────────────────────

  /** User who reviewed (approved / rejected) the application */
  @Column({ nullable: true })
  @Index()
  reviewedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer?: User;

  /** Optional note from the reviewer */
  @Column({ type: 'text', nullable: true })
  reviewNote?: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  // ── timestamps ─────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/** Canonical alias — use when referring to the unified entity */
export { OrgApplication as Application };
