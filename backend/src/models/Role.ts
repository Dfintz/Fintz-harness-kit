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

/**
 * Role Entity
 *
 * Represents a role within the system or organization with associated permissions.
 *
 * System Roles (isSystemRole = true, organizationId = null):
 * - admin: Platform administrator with full access
 * - user: Standard authenticated user
 *
 * Organization Roles (isSystemRole = false, organizationId != null):
 * - owner: Organization creator with full control
 * - admin: Organization administrator
 * - member: Standard organization member
 * - guest: Limited access member
 *
 * Custom roles can be created by organizations with specific permission combinations.
 */
@Entity('roles')
@Index(['name', 'organizationId'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Role name (e.g., 'admin', 'owner', 'member', 'moderator')
   * Must be unique within the organization scope (or globally for system roles)
   */
  @Column({ length: 50 })
  name!: string;

  /**
   * Human-readable description of the role's purpose and capabilities
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Organization this role belongs to
   * NULL for system-wide roles (admin, user)
   * UUID for organization-specific roles
   */
  @Column({ nullable: true })
  organizationId?: string;

  /**
   * Whether this is a system role (cannot be modified or deleted)
   * System roles: admin, user
   * Organization roles: owner, admin, member, guest, etc.
   */
  @Column({ default: false })
  isSystemRole!: boolean;

  /**
   * Priority for role hierarchy (higher = more privileged)
   * Used for permission inheritance and conflict resolution
   * Typical values:
   * - admin (system): 1000
   * - owner: 100
   * - admin (org): 90
   * - moderator: 50
   * - member: 10
   * - guest: 1
   */
  @Column({ type: 'int', default: 0 })
  priority!: number;

  /**
   * Array of permission identifiers granted to this role
   * Format: ['org:read', 'org:write', 'member:invite', 'event:create', ...]
   * Stored as JSON array for flexibility
   */
  @Column({ type: 'simple-json', nullable: true })
  permissions?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations

  /**
   * Organization this role belongs to (NULL for system roles)
   */
  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  /**
   * Organization memberships using this role
   * Access via: AppDataSource.getRepository(OrganizationMembership).find({ where: { roleId: role.id } })
   */
}
