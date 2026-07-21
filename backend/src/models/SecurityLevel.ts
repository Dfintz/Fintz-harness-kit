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
 * Inter-Organization Security Level Model
 *
 * Represents trust relationships between organizations with different security clearance levels.
 * Enables cross-organization collaboration with granular access control.
 *
 * Use Cases:
 * - Alliance members sharing intelligence at different classification levels
 * - Partner organizations collaborating on operations with restricted access
 * - Fleet coalitions with varying levels of operational security
 *
 * Security Levels (1-10):
 * - 1-3: Public/Low - Basic information sharing
 * - 4-6: Restricted/Medium - Operational details, fleet compositions
 * - 7-9: Confidential/High - Strategic intelligence, attack plans
 * - 10: Top Secret - Full access, critical operations
 *
 * Access Levels:
 * - 'none': No access
 * - 'read': View-only access
 * - 'write': Can modify shared resources
 * - 'full': Complete access including deletion
 */
@Entity('security_levels')
@Index(['sourceOrgId', 'targetOrgId', 'resourceType'], { unique: true })
@Index(['sourceOrgId'])
@Index(['targetOrgId'])
export class SecurityLevel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization granting access (formerly fromOrganizationId)
   */
  @Column()
  sourceOrgId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceOrgId' })
  sourceOrganization!: Organization;

  /**
   * Organization receiving access (formerly toOrganizationId)
   */
  @Column()
  targetOrgId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetOrgId' })
  targetOrganization!: Organization;

  /**
   * Security clearance level (1-10)
   * Higher number = more access
   */
  @Column({ type: 'int' })
  level!: number;

  /**
   * Resource type this security level applies to
   * Examples: 'intelligence', 'fleet', 'operations', 'events', 'ships', '*' (all)
   */
  @Column()
  resourceType!: string;

  /**
   * Access level granted: 'none', 'read', 'write', 'full'
   */
  @Column()
  accessLevel!: string;

  /**
   * Additional restrictions or conditions
   */
  @Column({ type: 'jsonb', nullable: true })
  restrictions?: Record<string, unknown>;

  /**
   * Optional notes about this security relationship
   */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  /**
   * Whether this security level is currently active
   */
  @Column({ default: true })
  isActive!: boolean;

  /**
   * When this security level expires (optional)
   */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  /**
   * User who approved/created this security level
   */
  @Column({ nullable: true })
  approvedBy?: string;

  /**
   * User who last updated this security level
   */
  @Column({ nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Helper method to check if security level grants access
   */
  grantsAccess(requiredLevel: number, requiredAccessLevel: string = 'read'): boolean {
    if (!this.isActive) {
      return false;
    }

    if (this.expiresAt && this.expiresAt < new Date()) {
      return false;
    }

    if (this.level < requiredLevel) {
      return false;
    }

    // Check access level hierarchy: full > write > read > none
    const accessHierarchy: Record<string, number> = {
      none: 0,
      read: 1,
      write: 2,
      full: 3,
    };

    return accessHierarchy[this.accessLevel] >= accessHierarchy[requiredAccessLevel];
  }
}
