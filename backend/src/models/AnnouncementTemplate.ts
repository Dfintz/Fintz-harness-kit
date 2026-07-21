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

import { AnnouncementEmbedConfig } from './Announcement';
import { Organization } from './Organization';

/**
 * AnnouncementTemplate Entity
 *
 * Represents a reusable announcement template that can be used to quickly
 * create announcements. Templates can be organization-specific or global
 * (available to all organizations).
 *
 * Phase 4 Features:
 * - Template CRUD operations
 * - Organization-specific and global templates
 * - Platform Admin only for global templates
 */
@Entity('announcement_templates')
@Index(['organizationId'])
@Index(['isGlobal'])
@Index(['createdBy'])
@Index(['name'])
export class AnnouncementTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization ID - NULL for global templates
   */
  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  /**
   * Template name for identification
   */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /**
   * Default title for announcements created from this template
   */
  @Column({ type: 'varchar', length: 256, nullable: true })
  title?: string;

  /**
   * Template content - can include placeholders like {{variable}}
   */
  @Column({ type: 'text' })
  content!: string;

  /**
   * Embed configuration for Discord formatting
   */
  @Column('jsonb', { nullable: true })
  embedConfig?: AnnouncementEmbedConfig;

  /**
   * Whether this template is available globally to all organizations
   * Only Platform Admins can create/modify global templates
   */
  @Column({ type: 'boolean', default: false })
  isGlobal!: boolean;

  /**
   * User ID who created the template
   */
  @Column({ type: 'varchar' })
  createdBy!: string;

  /**
   * Username of creator (for display)
   */
  @Column({ type: 'varchar', nullable: true })
  createdByName?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Soft delete timestamp
   */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  /**
   * User ID who deleted the template
   */
  @Column({ type: 'varchar', nullable: true })
  deletedBy?: string;

  /**
   * Check if template is available to a specific organization
   */
  isAvailableTo(organizationId: string): boolean {
    // Global templates are available to everyone
    if (this.isGlobal) {
      return true;
    }
    // Organization-specific templates are only available to that org
    return this.organizationId === organizationId;
  }

  /**
   * Check if user can modify this template
   * Only the creator or Platform Admin can modify
   */
  canBeModifiedBy(userId: string, isPlatformAdmin: boolean): boolean {
    if (isPlatformAdmin) {
      return true;
    }
    // For global templates, only platform admins can modify
    if (this.isGlobal) {
      return false;
    }
    // For org templates, the creator can modify
    return this.createdBy === userId;
  }
}
