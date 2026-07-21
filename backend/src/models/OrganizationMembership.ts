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

import { Organization } from './Organization';
import { Role } from './Role';
import { User } from './User';

/**
 * How a member was acquired by the organization. Drives the acquisition funnel
 * in OrganizationMemberService.getMemberStats. NULL on legacy/pre-migration rows.
 */
export type MembershipAcquisitionSource =
  'application' | 'invitation' | 'founder' | 'manual' | 'sync' | 'recruitment';

/**
 * Organization Membership Model
 * Represents a user's membership in an organization
 */
@Entity('organization_memberships')
@Index(['userId', 'organizationId'], { unique: true })
@Index(['organizationId'])
@Index(['userId'])
@Index(['organizationId', 'roleId'], {
  where: '"isActive" = true',
})
@Index('IDX_org_membership_acquisition', ['organizationId', 'acquisitionSource'], {
  where: '"isActive" = true',
})
export class OrganizationMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * Foreign key to the roles table.
   * Stores the UUID of the role assigned to this membership.
   */
  @Column({ type: 'uuid' })
  roleId!: string;

  /**
   * Role relation for this membership.
   * Eagerly loaded so getRoleName(membership.role) works everywhere.
   */
  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @Column({ type: 'int', default: 1 })
  securityLevel!: number;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  joinedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt?: Date;

  @Column('simple-array', { nullable: true })
  permissions?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * How this member was acquired (application, invitation, founder, …).
   * NULL for legacy rows created before acquisition tracking.
   */
  @Column({ type: 'text', nullable: true })
  acquisitionSource?: MembershipAcquisitionSource;

  /** Id of the source record (e.g. the application or invitation) when known. */
  @Column({ type: 'text', nullable: true })
  acquisitionRefId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
