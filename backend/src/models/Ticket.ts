import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

/**
 * Ticket Category - Defines the type of ticket
 */
export enum TicketCategory {
  HR = 'hr',
  RECRUITMENT = 'recruitment',
  DIPLOMACY = 'diplomacy',
  GENERAL = 'general',
  SUPPORT = 'support',
}

/**
 * Ticket Priority
 */
export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Ticket Status
 */
export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  AWAITING_RESPONSE = 'awaiting_response',
  ON_HOLD = 'on_hold',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

/**
 * Ticket Recipient Type - Dynamic routing for who the ticket is directed to.
 *
 * Role-based routing:
 *   ORG_LEADERSHIP   — Org owners & admins
 *   ORG_OFFICERS     — Internal org officers
 *   TEAM_LEADER      — Team leaders (optionally scoped to a specific team via recipientId)
 *   ALLIANCE_COUNCIL — Federation / alliance council & leaders
 *
 * Function-based routing:
 *   HR_DEPARTMENT    — HR function
 *   RECRUITMENT      — Recruitment function
 *   DIPLOMACY        — Diplomacy function
 *
 * Direct routing:
 *   SPECIFIC_USER    — A named user (recipientId + recipientName required)
 *   PLATFORM_ADMIN   — Platform-level administrators
 */
export enum TicketRecipientType {
  // Role-based
  ORG_LEADERSHIP = 'org_leadership',
  ORG_OFFICERS = 'org_officers',
  TEAM_LEADER = 'team_leader',
  ALLIANCE_COUNCIL = 'alliance_council',
  // Function-based
  HR_DEPARTMENT = 'hr_department',
  RECRUITMENT = 'recruitment',
  DIPLOMACY = 'diplomacy',
  // Direct
  SPECIFIC_USER = 'specific_user',
  PLATFORM_ADMIN = 'platform_admin',
}

/**
 * Ticket Message/Comment
 */
export interface TicketMessage {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  isInternal: boolean; // Staff-only notes
  attachments?: string[];
}

/**
 * Ticket Assignment History
 */
export interface TicketAssignment {
  assigneeId: string;
  assigneeName: string;
  assignedAt: Date;
  assignedBy: string;
}

/**
 * Discord Integration Settings for Tickets
 */
export interface TicketDiscordSettings {
  enabled: boolean;
  channelId?: string; // Discord channel where ticket messages are synced
  threadId?: string; // Discord thread for this specific ticket
  notifyOnUpdate: boolean; // Send notifications to Discord
  roleId?: string; // Role to ping for new tickets
  webhookUrl?: string; // Webhook for sending messages
}

/**
 * Ticket Entity
 *
 * Represents a support ticket for HR, Recruitment, Diplomacy, or general support.
 * Integrates with Discord for creating and managing tickets through the bot.
 *
 * MULTI-TENANCY: This entity is tenant-scoped - each ticket belongs to an organization.
 */
@Entity('tickets')
@Index(['category', 'status'])
@Index(['creatorId'])
@Index(['assigneeId'])
@Index(['recipientId'])
@Index(['organizationId', 'category'])
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
export class Ticket extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Ticket Reference Number (human-readable)
  @Column({ unique: true })
  @Index()
  ticketNumber: string;

  // Core Ticket Information
  @Column()
  subject: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: TicketCategory,
    default: TicketCategory.GENERAL,
  })
  category: TicketCategory;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  // Creator Information
  @Column()
  creatorId: string;

  @Column()
  creatorName: string;

  @Column({ nullable: true })
  creatorDiscordId?: string;

  @Column({ nullable: true })
  creatorEmail?: string;

  // Recipient (who the ticket is addressed to)
  @Column({
    type: 'enum',
    enum: TicketRecipientType,
    nullable: true,
  })
  recipientType?: TicketRecipientType;

  @Column({ nullable: true })
  recipientId?: string;

  @Column({ nullable: true })
  recipientName?: string;

  // Assignment
  @Column({ nullable: true })
  assigneeId?: string;

  @Column({ nullable: true })
  assigneeName?: string;

  @Column('simple-json', { default: '[]' })
  assignmentHistory: TicketAssignment[];

  // Messages/Conversation
  @Column('simple-json', { default: '[]' })
  messages: TicketMessage[];

  // Discord Integration
  @Column('simple-json', { nullable: true })
  discordSettings?: TicketDiscordSettings;

  @Column({ nullable: true })
  discordChannelId?: string; // Quick access to Discord channel

  @Column({ nullable: true })
  discordThreadId?: string; // Quick access to Discord thread

  // Related Entities
  @Column({ nullable: true })
  relatedRecruitmentId?: string; // Link to recruitment activity

  @Column({ nullable: true })
  relatedDiplomacyId?: string; // Link to diplomacy relation

  @Column({ nullable: true })
  relatedApplicationId?: string; // Link to application

  // Tags and Labels
  @Column('simple-array', { default: '' })
  tags: string[];

  // Resolution
  @Column('text', { nullable: true })
  resolution?: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ nullable: true })
  resolvedBy?: string;

  // Feedback
  @Column({ type: 'int', nullable: true })
  satisfactionRating?: number; // 1-5 rating

  @Column('text', { nullable: true })
  feedback?: string;

  // SLA Tracking
  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ default: false })
  slaBreached: boolean;

  @Column({ type: 'timestamp', nullable: true })
  firstResponseAt?: Date;

  // Audit
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  // Computed properties
  get isOpen(): boolean {
    return (
      this.status === TicketStatus.OPEN ||
      this.status === TicketStatus.IN_PROGRESS ||
      this.status === TicketStatus.AWAITING_RESPONSE
    );
  }

  get hasDiscordIntegration(): boolean {
    return !!(this.discordChannelId || this.discordThreadId);
  }

  get responseTimeMs(): number | null {
    if (!this.firstResponseAt) {
      return null;
    }
    return this.firstResponseAt.getTime() - this.createdAt.getTime();
  }
}
