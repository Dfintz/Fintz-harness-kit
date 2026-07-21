import type { FederationAssociationType, FederationMemberStatus, FederationRole } from '@sc-fleet-manager/shared-types';
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
 * FederationMember Entity
 *
 * Represents an organization's membership in a federation.
 * Each organization may belong to multiple federations.
 *
 * Unique constraint on (federationId, organizationId) prevents
 * duplicate memberships.
 */
@Entity('federation_members')
@Index('idx_fed_member_federation', ['federationId'])
@Index('idx_fed_member_org', ['organizationId'])
@Index('idx_fed_member_unique', ['federationId', 'organizationId'], { unique: true })
export class FederationMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  federationId!: string;

  @ManyToOne(() => Federation, federation => federation.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'federationId' })
  federation?: Federation;

  /** Organization ID (not a FK to keep entity decoupled) */
  @Column({ type: 'varchar' })
  organizationId!: string;

  /** Denormalized org name for display without extra joins */
  @Column({ type: 'varchar', length: 200 })
  organizationName!: string;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role!: FederationRole;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: FederationMemberStatus;

  /** Association level: full_member, associate, cooperative, affiliate */
  @Column({ type: 'varchar', length: 20, default: 'full_member' })
  associationType!: FederationAssociationType;

  @Column({ type: 'int', default: 1 })
  votingPower!: number;

  @Column({ type: 'int', default: 0 })
  contributions!: number;

  @CreateDateColumn()
  joinedAt!: Date;
}
