import type {
  FederationAmbassadorPermission,
  FederationAmbassadorRole,
} from '@sc-fleet-manager/shared-types';
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
 * FederationAmbassador Entity
 *
 * Represents a user appointed by a member organization to act on their behalf
 * within a federation. Ambassadors are the bridge between users and the
 * federation — since federations contain orgs (not users), ambassadors
 * enable named individuals to perform actions with proper authorization.
 *
 * Permission Resolution:
 *   1. Check FederationMember.role for the org's standing
 *   2. Check FederationAmbassador.permissions for user-level access
 *   3. Ambassadors can never exceed their org's role
 *
 * Unique constraint: one user can only be ambassador once per federation.
 */
@Entity('federation_ambassadors')
@Index('idx_fed_amb_federation', ['federationId'])
@Index('idx_fed_amb_org', ['organizationId'])
@Index('idx_fed_amb_user', ['userId'])
@Index('idx_fed_amb_unique', ['federationId', 'userId'], { unique: true })
export class FederationAmbassador {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  federationId!: string;

  @ManyToOne(() => Federation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'federationId' })
  federation?: Federation;

  /** Organization ID of the member org this ambassador represents */
  @Column({ type: 'varchar' })
  organizationId!: string;

  /** Denormalized org name for display without extra joins */
  @Column({ type: 'varchar', length: 200 })
  organizationName!: string;

  /** The actual user acting as ambassador */
  @Column({ type: 'varchar' })
  userId!: string;

  /** Denormalized user name for display */
  @Column({ type: 'varchar', length: 200 })
  userName!: string;

  @Column({ type: 'varchar', length: 20, default: 'representative' })
  role!: FederationAmbassadorRole;

  /** Granular permissions within the federation */
  @Column({ type: 'jsonb', default: '["view"]' })
  permissions!: FederationAmbassadorPermission[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /** Whether this ambassador represents an org outside the federation */
  @Column({ type: 'boolean', default: false })
  isExternal!: boolean;

  /** Optional display title, e.g. "Chief Diplomat", "Trade Envoy" */
  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @CreateDateColumn()
  appointedAt!: Date;
}
