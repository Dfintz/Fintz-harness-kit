import type { FederationVote, ProposalStatus, ProposalType } from '@sc-fleet-manager/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';


import { Federation } from './Federation';

/**
 * FederationProposal Entity
 *
 * Represents a governance proposal that federation members can vote on.
 * Votes are stored as a JSON array column — they are always read/written
 * together with the proposal and don't need independent querying.
 */
@Entity('federation_proposals')
@Index('idx_fed_proposal_federation', ['federationId'])
@Index('idx_fed_proposal_status', ['status'])
@Index('idx_fed_proposal_federation_status', ['federationId', 'status'])
export class FederationProposal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  federationId!: string;

  @ManyToOne(() => Federation, federation => federation.proposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'federationId' })
  federation?: Federation;

  @Column({ type: 'varchar', length: 30 })
  type!: ProposalType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Display name of the proposer */
  @Column({ type: 'varchar', length: 200 })
  proposedBy!: string;

  /** Organization ID of the proposer */
  @Column({ type: 'uuid' })
  proposedByOrg!: string;

  /** Votes cast — stored as JSON array */
  @Column({ type: 'jsonb', default: '[]' })
  votes!: FederationVote[];

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: ProposalStatus;

  /** Required approval percentage (0-100) */
  @Column({ type: 'int' })
  requiredApproval!: number;

  /** Proposal-specific metadata (e.g. targetOrgId for remove_member) */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  votingEndsAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
