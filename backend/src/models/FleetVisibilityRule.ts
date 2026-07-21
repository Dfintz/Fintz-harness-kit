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

import { Fleet } from './Fleet';

/**
 * Fleet visibility scope
 */
export type FleetVisibilityScope = 'organization' | 'alliance' | 'federation';

/**
 * Fleet visibility access level — how much detail is exposed
 */
export type FleetVisibilityAccessLevel = 'summary' | 'composition' | 'full';

/**
 * Fleet Visibility Rule
 *
 * Defines who can see a fleet and at what level of detail.
 * Rules are additive — if any rule grants access, the viewer sees the fleet
 * at the highest access level granted by any matching rule.
 *
 * Scopes:
 * - organization: Restricts by member security level (rank) within the owning org
 * - alliance: Grants visibility to a specific allied organization
 * - federation: Grants visibility to all member orgs of a federation
 */
@Entity('fleet_visibility_rules')
@Index('idx_fvr_fleet', ['fleetId'])
@Index('idx_fvr_org', ['organizationId'])
@Index('idx_fvr_fleet_scope', ['fleetId', 'scope'])
@Index('idx_fvr_target_alliance', ['targetAllianceOrgId'])
@Index('idx_fvr_target_federation', ['targetFederationId'])
export class FleetVisibilityRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  fleetId!: string;

  @ManyToOne(() => Fleet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fleetId' })
  fleet!: Fleet;

  /** The organization that owns the fleet (denormalized for query efficiency) */
  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  scope!: FleetVisibilityScope;

  /**
   * For 'organization' scope: minimum security level (rank) a member
   * must have to see this fleet. Ignored for other scopes.
   */
  @Column({ type: 'int', nullable: true })
  minSecurityLevel?: number;

  /**
   * For 'alliance' scope: the allied organization's ID.
   * Must correspond to an active AllianceDiplomacy relationship.
   */
  @Column({ type: 'uuid', nullable: true })
  targetAllianceOrgId?: string;

  /**
   * For 'federation' scope: the federation ID.
   * All member orgs of this federation gain visibility.
   */
  @Column({ type: 'uuid', nullable: true })
  targetFederationId?: string;

  /** Level of detail this rule grants */
  @Column({ type: 'varchar', default: 'summary' })
  accessLevel!: FleetVisibilityAccessLevel;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
