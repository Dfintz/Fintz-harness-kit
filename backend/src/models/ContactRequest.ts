import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { encryptionTransformer } from '../utils/encryptionTransformer';

import type { ContactRequestReply } from './ContactRequestReply';
import { Organization } from './Organization';
import { User } from './User';

/**
 * Contact request status
 */
export enum ContactRequestStatus {
  PENDING = 'pending',
  READ = 'read',
  REPLIED = 'replied',
  ARCHIVED = 'archived',
  SPAM = 'spam',
}

/**
 * Contact target type - organization or alliance
 */
export enum ContactTargetType {
  ORGANIZATION = 'organization',
  ALLIANCE = 'alliance',
}

/**
 * Message visibility — controls which org roles can see a contact request.
 *
 *  • all          — every org member can see the message (default)
 *  • leadership   — owner, admin, officer only
 *  • hr           — HR division
 *  • diplomacy    — Diplomacy division
 *  • recruitment  — Recruitment division
 *  • custom       — only the roles listed in `visibleToRoles`
 */
export enum MessageVisibility {
  ALL = 'all',
  LEADERSHIP = 'leadership',
  HR = 'hr',
  DIPLOMACY = 'diplomacy',
  RECRUITMENT = 'recruitment',
  CUSTOM = 'custom',
}

/**
 * ContactRequest entity
 *
 * Stores contact form submissions from the public organization directory.
 * Allows visitors to send messages to organizations or alliances they're interested in.
 */
@Entity('contact_requests')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['allianceId', 'status'])
@Index(['allianceId', 'createdAt'])
@Index(['targetType'])
@Index(['status'])
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Target type - organization or alliance
   */
  @Column({
    type: 'enum',
    enum: ContactTargetType,
    default: ContactTargetType.ORGANIZATION,
  })
  targetType!: ContactTargetType;

  @Column({ nullable: true })
  @Index()
  organizationId?: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  /**
   * Alliance/Federation ID (if targeting an alliance)
   */
  @Column({ nullable: true })
  @Index()
  allianceId?: string;

  /**
   * Authenticated sender's user ID (links to users table)
   */
  @Column({ nullable: true })
  @Index()
  senderUserId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderUserId' })
  senderUser?: User;

  /**
   * Sender's name
   */
  @Column({ type: 'varchar', length: 100 })
  senderName!: string;

  /**
   * Sender's email (optional when authenticated)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  senderEmail?: string;

  /**
   * Optional RSI handle
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  rsiHandle?: string;

  /**
   * Optional Discord username
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  discordUsername?: string;

  /**
   * Subject of the message
   * Encrypted at rest via AES-256-GCM
   */
  @Column({ type: 'text', transformer: encryptionTransformer })
  subject!: string;

  /**
   * Message content
   * Encrypted at rest via AES-256-GCM
   */
  @Column({ type: 'text', transformer: encryptionTransformer })
  message!: string;

  /**
   * Contact type - what they're interested in
   */
  @Column({ type: 'varchar', length: 50, default: 'general' })
  contactType!: string;

  /**
   * Current status of the request
   */
  @Column({
    type: 'enum',
    enum: ContactRequestStatus,
    default: ContactRequestStatus.PENDING,
  })
  status!: ContactRequestStatus;

  /**
   * Optional internal notes from org admins
   * Encrypted at rest via AES-256-GCM
   */
  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  internalNotes?: string;

  /**
   * ID of user who handled this request
   */
  @Column({ type: 'varchar', nullable: true })
  handledBy?: string;

  /**
   * When the request was handled
   */
  @Column({ type: 'timestamp', nullable: true })
  handledAt?: Date;

  /**
   * IP address of sender (for spam prevention)
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  senderIp?: string;

  /**
   * User agent of sender (for spam prevention)
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  // ── Visibility ────────────────────────────────────────────────────

  /**
   * Which org roles can view this message.
   * Defaults to 'all' (every org member).
   */
  @Column({
    type: 'enum',
    enum: MessageVisibility,
    default: MessageVisibility.ALL,
  })
  @Index()
  visibility!: MessageVisibility;

  /**
   * Custom role names that may view this message.
   * Only used when visibility = 'custom'.
   * Example: ['hr_lead', 'recruiter', 'diplomat']
   */
  @Column({ type: 'jsonb', nullable: true })
  visibleToRoles?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Replies to this contact request (conversation thread)
   */
  @OneToMany('ContactRequestReply', 'contactRequest')
  replies?: ContactRequestReply[];
}
