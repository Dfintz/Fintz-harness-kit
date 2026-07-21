import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Organization } from './Organization';
import { RsiSyncAuditLog } from './RsiSyncAuditLog';

/**
 * RSI Sync Member Snapshot
 *
 * Stores the full member list from each sync run, enabling delta tracking
 * between successive syncs. Each row represents one RSI member seen during
 * a specific sync operation.
 */
@Entity('rsi_sync_member_snapshots')
@Index('IDX_rsi_sync_snapshots_sync_log', ['syncLogId'])
@Index('IDX_rsi_sync_snapshots_org_id', ['organizationId'])
@Index('IDX_rsi_sync_snapshots_org_handle', ['organizationId', 'rsiHandle'])
@Index('IDX_rsi_sync_snapshots_sync_handle', ['syncLogId', 'rsiHandle'])
export class RsiSyncMemberSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Reference to the sync audit log entry that produced this snapshot */
  @Column('uuid')
  syncLogId!: string;

  @ManyToOne(() => RsiSyncAuditLog, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'syncLogId' })
  syncLog!: RsiSyncAuditLog;

  /** Organization this snapshot belongs to */
  @Column('uuid')
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /** RSI handle of the member */
  @Column({ type: 'varchar', length: 100 })
  rsiHandle!: string;

  /** Display name on RSI */
  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName?: string;

  /** Rank within the RSI organization */
  @Column({ type: 'varchar', length: 50, nullable: true })
  rank?: string;

  /** Star rank (1-5) */
  @Column({ type: 'int', default: 0 })
  stars!: number;

  /** Whether this is the member's main organization */
  @Column({ default: false })
  isMain!: boolean;

  /** Whether this is an affiliate membership */
  @Column({ default: false })
  isAffiliate!: boolean;

  /** Whether the member is hidden in the org listing */
  @Column({ default: false })
  isHidden!: boolean;

  /** Whether the member's profile is redacted */
  @Column({ default: false })
  isRedacted!: boolean;

  /** Avatar URL */
  @Column({ type: 'text', nullable: true })
  avatar?: string;

  /** Enlisted date */
  @Column({ type: 'varchar', length: 50, nullable: true })
  enlisted?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
