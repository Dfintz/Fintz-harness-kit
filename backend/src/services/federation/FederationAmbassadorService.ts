import type {
  FederationAmbassadorPermission,
  FederationAmbassadorRole,
} from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { FederationAmbassador } from '../../models/FederationAmbassador';
import { FederationMember } from '../../models/FederationMember';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

// ─── Data Interfaces ──────────────────────────────────────────

export interface AmbassadorData {
  id: string;
  federationId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  userName: string;
  role: FederationAmbassadorRole;
  permissions: FederationAmbassadorPermission[];
  isActive: boolean;
  isExternal: boolean;
  title: string | null;
  appointedAt: Date;
}

// ─── Role Hierarchy ───────────────────────────────────────────

/**
 * Maximum ambassador permissions allowed per org role.
 * Ambassadors can never exceed their org's standing.
 */
const ORG_ROLE_HIERARCHY: Record<string, number> = {
  founder: 5,
  leader: 4,
  council: 3,
  member: 2,
  observer: 1,
};

const AMBASSADOR_ROLE_MIN_ORG_LEVEL: Record<FederationAmbassadorRole, number> = {
  council: 3, // org must be council+ to appoint council ambassadors
  representative: 2, // any member org
  observer: 1, // even observer orgs
};

/**
 * Permissions that require a minimum org role level to grant.
 */
const PERMISSION_MIN_ORG_LEVEL: Record<string, number> = {
  vote: 2, // member+
  announce: 2, // member+
  intel: 3, // council+
  wiki: 2, // member+
  resources: 2, // member+
  hr: 3, // council+
  settings: 4, // leader+
  view: 1, // everyone
};

// ─── Service ──────────────────────────────────────────────────

/**
 * FederationAmbassadorService
 *
 * Manages federation ambassadors — users appointed by member orgs
 * to represent them within the federation. Enforces permission
 * cascading: org role → ambassador role → ambassador permissions.
 */
export class FederationAmbassadorService {
  private static instance: FederationAmbassadorService;
  private readonly ambassadorRepository: Repository<FederationAmbassador>;
  private readonly memberRepository: Repository<FederationMember>;

  constructor() {
    this.ambassadorRepository = AppDataSource.getRepository(FederationAmbassador);
    this.memberRepository = AppDataSource.getRepository(FederationMember);
  }

  public static getInstance(): FederationAmbassadorService {
    if (!FederationAmbassadorService.instance) {
      FederationAmbassadorService.instance = new FederationAmbassadorService();
    }
    return FederationAmbassadorService.instance;
  }

  // ─── Helper: Entity → Data ─────────────────────────────────

  private toData(entity: FederationAmbassador): AmbassadorData {
    return {
      id: entity.id,
      federationId: entity.federationId,
      organizationId: entity.organizationId,
      organizationName: entity.organizationName,
      userId: entity.userId,
      userName: entity.userName,
      role: entity.role,
      permissions: entity.permissions,
      isActive: entity.isActive,
      isExternal: entity.isExternal,
      title: entity.title,
      appointedAt: entity.appointedAt,
    };
  }

  // ─── Validation ─────────────────────────────────────────────

  /**
   * Validate that the ambassador role and permissions don't exceed
   * the org's standing in the federation.
   */
  private validatePermissionCascade(
    orgRole: string,
    ambassadorRole: FederationAmbassadorRole,
    permissions: FederationAmbassadorPermission[]
  ): string | null {
    const orgLevel = ORG_ROLE_HIERARCHY[orgRole] ?? 0;

    // Check ambassador role against org role
    const requiredLevel = AMBASSADOR_ROLE_MIN_ORG_LEVEL[ambassadorRole];
    if (orgLevel < requiredLevel) {
      return `Organization role '${orgRole}' cannot appoint a '${ambassadorRole}' ambassador`;
    }

    // Check each permission against org role
    for (const perm of permissions) {
      const permLevel = PERMISSION_MIN_ORG_LEVEL[perm] ?? 1;
      if (orgLevel < permLevel) {
        return `Organization role '${orgRole}' cannot grant '${perm}' permission`;
      }
    }

    return null;
  }

  // ─── CRUD Operations ───────────────────────────────────────

  /**
   * List all ambassadors for a federation.
   */
  async listAmbassadors(federationId: string): Promise<AmbassadorData[]> {
    const entities = await this.ambassadorRepository.find({
      where: { federationId },
      order: { appointedAt: 'ASC' },
    });
    return entities.map(e => this.toData(e));
  }

  /**
   * Get a specific ambassador by ID.
   */
  async getAmbassador(federationId: string, ambassadorId: string): Promise<AmbassadorData | null> {
    const entity = await this.ambassadorRepository.findOne({
      where: { id: ambassadorId, federationId },
    });
    return entity ? this.toData(entity) : null;
  }

  /**
   * Find an ambassador by user within a federation.
   */
  async findByUser(federationId: string, userId: string): Promise<AmbassadorData | null> {
    const entity = await this.ambassadorRepository.findOne({
      where: { federationId, userId },
    });
    return entity ? this.toData(entity) : null;
  }

  /**
   * Appoint a new ambassador for a member or external organization.
   *
   * Validations:
   *   - The appointing user (actor) must be from a founder/leader org
   *   - For internal: the organization must be an active member of the federation
   *   - For external: role is capped at observer, permissions capped at view
   *   - The user can only be ambassador once per federation
   *   - The ambassador role/permissions must not exceed the org's role (internal only)
   */
  async appointAmbassador(
    federationId: string,
    actorOrgId: string,
    data: {
      userId: string;
      userName: string;
      organizationId: string;
      organizationName: string;
      role?: FederationAmbassadorRole;
      permissions?: FederationAmbassadorPermission[];
      title?: string;
      isExternal?: boolean;
    }
  ): Promise<AmbassadorData> {
    const isExternal = data.isExternal ?? false;

    // 1. Verify actor has management rights (founder/leader)
    const actorMember = await this.memberRepository.findOne({
      where: { federationId, organizationId: actorOrgId, status: 'active' as const },
    });
    if (!actorMember) {
      throw new ForbiddenError('Your organization is not an active member of this federation');
    }
    const actorLevel = ORG_ROLE_HIERARCHY[actorMember.role] ?? 0;
    if (actorLevel < 4) {
      throw new ForbiddenError('Only founder or leader organizations can appoint ambassadors');
    }

    let role: FederationAmbassadorRole;
    let permissions: FederationAmbassadorPermission[];

    if (isExternal) {
      // External envoys are restricted to observer role and view permission
      role = 'observer';
      permissions = ['view'];
    } else {
      // 2. Verify target org is an active member
      const targetMember = await this.memberRepository.findOne({
        where: { federationId, organizationId: data.organizationId, status: 'active' as const },
      });
      if (!targetMember) {
        throw new ValidationError('Target organization is not an active member of this federation');
      }

      // 4. Validate permission cascade
      role = data.role ?? 'representative';
      permissions = data.permissions ?? ['view'];
      const cascadeError = this.validatePermissionCascade(targetMember.role, role, permissions);
      if (cascadeError) {
        throw new ValidationError(cascadeError);
      }
    }

    // 3. Check uniqueness (one user per federation)
    const existing = await this.ambassadorRepository.findOne({
      where: { federationId, userId: data.userId },
    });
    if (existing) {
      throw new ConflictError('This user is already an ambassador in this federation');
    }

    // 5. Create ambassador
    const ambassador = this.ambassadorRepository.create({
      federationId,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      userId: data.userId,
      userName: data.userName,
      role,
      permissions,
      isActive: true,
      isExternal,
      title: data.title ?? null,
    });

    const saved = await this.ambassadorRepository.save(ambassador);

    logger.info('Federation ambassador appointed', {
      federationId,
      ambassadorId: saved.id,
      userId: data.userId,
      organizationId: data.organizationId,
      role,
    });

    return this.toData(saved);
  }

  /**
   * Validate role/permission changes for an ambassador update.
   * External envoys are restricted; internal ambassadors use permission cascade.
   */
  private async validateUpdateConstraints(
    federationId: string,
    ambassador: FederationAmbassador,
    newRole: FederationAmbassadorRole,
    newPermissions: FederationAmbassadorPermission[]
  ): Promise<void> {
    if (ambassador.isExternal) {
      if (newRole !== 'observer') {
        throw new ValidationError('External envoys can only have the observer role');
      }
      if (newPermissions.some(p => p !== 'view')) {
        throw new ValidationError('External envoys can only have view permission');
      }
      return;
    }

    const targetMember = await this.memberRepository.findOne({
      where: {
        federationId,
        organizationId: ambassador.organizationId,
        status: 'active' as const,
      },
    });
    if (targetMember) {
      const cascadeError = this.validatePermissionCascade(
        targetMember.role,
        newRole,
        newPermissions
      );
      if (cascadeError) {
        throw new ValidationError(cascadeError);
      }
    }
  }

  /**
   * Update an existing ambassador's role, permissions, title, or active status.
   */
  async updateAmbassador(
    federationId: string,
    ambassadorId: string,
    actorOrgId: string,
    updates: {
      role?: FederationAmbassadorRole;
      permissions?: FederationAmbassadorPermission[];
      title?: string | null;
      isActive?: boolean;
    }
  ): Promise<AmbassadorData | null> {
    // 1. Verify actor has management rights
    const actorMember = await this.memberRepository.findOne({
      where: { federationId, organizationId: actorOrgId, status: 'active' as const },
    });
    if (!actorMember || (ORG_ROLE_HIERARCHY[actorMember.role] ?? 0) < 4) {
      throw new ForbiddenError('Only founder or leader organizations can update ambassadors');
    }

    // 2. Find ambassador
    const ambassador = await this.ambassadorRepository.findOne({
      where: { id: ambassadorId, federationId },
    });
    if (!ambassador) {
      return null;
    }

    // 3. Validate role/permission changes
    const newRole = updates.role ?? ambassador.role;
    const newPermissions = updates.permissions ?? ambassador.permissions;
    await this.validateUpdateConstraints(federationId, ambassador, newRole, newPermissions);

    // 4. Apply updates
    if (updates.role !== undefined) {
      ambassador.role = updates.role;
    }
    if (updates.permissions !== undefined) {
      ambassador.permissions = updates.permissions;
    }
    if (updates.title !== undefined) {
      ambassador.title = updates.title;
    }
    if (updates.isActive !== undefined) {
      ambassador.isActive = updates.isActive;
    }

    const saved = await this.ambassadorRepository.save(ambassador);

    logger.info('Federation ambassador updated', {
      federationId,
      ambassadorId,
      updates: Object.keys(updates),
    });

    return this.toData(saved);
  }

  /**
   * Remove an ambassador from the federation.
   */
  async removeAmbassador(
    federationId: string,
    ambassadorId: string,
    actorOrgId: string
  ): Promise<void> {
    // Verify actor has management rights
    const actorMember = await this.memberRepository.findOne({
      where: { federationId, organizationId: actorOrgId, status: 'active' as const },
    });
    if (!actorMember || (ORG_ROLE_HIERARCHY[actorMember.role] ?? 0) < 4) {
      throw new ForbiddenError('Only founder or leader organizations can remove ambassadors');
    }

    const ambassador = await this.ambassadorRepository.findOne({
      where: { id: ambassadorId, federationId },
    });
    if (!ambassador) {
      throw new NotFoundError('Ambassador', ambassadorId);
    }

    await this.ambassadorRepository.remove(ambassador);

    logger.info('Federation ambassador removed', {
      federationId,
      ambassadorId,
      userId: ambassador.userId,
    });
  }

  /**
   * Get the current user's ambassador profile in a federation (if any).
   */
  async getMyAmbassadorProfile(
    federationId: string,
    userId: string
  ): Promise<AmbassadorData | null> {
    return this.findByUser(federationId, userId);
  }

  /**
   * Check if a user has a specific federation permission.
   * Combines org role check + ambassador permission check.
   */
  async hasPermission(
    federationId: string,
    userId: string,
    permission: FederationAmbassadorPermission
  ): Promise<boolean> {
    const ambassador = await this.ambassadorRepository.findOne({
      where: { federationId, userId, isActive: true },
    });

    if (!ambassador) {
      return false;
    }

    // 'view' is always granted to active ambassadors
    if (permission === 'view') {
      return true;
    }

    return ambassador.permissions.includes(permission);
  }

  /**
   * Get all ambassadors for a specific organization within a federation.
   */
  async getOrgAmbassadors(federationId: string, organizationId: string): Promise<AmbassadorData[]> {
    const entities = await this.ambassadorRepository.find({
      where: { federationId, organizationId },
      order: { appointedAt: 'ASC' },
    });
    return entities.map(e => this.toData(e));
  }
}

