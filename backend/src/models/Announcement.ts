import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

/**
 * Announcement target type - where to send the announcement
 */
export enum AnnouncementTargetType {
  SINGLE = 'single',
  MULTIPLE = 'multiple',
  ALL = 'all',
  ALLIANCE = 'alliance', // Phase 3: Alliance-wide targeting
}

/**
 * Announcement status
 */
export enum AnnouncementStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Discord embed configuration
 */
export interface AnnouncementEmbedConfig {
  color?: string; // Hex color code (e.g., '#0099FF')
  thumbnailUrl?: string; // Thumbnail image URL
  imageUrl?: string; // Main image URL
  footerText?: string; // Footer text
  footerTextTemplate?: string; // Footer text with template variables (e.g., "Announcement from {organization.name}")
  footerIconUrl?: string; // Footer icon URL
  authorName?: string; // Author name
  authorNameTemplate?: string; // Author name with template variables
  authorIconUrl?: string; // Author icon URL
  authorUrl?: string; // Author URL
  timestamp?: boolean; // Show timestamp
  fields?: AnnouncementEmbedField[];
}

/**
 * Discord embed field
 */
export interface AnnouncementEmbedField {
  name: string;
  nameTemplate?: string; // Field name with template variables (e.g., "{organization.name} Updates")
  value: string;
  valueTemplate?: string; // Field value with template variables
  inline?: boolean;
}

/**
 * Delivery result for tracking send status
 */
export interface AnnouncementDeliveryResult {
  targetId: string; // Discord server/channel ID
  success: boolean;
  error?: string;
  messageId?: string; // Discord message ID if successful
  deliveredAt?: Date;
}

/**
 * Announcement Entity
 *
 * Represents an announcement that can be sent to Discord servers.
 * Supports drafts, scheduling, and tracking delivery status.
 *
 * MULTI-TENANCY: This entity is tenant-scoped - each announcement belongs to an organization.
 */
@Entity('announcements')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['status', 'scheduledAt'])
@Index(['createdBy'])
export class Announcement extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 256 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column('simple-json', { nullable: true })
  embedConfig?: AnnouncementEmbedConfig;

  @Column({
    type: 'varchar',
    length: 20,
    default: AnnouncementTargetType.SINGLE,
  })
  targetType!: AnnouncementTargetType;

  @Column('simple-json', { nullable: true })
  targetIds?: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: AnnouncementStatus.DRAFT,
  })
  status!: AnnouncementStatus;

  @Column()
  createdBy!: string;

  @Column({ nullable: true })
  createdByName?: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  pinnedAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  pinnedBy?: string;

  @Column('simple-json', { nullable: true })
  deliveryResults?: AnnouncementDeliveryResult[];

  /** When set, announcement is scoped to a federation */
  @Column({ type: 'uuid', nullable: true })
  federationId?: string;

  /** Federation broadcast audience: all-members | council | public */
  @Column({ type: 'varchar', length: 30, nullable: true, default: 'all-members' })
  targetAudience?: string;

  @CreateDateColumn()
  createdAt!: Date;

  // Computed properties
  get isPending(): boolean {
    return this.status === AnnouncementStatus.DRAFT || this.status === AnnouncementStatus.SCHEDULED;
  }

  get isDelivered(): boolean {
    return this.status === AnnouncementStatus.SENT;
  }

  get totalTargets(): number {
    return this.targetIds?.length || 0;
  }

  get successfulDeliveries(): number {
    return this.deliveryResults?.filter(r => r.success).length || 0;
  }

  get failedDeliveries(): number {
    return this.deliveryResults?.filter(r => !r.success).length || 0;
  }

  get isPinned(): boolean {
    return this.pinnedAt !== null && this.pinnedAt !== undefined;
  }
}
