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

import { Federation } from './Federation';

// ─── Types ────────────────────────────────────────────────────

export type FederationIntelClassification = 'open' | 'restricted' | 'secret';

export type FederationIntelStatus = 'draft' | 'pending_review' | 'published' | 'archived';

// ─── Entity ───────────────────────────────────────────────────

/**
 * FederationIntelEntry Entity
 *
 * Intel shared at federation level. Submitted by ambassadors with
 * 'intel' permission, reviewed/approved by council, and optionally
 * scoped to specific treaty partners via visibleToTreaties.
 *
 * Classification levels:
 *   - open: visible to all federation members
 *   - restricted: visible to council+ ambassadors only
 *   - secret: visible only to specified treaty partners
 */
@Entity('federation_intel_entries')
@Index('idx_fed_intel_federation', ['federationId'])
@Index('idx_fed_intel_status', ['federationId', 'status'])
@Index('idx_fed_intel_classification', ['federationId', 'classification'])
export class FederationIntelEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  federationId!: string;

  @ManyToOne(() => Federation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'federationId' })
  federation?: Federation;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  classification!: FederationIntelClassification;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: FederationIntelStatus;

  /** Ambassador who submitted this intel */
  @Column({ type: 'varchar' })
  submittedBy!: string;

  /** Denormalized submitter name */
  @Column({ type: 'varchar', length: 200, nullable: true })
  submittedByName!: string | null;

  /** Organization ID of the submitter */
  @Column({ type: 'varchar', nullable: true })
  submittedByOrgId!: string | null;

  /** User who approved/published (council member) */
  @Column({ type: 'varchar', nullable: true })
  approvedBy!: string | null;

  /** Tags for categorization */
  @Column({ type: 'jsonb', default: '[]' })
  tags!: string[];

  /** Treaty IDs that can see this entry when classification is 'secret' */
  @Column({ type: 'jsonb', default: '[]' })
  visibleToTreaties!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
