import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';

/**
 * Guild-to-Organization Mapping
 *
 * Maps Discord guild IDs to organization IDs for proper multi-tenant resolution.
 * Supports:
 * - One-to-one mapping (single guild -> single org)
 * - Many-to-one mapping (multiple guilds -> single org)
 * - Primary guild designation for multi-guild organizations
 *
 * Use Cases:
 * - Resolve organization from Discord guild ID in moderation events
 * - Support organizations spanning multiple Discord servers
 * - Auto-sync when organization connects Discord integration
 */
@Entity('guild_organizations')
@Index(['guildId'], { unique: true })
@Index(['organizationId'])
@Index(['isPrimary'])
export class GuildOrganization {
  /**
   * Discord Guild (server) ID - Primary key
   * Each guild can only be mapped to one organization
   */
  @PrimaryColumn({ type: 'varchar', length: 20 })
  guildId!: string;

  /**
   * Organization ID that owns/manages this guild
   * An organization can have multiple guilds
   */
  @Column({ type: 'varchar', length: 255 })
  organizationId!: string;

  /**
   * Organization relationship (lazy loaded)
   */
  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  /**
   * Guild name (cached for display purposes)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  guildName?: string;

  /**
   * Whether this is the primary/main guild for the organization
   * Used when an org has multiple Discord servers
   */
  @Column({ type: 'boolean', default: true })
  isPrimary!: boolean;

  /**
   * Whether this mapping is currently active
   * Inactive mappings are kept for historical purposes
   */
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Who created this mapping (user ID)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy?: string;

  /**
   * Additional metadata (integration settings, sync config, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * When this mapping was deactivated (if applicable)
   */
  @Column({ type: 'timestamp', nullable: true })
  deactivatedAt?: Date;

  /**
   * Who deactivated this mapping
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  deactivatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if mapping is currently usable
   */
  isUsable(): boolean {
    return this.isActive;
  }

  /**
   * Deactivate this mapping
   */
  deactivate(userId: string): void {
    this.isActive = false;
    this.deactivatedAt = new Date();
    this.deactivatedBy = userId;
  }

  /**
   * Reactivate this mapping
   */
  reactivate(): void {
    this.isActive = true;
    this.deactivatedAt = undefined;
    this.deactivatedBy = undefined;
  }
}
