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
 * Invitation status lifecycle:
 *
 *   pending  → approved | rejected | expired
 *   approved → accepted | declined | expired
 *
 *   accepted (terminal — member was added)
 *   rejected (terminal — admin rejected member-sent invite)
 *   declined (terminal — invitee declined)
 *   expired  (terminal — TTL reached)
 *
 * Officer/admin-sent invites start at 'approved' (skip pending).
 * Member-sent invites start at 'pending' (admin must approve first).
 */
export enum InvitationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

/**
 * Invitation entity — tracks invitations to join an Organization or Alliance.
 *
 * Push-based counterpart to OrgApplication (pull-based).
 * Uses the same discriminator pattern (targetType / inviteeType) from the
 * Application entity for consistency.
 */
@Entity('invitations')
@Index(['organizationId', 'status'])
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ── target ──────────────────────────────────────────────────────

  /**
   * The organization being invited to.
   *
   * TODO(alliance): When inviting to an alliance, a separate allianceId
   * column or polymorphic lookup may be needed (same as OrgApplication).
   */
  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  // ── invitee ─────────────────────────────────────────────────────

  /**
   * The user being invited.
   *
   * TODO(alliance): When inviteeType='organization' this would store
   * an org ID. Same resolution as OrgApplication.applicantUserId.
   */
  @Column()
  @Index()
  inviteeUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'inviteeUserId' })
  invitee?: User;

  // ── inviter ─────────────────────────────────────────────────────

  @Column({ nullable: true })
  @Index()
  inviterId!: string | null;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'inviterId' })
  inviter?: User;

  /** Role of the inviter: 'officer', 'admin', or 'member' */
  @Column({ length: 20 })
  inviterRole!: string;

  // ── status & details ────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  @Index()
  status!: InvitationStatus;

  /** Optional message from the inviter */
  @Column({ type: 'text', nullable: true })
  message?: string;

  /** Secure token for accept/decline links (crypto.randomBytes) */
  @Column({ unique: true })
  token!: string;

  /** When the invitation expires */
  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  // ── timestamps ─────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Last time the invitation row was modified. Used by the invitation
   * spam guard to enforce a re-invite cooldown after an invitee declines
   * or an admin rejects a member-initiated invite.
   */
  @UpdateDateColumn()
  updatedAt!: Date;
}
