import { Column, DeleteDateColumn, Index, JoinColumn, ManyToOne } from 'typeorm';

import { Organization } from '../Organization';

/**
 * Base class for all tenant-scoped entities
 * Automatically includes organizationId and relationship
 *
 * All domain entities that should be isolated per organization
 * should extend this class.
 *
 * Features:
 * - Automatic tenant filtering
 * - Cross-organization sharing support
 * - Soft delete support with deletedAt/deletedBy columns
 */
export abstract class TenantEntity {
  /**
   * Organization (tenant) this entity belongs to
   * This field is indexed for optimal tenant-scoped queries
   */
  @Index()
  @Column()
  organizationId!: string;

  /**
   * Relationship to the owning organization
   */
  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * Organizations this entity is shared with (optional)
   * Override in subclasses that support sharing
   */
  @Column('simple-array', { nullable: true, default: '' })
  sharedWithOrgs?: string[];

  /**
   * Soft delete timestamp - when set, the entity is considered deleted
   * TypeORM automatically filters out entities with deletedAt when using queries
   */
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;

  /**
   * User ID who performed the soft delete (for audit purposes)
   */
  @Column({ type: 'varchar', nullable: true })
  deletedBy?: string;

  /**
   * Check if this entity is shared with a specific organization
   * @param targetOrgId - Organization ID to check
   * @returns true if shared with the organization
   */
  isSharedWith(targetOrgId: string): boolean {
    if (!this.sharedWithOrgs) {
      return false;
    }
    return this.sharedWithOrgs.includes(targetOrgId);
  }

  /**
   * Check if user from another org can access this entity
   * @param requestingOrgId - Organization requesting access
   * @param accessLevel - Level of access requested ('read' | 'write' | 'delete')
   * @returns true if access is permitted
   */
  canAccessFromOrg(requestingOrgId: string, accessLevel: 'read' | 'write' | 'delete'): boolean {
    // Own organization always has full access
    if (this.organizationId === requestingOrgId) {
      return true;
    }

    // Other orgs can only read shared resources
    if (accessLevel === 'read' && this.isSharedWith(requestingOrgId)) {
      return true;
    }

    // Write and delete are only for owner org
    return false;
  }

  /**
   * Add organization to shared list
   * @param targetOrgId - Organization to share with
   */
  addSharedOrg(targetOrgId: string): void {
    if (!this.sharedWithOrgs) {
      this.sharedWithOrgs = [];
    }
    if (!this.sharedWithOrgs.includes(targetOrgId)) {
      this.sharedWithOrgs.push(targetOrgId);
    }
  }

  /**
   * Remove organization from shared list
   * @param targetOrgId - Organization to unshare with
   */
  removeSharedOrg(targetOrgId: string): void {
    if (!this.sharedWithOrgs) {
      return;
    }
    this.sharedWithOrgs = this.sharedWithOrgs.filter(id => id !== targetOrgId);
  }

  /**
   * Check if entity is owned by the specified organization
   * @param organizationId - Organization ID to check
   * @returns true if owned by the organization
   */
  isOwnedBy(organizationId: string): boolean {
    return this.organizationId === organizationId;
  }

  /**
   * Get all organizations that can access this entity (owner + shared)
   * @returns Array of organization IDs
   */
  getAccessibleOrgs(): string[] {
    const orgs = [this.organizationId];
    if (this.sharedWithOrgs && this.sharedWithOrgs.length > 0) {
      orgs.push(...this.sharedWithOrgs);
    }
    return orgs;
  }

  /**
   * Check if entity is soft-deleted
   * @returns true if entity has been soft deleted
   */
  isSoftDeleted(): boolean {
    return this.deletedAt !== null && this.deletedAt !== undefined;
  }

  /**
   * Check if entity is not soft-deleted
   * @returns true if entity is not soft deleted
   */
  isNotDeleted(): boolean {
    return !this.isSoftDeleted();
  }
}
