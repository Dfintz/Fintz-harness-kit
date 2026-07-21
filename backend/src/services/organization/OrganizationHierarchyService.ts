import { randomUUID } from 'node:crypto';

import { In, IsNull } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization, OrganizationStatus, OrganizationType } from '../../models/Organization';

/**
 * Hierarchy validation result
 */
interface HierarchyValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Service for managing organization hierarchy
 * Handles tree structure operations and validation
 */
export class OrganizationHierarchyService {
  private readonly organizationRepository = AppDataSource.getRepository(Organization);

  // Maximum depth to prevent infinite recursion
  private readonly MAX_DEPTH = 10;

  // ==================== HIERARCHY CREATION ====================

  /**
   * Create a sub-organization under a parent
   * @param parentId Parent organization ID
   * @param orgData Organization data
   * @returns Created organization
   */
  async createSubOrganization(
    parentId: string,
    orgData: Partial<Organization>
  ): Promise<Organization> {
    const parent = await this.organizationRepository.findOne({
      where: { id: parentId },
    });

    if (!parent) {
      throw new Error('Parent organization not found');
    }

    // Check if parent allows sub-organizations
    if (parent.settings?.allowSubOrgs === false) {
      throw new Error('Parent organization does not allow sub-organizations');
    }

    // Check depth limit
    const newLevel = parent.level + 1;
    if (newLevel > this.MAX_DEPTH) {
      throw new Error(`Maximum hierarchy depth (${this.MAX_DEPTH}) exceeded`);
    }

    // Check parent's max depth setting
    if (parent.settings?.maxDepth && newLevel > parent.settings.maxDepth) {
      throw new Error(`Parent organization max depth (${parent.settings.maxDepth}) exceeded`);
    }

    // Determine organization type based on level
    const type = this.determineTypeByLevel(newLevel);

    // Create organization
    const orgId = orgData.id || randomUUID();
    const newOrg = this.organizationRepository.create({
      ...orgData,
      id: orgId,
      parentOrgId: parentId,
      level: newLevel,
      path: `${parent.buildPath(parent.path)}.${orgData.id || ''}`,
      rootOrgId: parent.rootOrgId || parent.id,
      type: orgData.type || type,
      status: orgData.status || OrganizationStatus.ACTIVE,
    });

    const saved = await this.organizationRepository.save(newOrg);

    // Update path with actual ID
    saved.path = parent.path ? `${parent.path}.${saved.id}` : saved.id;
    await this.organizationRepository.save(saved);

    // Update parent child count
    await this.updateChildCount(parentId);

    return saved;
  }

  /**
   * Determine organization type based on hierarchy level
   */
  private determineTypeByLevel(level: number): OrganizationType {
    if (level === 0) {
      return OrganizationType.ROOT;
    }
    if (level === 1) {
      return OrganizationType.DIVISION;
    }
    if (level === 2) {
      return OrganizationType.DEPARTMENT;
    }
    return OrganizationType.TEAM;
  }

  // ==================== HIERARCHY QUERIES ====================

  /**
   * Get all ancestors of an organization (from root to parent)
   * @param orgId Organization ID
   * @returns Array of ancestor organizations
   */
  async getAncestors(orgId: string): Promise<Organization[]> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const ancestorIds = org.getAncestorIds();
    if (ancestorIds.length === 0) {
      return [];
    }

    const ancestors = await this.organizationRepository.find({
      where: { id: In(ancestorIds) },
      order: { level: 'ASC' },
    });

    return ancestors;
  }

  /**
   * Get all descendants of an organization (children, grandchildren, etc.)
   * @param orgId Organization ID
   * @param maxDepth Maximum depth to traverse (optional)
   * @returns Array of descendant organizations
   */
  async getDescendants(orgId: string, maxDepth?: number): Promise<Organization[]> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Use path-based query for efficient retrieval
    const queryBuilder = this.organizationRepository
      .createQueryBuilder('org')
      .where('org.path LIKE :path', { path: `${org.path}.%` })
      .orderBy('org.level', 'ASC')
      .addOrderBy('org.name', 'ASC');

    if (maxDepth !== undefined) {
      queryBuilder.andWhere('org.level <= :maxLevel', {
        maxLevel: org.level + maxDepth,
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * Get direct children of an organization
   * @param orgId Organization ID
   * @returns Array of child organizations
   */
  async getChildren(orgId: string): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: { parentOrgId: orgId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get root organization of a tree
   * @param orgId Organization ID
   * @returns Root organization
   */
  async getRoot(orgId: string): Promise<Organization> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    if (org.isRoot()) {
      return org;
    }

    const root = await this.organizationRepository.findOne({
      where: { id: org.rootOrgId },
    });

    if (!root) {
      throw new Error('Root organization not found');
    }

    return root;
  }

  /**
   * Get all root organizations (no parent)
   * @returns Array of root organizations
   */
  async getRootOrganizations(): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: { parentOrgId: IsNull() },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get siblings of an organization (same parent)
   * @param orgId Organization ID
   * @param includeSelf Include the organization itself
   * @returns Array of sibling organizations
   */
  async getSiblings(orgId: string, includeSelf: boolean = false): Promise<Organization[]> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    if (!org.parentOrgId) {
      // Root organization has no siblings
      return [];
    }

    const queryBuilder = this.organizationRepository
      .createQueryBuilder('org')
      .where('org.parentOrgId = :parentId', { parentId: org.parentOrgId });

    if (!includeSelf) {
      queryBuilder.andWhere('org.id != :orgId', { orgId });
    }

    return queryBuilder.orderBy('org.name', 'ASC').getMany();
  }

  /**
   * Get full hierarchy tree from a root
   * @param rootId Root organization ID
   * @returns Tree structure
   */
  async getTree(rootId: string): Promise<Organization & { children?: Organization[] }> {
    const root = await this.organizationRepository.findOne({
      where: { id: rootId },
    });

    if (!root) {
      throw new Error('Organization not found');
    }

    const descendants = await this.getDescendants(rootId);

    // Build tree structure
    return this.buildTree(root, descendants);
  }

  /**
   * Build tree structure from flat array
   */
  private buildTree(
    root: Organization,
    allOrgs: Organization[]
  ): Organization & { children?: Organization[] } {
    const orgMap = new Map<string, Organization & { children?: Organization[] }>();

    type OrgWithChildren = Organization & { children?: Organization[] };

    // Add root
    orgMap.set(root.id, { ...root, children: [] } as unknown as OrgWithChildren);

    // Add all descendants
    for (const org of allOrgs) {
      orgMap.set(org.id, { ...org, children: [] } as unknown as OrgWithChildren);
    }

    // Build parent-child relationships
    for (const org of allOrgs) {
      if (org.parentOrgId) {
        const parent = orgMap.get(org.parentOrgId);
        const child = orgMap.get(org.id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    }

    // @ts-expect-error - Strict mode compatibility
    return orgMap.get(root.id);
  }

  // ==================== HIERARCHY MODIFICATIONS ====================

  /**
   * Move organization to new parent
   * @param orgId Organization to move
   * @param newParentId New parent ID (null for root)
   * @returns Updated organization
   */
  async moveOrganization(orgId: string, newParentId: string | null): Promise<Organization> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Can't move to self
    if (orgId === newParentId) {
      throw new Error('Cannot move organization to itself');
    }

    // Can't move to descendant
    if (newParentId && org.isAncestorOf(newParentId)) {
      throw new Error('Cannot move organization to its own descendant');
    }

    let newParent: Organization | null = null;
    let newLevel = 0;
    let newPath = org.id;
    let newRootId = org.id;

    if (newParentId) {
      newParent = await this.organizationRepository.findOne({
        where: { id: newParentId },
      });

      if (!newParent) {
        throw new Error('New parent organization not found');
      }

      // Check parent settings
      if (newParent.settings?.allowSubOrgs === false) {
        throw new Error('Parent organization does not allow sub-organizations');
      }

      newLevel = newParent.level + 1;
      newPath = `${newParent.path}.${org.id}`;
      newRootId = newParent.rootOrgId || newParent.id;

      // Check depth
      const descendants = await this.getDescendants(orgId);
      const maxDescendantLevel = descendants.reduce((max, d) => Math.max(max, d.level), org.level);
      const descendantDepth = maxDescendantLevel - org.level;
      const newMaxLevel = newLevel + descendantDepth;

      if (newMaxLevel > this.MAX_DEPTH) {
        throw new Error(`Move would exceed maximum hierarchy depth (${this.MAX_DEPTH})`);
      }
    }

    const oldParentId = org.parentOrgId;
    const levelDifference = newLevel - org.level;

    // Update organization
    org.parentOrgId = newParentId || undefined;
    org.level = newLevel;
    org.path = newPath;
    org.rootOrgId = newRootId;
    org.type = this.determineTypeByLevel(newLevel);

    await this.organizationRepository.save(org);

    // Update all descendants
    if (levelDifference !== 0) {
      await this.updateDescendantPaths(orgId, newPath, levelDifference);
    }

    // Update child counts
    if (oldParentId) {
      await this.updateChildCount(oldParentId);
    }
    if (newParentId) {
      await this.updateChildCount(newParentId);
    }

    return org;
  }

  /**
   * Detach organization from parent (make it root)
   * @param orgId Organization ID
   * @returns Updated organization
   */
  async detachFromParent(orgId: string): Promise<Organization> {
    return this.moveOrganization(orgId, null);
  }

  /**
   * Delete organization and optionally its descendants
   * @param orgId Organization ID
   * @param deleteDescendants Whether to delete all descendants
   */
  async deleteOrganization(orgId: string, deleteDescendants: boolean = false): Promise<void> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    if (deleteDescendants) {
      // Delete all descendants
      const descendants = await this.getDescendants(orgId);
      const idsToDelete = [orgId, ...descendants.map(d => d.id)];
      await this.organizationRepository.delete({ id: In(idsToDelete) });
    } else {
      // Move children to parent
      const children = await this.getChildren(orgId);

      for (const child of children) {
        await this.moveOrganization(child.id, org.parentOrgId || null);
      }

      // Delete organization
      await this.organizationRepository.delete({ id: orgId });
    }

    // Update parent child count
    if (org.parentOrgId) {
      await this.updateChildCount(org.parentOrgId);
    }
  }

  /**
   * Update paths and levels for all descendants after move
   */
  private async updateDescendantPaths(
    orgId: string,
    newParentPath: string,
    levelDifference: number
  ): Promise<void> {
    const descendants = await this.getDescendants(orgId);

    for (const descendant of descendants) {
      // Update path by replacing the moved org's old path with new path
      const pathParts = descendant.path.split('.');
      const orgIndex = pathParts.indexOf(orgId);

      if (orgIndex !== -1) {
        const newPathParts = [...newParentPath.split('.'), ...pathParts.slice(orgIndex + 1)];
        descendant.path = newPathParts.join('.');
      }

      // Update level
      descendant.level += levelDifference;
      descendant.type = this.determineTypeByLevel(descendant.level);

      await this.organizationRepository.save(descendant);
    }
  }

  /**
   * Update child count for organization
   */
  private async updateChildCount(orgId: string): Promise<void> {
    const children = await this.getChildren(orgId);

    await this.organizationRepository.update({ id: orgId }, { childCount: children.length });
  }

  // ==================== HIERARCHY VALIDATION ====================

  /**
   * Validate organization hierarchy
   * @param orgId Organization ID
   * @returns Validation result
   */
  async validateHierarchy(orgId: string): Promise<HierarchyValidation> {
    const errors: string[] = [];

    try {
      const org = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      if (!org) {
        return { valid: false, errors: ['Organization not found'] };
      }

      // Validate parent exists
      if (org.parentOrgId) {
        const parent = await this.organizationRepository.findOne({
          where: { id: org.parentOrgId },
        });

        if (!parent) {
          errors.push('Parent organization not found');
        }
      }

      // Validate level matches path
      const pathParts = org.path.split('.');
      if (pathParts.length - 1 !== org.level) {
        errors.push(`Level (${org.level}) does not match path depth (${pathParts.length - 1})`);
      }

      // Validate no circular references
      const ancestors = await this.getAncestors(orgId);
      const ancestorIds = ancestors.map(a => a.id);
      if (ancestorIds.includes(orgId)) {
        errors.push('Circular reference detected in hierarchy');
      }

      // Validate max depth
      if (org.level > this.MAX_DEPTH) {
        errors.push(`Organization exceeds maximum depth (${this.MAX_DEPTH})`);
      }

      // Validate root org ID
      if (!org.isRoot() && !org.rootOrgId) {
        errors.push('Non-root organization missing rootOrgId');
      }

      // Validate child count
      const actualChildren = await this.getChildren(orgId);
      if (actualChildren.length !== org.childCount) {
        errors.push(
          `Child count mismatch: stored=${org.childCount}, actual=${actualChildren.length}`
        );
      }
    } catch (error: unknown) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Repair hierarchy issues
   * @param orgId Organization ID
   * @returns Repair result
   */
  async repairHierarchy(orgId: string): Promise<{ repaired: boolean; fixes: string[] }> {
    const fixes: string[] = [];

    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      return { repaired: false, fixes: ['Organization not found'] };
    }

    // Fix child count
    const actualChildren = await this.getChildren(orgId);
    if (actualChildren.length !== org.childCount) {
      org.childCount = actualChildren.length;
      fixes.push(`Updated child count to ${actualChildren.length}`);
    }

    // Fix path if needed
    if (org.parentOrgId) {
      const parent = await this.organizationRepository.findOne({
        where: { id: org.parentOrgId },
      });

      if (parent) {
        const correctPath = `${parent.path}.${org.id}`;
        if (org.path !== correctPath) {
          org.path = correctPath;
          fixes.push(`Updated path to ${correctPath}`);
        }

        const correctLevel = parent.level + 1;
        if (org.level !== correctLevel) {
          org.level = correctLevel;
          fixes.push(`Updated level to ${correctLevel}`);
        }
      }
    } else {
      // Root organization
      if (org.path !== org.id) {
        org.path = org.id;
        fixes.push('Updated root path');
      }
      if (org.level !== 0) {
        org.level = 0;
        fixes.push('Updated root level to 0');
      }
    }

    if (fixes.length > 0) {
      await this.organizationRepository.save(org);
    }

    return {
      repaired: fixes.length > 0,
      fixes,
    };
  }

  // ==================== HIERARCHY STATISTICS ====================

  /**
   * Get hierarchy statistics for organization
   */
  async getHierarchyStats(orgId: string): Promise<{
    depth: number;
    totalDescendants: number;
    directChildren: number;
    totalMembers: number;
    organizationsByLevel: Record<number, number>;
  }> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const descendants = await this.getDescendants(orgId);
    const children = await this.getChildren(orgId);

    const maxLevel = descendants.reduce((max, d) => Math.max(max, d.level), org.level);
    const depth = maxLevel - org.level;

    const organizationsByLevel: Record<number, number> = {};
    for (const descendant of descendants) {
      organizationsByLevel[descendant.level] = (organizationsByLevel[descendant.level] || 0) + 1;
    }

    const totalMembers = descendants.reduce(
      (sum, d) => sum + (d.totalMembers || 0),
      org.totalMembers || 0
    );

    return {
      depth,
      totalDescendants: descendants.length,
      directChildren: children.length,
      totalMembers,
      organizationsByLevel,
    };
  }
}

