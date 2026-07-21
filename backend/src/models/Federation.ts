import type {
  FederationGovernance,
  FederationSettings,
  FederationStatus,
  FederationTreaty,
  SharedResource,
} from '@sc-fleet-manager/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FederationMember } from './FederationMember';
import { FederationProposal } from './FederationProposal';

/**
 * Federation Entity
 *
 * A multi-organization alliance with governance rules, shared resources,
 * treaties, and a public directory listing.  Previously stored in an
 * in-memory Map — now persisted to PostgreSQL.
 *
 * JSON columns: governance, sharedResources, treaties
 * (complex nested structures that are always read/written with the parent)
 */
@Entity('federations')
@Index('idx_federation_founder_org', ['founderOrgId'])
@Index('idx_federation_status', ['status'])
@Index('idx_federation_public_active', ['isPublic', 'status'])
export class Federation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  /** User ID of the founder */
  @Column({ type: 'varchar' })
  founderId!: string;

  /** Organization ID of the founding org */
  @Column({ type: 'varchar' })
  founderOrgId!: string;

  /** Governance configuration (voting system, thresholds, etc.) */
  @Column({ type: 'jsonb', default: '{}' })
  governance!: FederationGovernance;

  /** Shared resources contributed by members */
  @Column({ type: 'jsonb', default: '[]' })
  sharedResources!: SharedResource[];

  /** Treaties between member organizations */
  @Column({ type: 'jsonb', default: '[]' })
  treaties!: FederationTreaty[];

  @Column({ type: 'varchar', length: 20, default: 'forming' })
  status!: FederationStatus;

  @Column({ type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  tags!: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  discordUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  websiteUrl!: string | null;

  /** Next scheduled review date for the federation agreement */
  @Column({ type: 'timestamp', nullable: true })
  reviewDate!: Date | null;

  /** Expiry date for the federation agreement */
  @Column({ type: 'timestamp', nullable: true })
  expiryDate!: Date | null;

  /** Whether the federation agreement auto-renews on expiry */
  @Column({ type: 'boolean', default: false })
  autoRenew!: boolean;

  /** Per-federation feature toggles (titles & badges, federation fleets, dynamic teams) */
  @Column({ type: 'jsonb', default: '{}' })
  settings!: FederationSettings;

  /** Federation → Members (one-to-many) */
  @OneToMany(() => FederationMember, member => member.federation)
  members?: FederationMember[];

  /** Federation → Proposals (one-to-many) */
  @OneToMany(() => FederationProposal, proposal => proposal.federation)
  proposals?: FederationProposal[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
