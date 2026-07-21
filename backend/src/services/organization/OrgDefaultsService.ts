/**
 * OrgDefaultsService — Seeds default roles, teams, and team hierarchy
 * for a newly created organization.
 *
 * Called from:
 * - OrganizationService.createOrganization() (production flow)
 * - AuthController.seedDevPersonaOrgs() (demo/dev login flow)
 *
 * Idempotent: safe to call multiple times for the same organization.
 * Non-fatal: errors are logged but do not block org creation.
 */

import { AppDataSource } from '../../data-source';
import { Team } from '../../models/Team';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';
import { rsiRoleMappingService } from '../external/RsiRoleMappingService';
import { getRoleService, type RoleService } from '../security/core/RoleService';
import { TeamService } from '../team/TeamService';

// ── Default Role Definitions ────────────────────────────────────────────────

interface DefaultRoleDef {
  name: string;
  description: string;
  priority: number;
  permissions: string[];
  isSystem: boolean;
  /** Minimum rank level that should hold this role */
  minRankLevel: number;
}

const DEFAULT_ROLES: DefaultRoleDef[] = [
  {
    name: 'founder',
    description: 'Organization creator, full access',
    priority: 100,
    permissions: ['*'],
    isSystem: true,
    minRankLevel: 5,
  },
  {
    name: 'admin',
    description: 'Org-wide elevated access and settings management',
    priority: 80,
    permissions: ['org:*', 'fleet:*', 'member:*', 'activity:*', 'settings:*'],
    isSystem: true,
    minRankLevel: 4,
  },
  {
    name: 'fleet_commander',
    description: 'Fleet and activity leadership with member visibility',
    priority: 60,
    permissions: ['fleet:*', 'activity:*', 'member:view'],
    isSystem: true,
    minRankLevel: 3,
  },
  {
    name: 'officer',
    description: 'Division officer with fleet and activity access',
    priority: 40,
    permissions: ['fleet:*', 'member:view', 'activity:*'],
    isSystem: true,
    minRankLevel: 2,
  },
  {
    name: 'recruitment',
    description: 'Handles member applications and onboarding',
    priority: 40,
    permissions: ['member:*', 'org:applications'],
    isSystem: true,
    minRankLevel: 2,
  },
  {
    name: 'marketing',
    description: 'Manages announcements and social media presence',
    priority: 40,
    permissions: ['announcements:*', 'social:*'],
    isSystem: true,
    minRankLevel: 2,
  },
  {
    name: 'diplomacy',
    description: 'Manages inter-org relations, alliances, and federations',
    priority: 40,
    permissions: ['federation:*', 'diplomacy:*', 'alliance:*'],
    isSystem: false,
    minRankLevel: 2,
  },
  {
    name: 'intel_officer',
    description: 'Intelligence gathering and security oversight',
    priority: 40,
    permissions: ['intel:*', 'security:view'],
    isSystem: false,
    minRankLevel: 2,
  },
  {
    name: 'member',
    description: 'Default member role for all organization members',
    priority: 10,
    permissions: ['fleet:read', 'activity:read', 'member:read'],
    isSystem: true,
    minRankLevel: 1,
  },
];

// ── Default Rank Definitions ────────────────────────────────────────────────

interface RankDef {
  level: number;
  name: string;
  priority: number;
  description: string;
}

const DEFAULT_RANKS: RankDef[] = [
  { level: 0, name: 'Rank 0', priority: 0, description: 'Lowest rank, limited access' },
  { level: 1, name: 'Rank 1', priority: 10, description: 'Basic member rank' },
  { level: 2, name: 'Rank 2', priority: 20, description: 'Intermediate member rank' },
  { level: 3, name: 'Rank 3', priority: 30, description: 'Senior member rank' },
  { level: 4, name: 'Rank 4', priority: 40, description: 'Leadership rank' },
  { level: 5, name: 'Rank 5', priority: 50, description: 'Highest rank' },
];

// ── Default Team Hierarchy ──────────────────────────────────────────────────

interface DefaultTeamDef {
  name: string;
  description: string;
  type: 'division' | 'squadron';
  children?: DefaultTeamDef[];
}

const DEFAULT_TEAM_HIERARCHY: DefaultTeamDef = {
  name: 'Board',
  description: 'Organizational leadership and strategic direction',
  type: 'division',
  children: [
    {
      name: 'Specialists',
      description: 'General members and recruits',
      type: 'squadron',
    },
    {
      name: 'T&I Division',
      description: 'Training & Integration — onboarding and skill development',
      type: 'division',
    },
    {
      name: 'Security Division',
      description: 'Fleet security, escort, and defense operations',
      type: 'division',
    },
    {
      name: 'R&D Division',
      description: 'Research & Development — exploration and innovation',
      type: 'division',
    },
    {
      name: 'Intel Division',
      description: 'Intelligence gathering and threat assessment',
      type: 'division',
    },
    {
      name: 'Diplomacy Division',
      description: 'Inter-org relations, alliances, and negotiations',
      type: 'division',
    },
    {
      name: 'HR Division',
      description: 'Human Resources — recruitment, marketing, and member welfare',
      type: 'division',
    },
  ],
};

// ── Service Implementation ──────────────────────────────────────────────────

export interface SeedDefaultsResult {
  rolesCreated: number;
  teamsCreated: number;
  rsiMappingsCreated: number;
  skipped: boolean;
}

export class OrgDefaultsService {
  private readonly roleService: RoleService;
  private readonly teamService: TeamService;

  constructor() {
    this.roleService = getRoleService();
    this.teamService = new TeamService();
  }

  /**
   * Seed default roles and team hierarchy for an organization.
   * Idempotent — skips items that already exist.
   *
   * @param organizationId - The organization to seed defaults for
   * @returns Summary of what was created
   */
  async seedDefaults(organizationId: string): Promise<SeedDefaultsResult> {
    logger.info('OrgDefaultsService.seedDefaults — starting', { organizationId });

    const result: SeedDefaultsResult = {
      rolesCreated: 0,
      teamsCreated: 0,
      rsiMappingsCreated: 0,
      skipped: false,
    };

    // Per-phase try/catch so a failure in one phase doesn't block the rest
    try {
      result.rolesCreated = await this.seedRoles(organizationId);
    } catch (error: unknown) {
      logger.error('OrgDefaultsService.seedDefaults — Phase 1 (roles) failed (non-fatal)', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      result.teamsCreated = await this.seedTeamHierarchy(organizationId);
    } catch (error: unknown) {
      logger.error('OrgDefaultsService.seedDefaults — Phase 2 (teams) failed (non-fatal)', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      result.rsiMappingsCreated = await this.seedRsiMappings(organizationId);
    } catch (error: unknown) {
      logger.error('OrgDefaultsService.seedDefaults — Phase 3 (RSI mappings) failed (non-fatal)', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // If nothing was created, the org was already seeded
    if (result.rolesCreated === 0 && result.teamsCreated === 0 && result.rsiMappingsCreated === 0) {
      result.skipped = true;
      logger.info('OrgDefaultsService.seedDefaults — already seeded, skipping', {
        organizationId,
      });
    } else {
      logger.info('OrgDefaultsService.seedDefaults — completed', {
        organizationId,
        rolesCreated: result.rolesCreated,
        teamsCreated: result.teamsCreated,
        rsiMappingsCreated: result.rsiMappingsCreated,
      });

      // Audit log for org defaults seeding
      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'ORG_DEFAULTS_SEEDED',
        message: `Organization defaults seeded: ${result.rolesCreated} roles, ${result.teamsCreated} teams, ${result.rsiMappingsCreated} RSI mappings`,
        organizationId,
        resource: `org/${organizationId}/defaults`,
        metadata: {
          rolesCreated: result.rolesCreated,
          teamsCreated: result.teamsCreated,
          rsiMappingsCreated: result.rsiMappingsCreated,
          seededAt: new Date().toISOString(),
        },
      });
    }

    return result;
  }

  /**
   * Seed default roles for the organization.
   * Uses RoleService.getOrCreateRole() which is idempotent.
   */
  private async seedRoles(organizationId: string): Promise<number> {
    let created = 0;

    for (const roleDef of DEFAULT_ROLES) {
      // Check if role already exists
      const existing = await this.roleService.getRoleByName(roleDef.name, organizationId);
      if (existing) {
        continue;
      }

      await this.roleService.getOrCreateRole(
        roleDef.name,
        organizationId,
        roleDef.description,
        roleDef.permissions,
        roleDef.priority
      );
      created++;
    }

    if (created > 0) {
      logger.info('Seeded default roles', { organizationId, rolesCreated: created });
      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'ORG_DEFAULT_ROLES_CREATED',
        message: `Default roles created for organization: ${created} roles`,
        organizationId,
        resource: `org/${organizationId}/roles`,
        metadata: {
          rolesCreated: created,
          roles: DEFAULT_ROLES.map(r => r.name),
          createdAt: new Date().toISOString(),
        },
      });
    }

    return created;
  }

  /**
   * Seed default team hierarchy for the organization.
   * Checks if teams already exist by name before creating.
   */
  private async seedTeamHierarchy(organizationId: string): Promise<number> {
    const teamRepo = AppDataSource.getRepository(Team);

    // Check if the root team already exists (idempotency check)
    const existingBoard = await teamRepo.findOne({
      where: {
        organizationId,
        name: DEFAULT_TEAM_HIERARCHY.name,
      },
    });

    if (existingBoard) {
      return 0; // Already seeded
    }

    let created = 0;

    // Create root team (Board)
    const boardTeam = await this.teamService.createTeam(organizationId, {
      name: DEFAULT_TEAM_HIERARCHY.name,
      description: DEFAULT_TEAM_HIERARCHY.description,
      type: DEFAULT_TEAM_HIERARCHY.type,
    });
    created++;

    // Create child teams
    if (DEFAULT_TEAM_HIERARCHY.children) {
      for (const childDef of DEFAULT_TEAM_HIERARCHY.children) {
        await this.teamService.createTeam(organizationId, {
          name: childDef.name,
          description: childDef.description,
          type: childDef.type,
          parentTeamId: boardTeam.id,
        });
        created++;
      }
    }

    if (created > 0) {
      logger.info('Seeded team hierarchy', { organizationId, teamsCreated: created });
      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'ORG_TEAM_HIERARCHY_CREATED',
        message: `Default team hierarchy created for organization: ${created} teams`,
        organizationId,
        resource: `org/${organizationId}/teams`,
        metadata: {
          teamsCreated: created,
          rootTeamName: DEFAULT_TEAM_HIERARCHY.name,
          createdAt: new Date().toISOString(),
        },
      });
    }

    return created;
  }

  /**
   * Seed RSI rank → internal role mappings using the standard template.
   * Resolves internal role names and team names to IDs at apply time.
   * Idempotent via RsiRoleMappingService.applyTemplate() which upserts.
   */
  private async seedRsiMappings(organizationId: string): Promise<number> {
    try {
      const result = await rsiRoleMappingService.applyTemplate(organizationId, 'standard');

      if (result.created > 0) {
        logger.info('Seeded RSI mappings', { organizationId, mappingsCreated: result.created });
        auditService.log({
          category: AuditCategory.ADMIN,
          action: 'ORG_RSI_MAPPINGS_INITIALIZED',
          message: `RSI rank mappings initialized for organization: ${result.created} mappings`,
          organizationId,
          resource: `org/${organizationId}/rsi-mappings`,
          metadata: {
            mappingsCreated: result.created,
            templateName: 'standard',
            createdAt: new Date().toISOString(),
          },
        });
      }

      return result.created;
    } catch (error: unknown) {
      // Non-fatal: RSI mapping seeding is optional
      logger.warn('OrgDefaultsService.seedRsiMappings — failed (non-fatal)', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  // ── Static accessors for rank definitions ───────────────────────────────

  /**
   * Get the default rank definitions.
   * Useful for UI display and rank assignment logic.
   */
  static getDefaultRanks(): readonly RankDef[] {
    return DEFAULT_RANKS;
  }

  /**
   * Get the rank name for a given level.
   */
  static getRankNameByLevel(level: number): string | undefined {
    return DEFAULT_RANKS.find(r => r.level === level)?.name;
  }

  /**
   * Get all default role definitions.
   */
  static getDefaultRoles(): readonly DefaultRoleDef[] {
    return DEFAULT_ROLES;
  }
}

// Singleton instance
let orgDefaultsServiceInstance: OrgDefaultsService | null = null;

export function getOrgDefaultsService(): OrgDefaultsService {
  orgDefaultsServiceInstance ??= new OrgDefaultsService();
  return orgDefaultsServiceInstance;
}
