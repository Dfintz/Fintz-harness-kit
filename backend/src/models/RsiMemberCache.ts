import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

/**
 * RSI Member Cache Entity
 *
 * Caches RSI organization member data to reduce API calls and
 * provide consistent role sync information.
 *
 * Phase 1: RSI Role Sync System - Data Fetching and Caching
 */
@Entity('rsi_member_cache')
@Unique('UQ_rsi_member_cache_org_handle', ['organizationId', 'rsiHandle'])
@Index('IDX_rsi_member_cache_org_sid', ['rsiOrgSid'])
@Index('IDX_rsi_member_cache_cached_at', ['cachedAt'])
@Index('IDX_rsi_member_cache_org_id', ['organizationId'])
export class RsiMemberCache {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The internal organization ID this cache belongs to
   */
  @Column('varchar')
  organizationId!: string;

  /**
   * RSI Organization Spectrum ID (SID)
   * The unique identifier used on the RSI website
   */
  @Column({ type: 'varchar', length: 50 })
  rsiOrgSid!: string;

  /**
   * RSI Handle of the member
   * Unique identifier for the player on RSI
   */
  @Column({ type: 'varchar', length: 100 })
  rsiHandle!: string;

  /**
   * RSI Rank name within the organization
   * The human-readable rank title
   */
  @Column({ type: 'varchar', length: 50 })
  rsiRank!: string;

  /**
   * RSI Rank order (numeric level)
   * Used for sorting ranks - higher typically means higher rank
   * RSI uses star ratings (1-5)
   */
  @Column({ type: 'int', nullable: true })
  rsiRankOrder?: number;

  /**
   * Whether this member is an affiliate of the organization
   * Affiliates have different membership status than main members
   */
  @Column({ type: 'boolean', default: false })
  isAffiliate!: boolean;

  /**
   * RSI Display Name (optional)
   * May differ from handle
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName?: string;

  /**
   * Additional member metadata from RSI
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * Timestamp when this data was cached
   */
  @CreateDateColumn()
  cachedAt!: Date;
}
