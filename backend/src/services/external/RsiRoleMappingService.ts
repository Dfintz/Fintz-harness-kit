import { In, IsNull, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Role } from '../../models/Role';
import { RsiCrawledMember } from '../../models/RsiCrawledMember';
import { RbacPermissions, RsiRoleMapping } from '../../models/RsiRoleMapping';
import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
import { Team } from '../../models/Team';
import { logger } from '../../utils/logger';
import { getRoleService } from '../security/core/RoleService';

import { buildRoleSyncPreview, RoleSyncPreview } from './rsiRoleSyncPreview';

/**
 * Default role mapping templates for standard organization structures
 */
export interface RoleMappingTemplate {
  name: string;
  description: string;
  mappings: Array<{
    rsiRank: string;
    rbacPermissions: RbacPermissions;
    priority: number;
    /** Internal role name to resolve at apply time */
    internalRoleName?: string;
    /** Team names to resolve at apply time for auto-assignment */
    autoAssignTeamNames?: string[];
  }>;
}

/**
 * Input for creating a role mapping
 */
export interface CreateRoleMappingInput {
  organizationId: string;
  rsiRank: string;
  discordRoleId?: string;
  rbacPermissions?: RbacPermissions;
  isActive?: boolean;
  priority?: number;
  description?: string;
  /** Internal Role entity ID for membership role sync */
  internalRoleId?: string;
  /** Team IDs for automatic team assignment on sync */
  autoAssignTeamIds?: string[];
}

/**
 * Input for updating a role mapping
 */
export interface UpdateRoleMappingInput {
  discordRoleId?: string;
  rbacPermissions?: RbacPermissions;
  isActive?: boolean;
  priority?: number;
  description?: string;
  /** Internal Role entity ID for membership role sync */
  internalRoleId?: string;
  /** Team IDs for automatic team assignment on sync */
  autoAssignTeamIds?: string[];
}

/**
 * Bulk mapping operation result
 */
export interface BulkMappingResult {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * RSI Role Mapping Service
 *
 * Provides CRUD operations for RSI rank to Discord role and RBAC permission mappings.
 * Part of Phase 2: RSI Role Sync System - Role Mapping Configuration.
 *
 * Features:
 * - Create, read, update, delete role mappings
 * - Apply default templates
 * - Per-organization configuration
 * - Bulk operations for efficiency
 */
export class RsiRoleMappingService {
  private roleMappingRepository: Repository<RsiRoleMapping>;

  /**
   * The 4 fixed RSI role types that every RSI organization has.
   * Each org can customise the display name (e.g. Founder → "CEO"),
   * but the underlying type is always one of these four.
   * Note: The mapping's rsiRank stores the default type name.
   * When orgs customise names on RSI, admin must manually update
   * mappings or re-apply the template until automatic name sync
   * is implemented.
   */
  public static readonly RSI_ROLE_TYPES = [
    'Founder',
    'Officer',
    'Recruitment',
    'Marketing',
  ] as const;

  /**
   * Default RSI rank names per star level (0-5).
   * Every RSI org has exactly 6 star-based ranks.
   * Orgs can customise the display name for each level.
   */
  public static readonly RSI_DEFAULT_STAR_RANKS: Record<number, string> = {
    5: 'Rank 5',
    4: 'Rank 4',
    3: 'Rank 3',
    2: 'Rank 2',
    1: 'Rank 1',
    0: 'Rank 0',
  };

  public static readonly DEFAULT_TEMPLATES: RoleMappingTemplate[] = [
    {
      name: 'standard',
      description: 'Standard RSI organization structure: 4 fixed roles + 6 star-based ranks (0–5)',
      mappings: [
        // ── RSI Roles (fixed, every org has these 4) ──────────────────────────
        {
          rsiRank: 'Founder',
          rbacPermissions: {
            admin: true,
            orgManage: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 100,
          internalRoleName: 'founder',
          autoAssignTeamNames: ['Board'],
        },
        {
          rsiRank: 'Officer',
          rbacPermissions: {
            orgManage: true,
            orgEdit: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 95,
          internalRoleName: 'officer',
          autoAssignTeamNames: ['Board'],
        },
        {
          rsiRank: 'Recruitment',
          rbacPermissions: {
            orgEdit: true,
            orgView: true,
            eventManage: true,
          },
          priority: 90,
          internalRoleName: 'recruitment',
        },
        {
          rsiRank: 'Marketing',
          rbacPermissions: {
            orgView: true,
            eventView: true,
          },
          priority: 85,
          internalRoleName: 'marketing',
        },
        // ── RSI Ranks (star-based, 5→0) ───────────────────────────────────────
        {
          rsiRank: 'Rank 5',
          rbacPermissions: {
            admin: true,
            orgManage: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 50,
          internalRoleName: 'admin',
          autoAssignTeamNames: ['Board'],
        },
        {
          rsiRank: 'Rank 4',
          rbacPermissions: {
            orgEdit: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 40,
          internalRoleName: 'admin',
        },
        {
          rsiRank: 'Rank 3',
          rbacPermissions: {
            orgView: true,
            fleetEdit: true,
            fleetView: true,
            eventManage: true,
            intelView: true,
          },
          priority: 30,
          internalRoleName: 'fleet_commander',
        },
        {
          rsiRank: 'Rank 2',
          rbacPermissions: {
            orgView: true,
            fleetView: true,
            eventView: true,
            intelView: true,
          },
          priority: 20,
          internalRoleName: 'officer',
        },
        {
          rsiRank: 'Rank 1',
          rbacPermissions: { orgView: true, fleetView: true, eventView: true },
          priority: 10,
          internalRoleName: 'member',
        },
        {
          rsiRank: 'Rank 0',
          rbacPermissions: { orgView: true, fleetView: true },
          priority: 0,
          internalRoleName: 'member',
        },
      ],
    },
    {
      name: 'military',
      description: 'Military-style organization: 4 fixed roles + 6 star-based ranks',
      mappings: [
        // ── RSI Roles (fixed) ─────────────────────────────────────────────────
        {
          rsiRank: 'Founder',
          rbacPermissions: {
            admin: true,
            orgManage: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 100,
          internalRoleName: 'founder',
        },
        {
          rsiRank: 'Officer',
          rbacPermissions: {
            orgManage: true,
            orgEdit: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 95,
          internalRoleName: 'officer',
        },
        {
          rsiRank: 'Recruitment',
          rbacPermissions: { orgEdit: true, orgView: true, eventManage: true },
          priority: 90,
          internalRoleName: 'recruitment',
        },
        {
          rsiRank: 'Marketing',
          rbacPermissions: { orgView: true, eventView: true },
          priority: 85,
          internalRoleName: 'marketing',
        },
        // ── RSI Ranks (star-based, military naming) ───────────────────────────
        {
          rsiRank: 'Admiral',
          rbacPermissions: {
            admin: true,
            orgManage: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 50,
          internalRoleName: 'admin',
        },
        {
          rsiRank: 'Captain',
          rbacPermissions: {
            orgEdit: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 40,
          internalRoleName: 'admin',
        },
        {
          rsiRank: 'Commander',
          rbacPermissions: { orgView: true, fleetEdit: true, eventManage: true, intelView: true },
          priority: 30,
          internalRoleName: 'fleet_commander',
        },
        {
          rsiRank: 'Lieutenant',
          rbacPermissions: {
            orgView: true,
            fleetEdit: true,
            fleetView: true,
            eventView: true,
            intelView: true,
          },
          priority: 20,
          internalRoleName: 'officer',
        },
        {
          rsiRank: 'Ensign',
          rbacPermissions: { orgView: true, fleetView: true, eventView: true },
          priority: 10,
          internalRoleName: 'member',
        },
        {
          rsiRank: 'Cadet',
          rbacPermissions: { orgView: true, fleetView: true },
          priority: 0,
          internalRoleName: 'member',
        },
      ],
    },
    {
      name: 'corporate',
      description: 'Corporate structure: 4 fixed roles + 6 star-based ranks',
      mappings: [
        // ── RSI Roles (fixed) ─────────────────────────────────────────────────
        {
          rsiRank: 'Founder',
          rbacPermissions: {
            admin: true,
            orgManage: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 100,
          internalRoleName: 'founder',
        },
        {
          rsiRank: 'Officer',
          rbacPermissions: {
            orgManage: true,
            orgEdit: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 95,
          internalRoleName: 'officer',
        },
        {
          rsiRank: 'Recruitment',
          rbacPermissions: { orgEdit: true, orgView: true, eventManage: true },
          priority: 90,
          internalRoleName: 'recruitment',
        },
        {
          rsiRank: 'Marketing',
          rbacPermissions: { orgView: true, eventView: true },
          priority: 85,
          internalRoleName: 'marketing',
        },
        // ── RSI Ranks (star-based, corporate naming) ──────────────────────────
        {
          rsiRank: 'CEO',
          rbacPermissions: {
            admin: true,
            orgManage: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 50,
          internalRoleName: 'admin',
        },
        {
          rsiRank: 'Executive',
          rbacPermissions: {
            orgEdit: true,
            fleetManage: true,
            eventManage: true,
            intelManage: true,
          },
          priority: 40,
          internalRoleName: 'admin',
        },
        {
          rsiRank: 'Manager',
          rbacPermissions: { orgView: true, fleetEdit: true, eventManage: true, intelView: true },
          priority: 30,
          internalRoleName: 'fleet_commander',
        },
        {
          rsiRank: 'Senior Associate',
          rbacPermissions: { orgView: true, fleetView: true, eventView: true, intelView: true },
          priority: 20,
          internalRoleName: 'officer',
        },
        {
          rsiRank: 'Associate',
          rbacPermissions: { orgView: true, fleetView: true, eventView: true },
          priority: 10,
          internalRoleName: 'member',
        },
        {
          rsiRank: 'Intern',
          rbacPermissions: { orgView: true, fleetView: true },
          priority: 0,
          internalRoleName: 'member',
        },
      ],
    },
  ];

  constructor() {
    this.roleMappingRepository = AppDataSource.getRepository(RsiRoleMapping);
    logger.info('RsiRoleMappingService initialized');
  }

  // ==================== RANK DISCOVERY ====================

  /**
   * Get distinct RSI ranks, star numbers, and org roles discovered from crawled member data.
   * Returns text rank names (e.g. "Founder", "Officer"), numeric ranks (0-5),
   * star-to-name mappings for display, and RSI org roles (e.g. "CEO", "VP").
   */
  public async getDiscoveredRanks(organizationId: string): Promise<{
    roles: string[];
    ranks: number[];
    rankMap: Array<{ stars: number; name: string; count: number }>;
    orgRoles: string[];
  }> {
    try {
      // Resolve the RSI org SID from the sync schedule
      const scheduleRepo = AppDataSource.getRepository(RsiSyncSchedule);
      const schedule = await scheduleRepo.findOne({
        where: { organizationId },
        select: ['rsiOrgSid'],
      });

      if (!schedule?.rsiOrgSid) {
        logger.debug('No RSI org SID configured for organization', { organizationId });
        return { roles: [], ranks: [], rankMap: [], orgRoles: [] };
      }

      const memberRepo = AppDataSource.getRepository(RsiCrawledMember);

      // Get distinct rank names
      const roleRows = await memberRepo
        .createQueryBuilder('m')
        .select('DISTINCT m.rank', 'rank')
        .where('m.organizationSid = :sid', { sid: schedule.rsiOrgSid })
        .andWhere('m.rank IS NOT NULL')
        .andWhere("m.rank != ''")
        .orderBy('m.rank', 'ASC')
        .getRawMany<{ rank: string }>();

      // Get distinct star numbers
      const starRows = await memberRepo
        .createQueryBuilder('m')
        .select('DISTINCT m.stars', 'stars')
        .where('m.organizationSid = :sid', { sid: schedule.rsiOrgSid })
        .orderBy('m.stars', 'ASC')
        .getRawMany<{ stars: number }>();

      // Get star-to-rank-name mapping with member counts
      const rankMapRows = await memberRepo
        .createQueryBuilder('m')
        .select('m.stars', 'stars')
        .addSelect('m.rank', 'name')
        .addSelect('COUNT(*)', 'count')
        .where('m.organizationSid = :sid', { sid: schedule.rsiOrgSid })
        .andWhere('m.rank IS NOT NULL')
        .andWhere("m.rank != ''")
        .groupBy('m.stars')
        .addGroupBy('m.rank')
        .orderBy('m.stars', 'ASC')
        .addOrderBy('count', 'DESC')
        .getRawMany<{ stars: number; name: string; count: string }>();

      // Get distinct RSI org roles (CEO, VP, etc.) from the roles JSON column
      const members = await memberRepo.find({
        where: { organizationSid: schedule.rsiOrgSid },
        select: ['roles'],
      });

      const orgRoleSet = new Set<string>();
      for (const m of members) {
        if (m.roles && m.roles.length > 0) {
          for (const role of m.roles) {
            orgRoleSet.add(role);
          }
        }
      }

      return {
        roles: roleRows.map(r => r.rank),
        ranks: starRows.map(r => Number(r.stars)),
        rankMap: rankMapRows.map(r => ({
          stars: Number(r.stars),
          name: r.name,
          count: Number(r.count),
        })),
        orgRoles: Array.from(orgRoleSet).sort(),
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get discovered RSI ranks', { error: msg, organizationId });
      return { roles: [], ranks: [], rankMap: [], orgRoles: [] };
    }
  }

  /**
   * Get discovered RSI org roles (CEO, VP, etc.) from crawled member data.
   */
  public async getDiscoveredOrgRoles(
    organizationId: string
  ): Promise<Array<{ role: string; members: string[] }>> {
    try {
      const scheduleRepo = AppDataSource.getRepository(RsiSyncSchedule);
      const schedule = await scheduleRepo.findOne({
        where: { organizationId },
        select: ['rsiOrgSid'],
      });
      if (!schedule?.rsiOrgSid) {
        return [];
      }

      const memberRepo = AppDataSource.getRepository(RsiCrawledMember);
      const members = await memberRepo.find({
        where: { organizationSid: schedule.rsiOrgSid },
        select: ['handle', 'roles'],
      });

      // Aggregate: role name → list of member handles
      const roleMap = new Map<string, string[]>();
      for (const m of members) {
        if (m.roles && m.roles.length > 0) {
          for (const role of m.roles) {
            const existing = roleMap.get(role) ?? [];
            existing.push(m.handle);
            roleMap.set(role, existing);
          }
        }
      }

      return Array.from(roleMap.entries())
        .map(([role, handles]) => ({ role, members: handles }))
        .sort((a, b) => a.role.localeCompare(b.role));
    } catch {
      return [];
    }
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create a new role mapping
   */
  public async createMapping(input: CreateRoleMappingInput): Promise<RsiRoleMapping> {
    try {
      // Check for existing mapping with same org + rank (case-insensitive)
      // Use withDeleted() to also find soft-deleted records that still occupy the unique constraint
      const existing = await this.roleMappingRepository
        .createQueryBuilder('m')
        .withDeleted()
        .where('m.organizationId = :orgId', { orgId: input.organizationId })
        .andWhere('LOWER(m.rsiRank) = LOWER(:rank)', { rank: input.rsiRank })
        .getOne();

      if (existing) {
        if (existing.deletedAt) {
          // Soft-deleted record still occupies the unique constraint slot — remove it permanently
          await this.roleMappingRepository.delete(existing.id);
          logger.info(
            `Permanently removed soft-deleted mapping for rank "${input.rsiRank}" before re-creating`
          );
        } else {
          throw new Error(
            `Mapping already exists for rank "${input.rsiRank}" in this organization`
          );
        }
      }

      const mapping = this.roleMappingRepository.create({
        organizationId: input.organizationId,
        rsiRank: input.rsiRank,
        discordRoleId: input.discordRoleId,
        internalRoleId: input.internalRoleId,
        autoAssignTeamIds: input.autoAssignTeamIds,
        rbacPermissions: input.rbacPermissions,
        isActive: input.isActive ?? true,
        priority: input.priority ?? 0,
        description: input.description,
      });

      const saved = await this.roleMappingRepository.save(mapping);
      logger.info(
        `Created role mapping for rank "${input.rsiRank}" in org ${input.organizationId}`
      );

      return saved;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create role mapping`, { error: errorMessage, input });
      throw error;
    }
  }

  /**
   * Get a role mapping by ID
   * @param id - Mapping UUID
   * @param organizationId - When provided, also verifies tenant ownership
   */
  public async getMappingById(id: string, organizationId?: string): Promise<RsiRoleMapping | null> {
    try {
      const where: Record<string, unknown> = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      return await this.roleMappingRepository.findOne({ where });
    } catch (error: unknown) {
      logger.error(`Failed to get mapping by ID`, { error, id, organizationId });
      return null;
    }
  }

  /**
   * Get all mappings for an organization
   */
  public async getMappingsByOrganization(
    organizationId: string,
    includeInactive: boolean = false
  ): Promise<RsiRoleMapping[]> {
    try {
      const queryBuilder = this.roleMappingRepository
        .createQueryBuilder('mapping')
        .where('mapping.organizationId = :organizationId', { organizationId })
        .andWhere('mapping.deletedAt IS NULL');

      if (!includeInactive) {
        queryBuilder.andWhere('mapping.isActive = :isActive', { isActive: true });
      }

      return await queryBuilder
        .orderBy('mapping.priority', 'DESC')
        .addOrderBy('mapping.rsiRank', 'ASC')
        .getMany();
    } catch (error: unknown) {
      logger.error(`Failed to get mappings for organization`, { error, organizationId });
      throw error;
    }
  }

  /**
   * Build a read-only dry-run preview of what applying the current RSI role
   * mappings would do, composed entirely from existing data (configured mappings
   * + discovered ranks with member counts). Nothing is applied or persisted.
   *
   * Resolution mirrors the real apply path (RsiUserLinkService): a member's role
   * is selected by an exact `rsiRank` match on an ACTIVE mapping (unique per org).
   * `priority` only affects display order, never which mapping wins.
   */
  public async buildSyncPreview(organizationId: string): Promise<RoleSyncPreview> {
    const mappings = await this.getMappingsByOrganization(organizationId, true);
    const discovered = await this.getDiscoveredRanks(organizationId);

    // Resolve internal role display names for the referenced mappings.
    const internalRoleIds = [
      ...new Set(mappings.map(m => m.internalRoleId).filter((id): id is string => !!id)),
    ];
    const roleNameById = new Map<string, string>();
    if (internalRoleIds.length > 0) {
      const roles = await AppDataSource.getRepository(Role).find({
        where: { id: In(internalRoleIds) },
        select: ['id', 'name', 'organizationId'],
      });
      for (const role of roles) {
        // Defense-in-depth: only resolve names for this org's roles or system roles
        // (organizationId null); a mis-scoped foreign id stays unresolved (→ null →
        // missing_internal_role) rather than leaking another org's role name.
        if (!role.organizationId || role.organizationId === organizationId) {
          roleNameById.set(role.id, role.name);
        }
      }
    }

    return buildRoleSyncPreview(mappings, discovered, roleNameById);
  }

  /**
   * Get mapping for a specific RSI rank in an organization
   */
  public async getMappingByRank(
    organizationId: string,
    rsiRank: string
  ): Promise<RsiRoleMapping | null> {
    try {
      return await this.roleMappingRepository.findOne({
        where: {
          organizationId,
          rsiRank,
          isActive: true,
          deletedAt: IsNull(),
        },
      });
    } catch (error: unknown) {
      logger.error(`Failed to get mapping by rank`, { error, organizationId, rsiRank });
      return null;
    }
  }

  /**
   * Get mappings by Discord role ID
   */
  public async getMappingsByDiscordRole(
    organizationId: string,
    discordRoleId: string
  ): Promise<RsiRoleMapping[]> {
    try {
      return await this.roleMappingRepository.find({
        where: {
          organizationId,
          discordRoleId,
          isActive: true,
          deletedAt: IsNull(),
        },
        order: { priority: 'DESC' },
      });
    } catch (error: unknown) {
      logger.error(`Failed to get mappings by Discord role`, {
        error,
        organizationId,
        discordRoleId,
      });
      return [];
    }
  }

  /**
   * Update a role mapping
   * @param id - Mapping UUID
   * @param updates - Fields to update
   * @param organizationId - When provided, also verifies tenant ownership
   */
  public async updateMapping(
    id: string,
    updates: UpdateRoleMappingInput,
    organizationId?: string
  ): Promise<RsiRoleMapping | null> {
    try {
      const where: Record<string, unknown> = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const existing = await this.roleMappingRepository.findOne({ where });

      if (!existing) {
        throw new Error('Role mapping not found');
      }

      // Apply updates
      if (updates.discordRoleId !== undefined) {
        existing.discordRoleId = updates.discordRoleId;
      }
      if (updates.rbacPermissions !== undefined) {
        existing.rbacPermissions = updates.rbacPermissions;
      }
      if (updates.isActive !== undefined) {
        existing.isActive = updates.isActive;
      }
      if (updates.priority !== undefined) {
        existing.priority = updates.priority;
      }
      if (updates.description !== undefined) {
        existing.description = updates.description;
      }
      if (updates.internalRoleId !== undefined) {
        existing.internalRoleId = updates.internalRoleId;
      }
      if (updates.autoAssignTeamIds !== undefined) {
        existing.autoAssignTeamIds = updates.autoAssignTeamIds;
      }

      const saved = await this.roleMappingRepository.save(existing);
      logger.info(`Updated role mapping ${id}`);

      return saved;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to update role mapping`, { error: errorMessage, id, updates });
      throw error;
    }
  }

  /**
   * Delete a role mapping (soft delete)
   * @param id - Mapping UUID
   * @param deletedBy - User ID performing the delete
   * @param organizationId - When provided, also verifies tenant ownership
   */
  public async deleteMapping(
    id: string,
    deletedBy?: string,
    organizationId?: string
  ): Promise<boolean> {
    try {
      const where: Record<string, unknown> = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const mapping = await this.roleMappingRepository.findOne({ where });

      if (!mapping) {
        return false;
      }

      mapping.deletedAt = new Date();
      mapping.deletedBy = deletedBy;

      await this.roleMappingRepository.save(mapping);
      logger.info(`Deleted role mapping ${id}`);

      return true;
    } catch (error: unknown) {
      logger.error(`Failed to delete role mapping`, { error, id });
      throw error;
    }
  }

  /**
   * Hard delete a role mapping
   */
  public async permanentlyDeleteMapping(id: string): Promise<boolean> {
    try {
      const result = await this.roleMappingRepository.delete(id);
      return (result.affected ?? 0) > 0;
    } catch (error: unknown) {
      logger.error(`Failed to permanently delete role mapping`, { error, id });
      return false;
    }
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Apply a template to an organization
   */
  public async applyTemplate(
    organizationId: string,
    templateName: string,
    discordRoleMappings?: Record<string, string>
  ): Promise<BulkMappingResult> {
    const result: BulkMappingResult = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    const template = RsiRoleMappingService.DEFAULT_TEMPLATES.find(t => t.name === templateName);
    if (!template) {
      result.errors.push(`Template "${templateName}" not found`);
      return result;
    }

    logger.info(`Applying template "${templateName}" to organization ${organizationId}`);

    for (const mapping of template.mappings) {
      try {
        const discordRoleId = discordRoleMappings?.[mapping.rsiRank];

        // Resolve internal role name → ID (if template specifies one)
        let internalRoleId: string | undefined;
        if (mapping.internalRoleName) {
          const roleId = await getRoleService().getRoleIdByName(
            mapping.internalRoleName,
            organizationId
          );
          if (roleId) {
            internalRoleId = roleId;
          }
        }

        // Resolve team names → IDs (if template specifies them)
        let autoAssignTeamIds: string[] | undefined;
        if (mapping.autoAssignTeamNames && mapping.autoAssignTeamNames.length > 0) {
          const teamRepo = AppDataSource.getRepository(Team);
          const resolvedIds: string[] = [];
          for (const teamName of mapping.autoAssignTeamNames) {
            const team = await teamRepo.findOne({
              where: { organizationId, name: teamName },
            });
            if (team) {
              resolvedIds.push(team.id);
            }
          }
          if (resolvedIds.length > 0) {
            autoAssignTeamIds = resolvedIds;
          }
        }

        // Check if mapping exists
        const existing = await this.getMappingByRank(organizationId, mapping.rsiRank);

        if (existing) {
          // Update existing mapping
          await this.updateMapping(existing.id, {
            rbacPermissions: mapping.rbacPermissions,
            priority: mapping.priority,
            discordRoleId,
            internalRoleId,
            autoAssignTeamIds,
          });
          result.updated++;
        } else {
          // Create new mapping
          await this.createMapping({
            organizationId,
            rsiRank: mapping.rsiRank,
            rbacPermissions: mapping.rbacPermissions,
            priority: mapping.priority,
            discordRoleId,
            internalRoleId,
            autoAssignTeamIds,
          });
          result.created++;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to create mapping for "${mapping.rsiRank}": ${errorMessage}`);
        result.failed++;
      }
    }

    logger.info(
      `Template applied: ${result.created} created, ${result.updated} updated, ${result.failed} failed`
    );
    return result;
  }

  /**
   * Create or update multiple mappings at once
   */
  public async upsertMappings(
    organizationId: string,
    mappings: Array<{
      rsiRank: string;
      discordRoleId?: string;
      rbacPermissions?: RbacPermissions;
      priority?: number;
      description?: string;
    }>
  ): Promise<BulkMappingResult> {
    const result: BulkMappingResult = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (const mapping of mappings) {
      try {
        const existing = await this.getMappingByRank(organizationId, mapping.rsiRank);

        if (existing) {
          await this.updateMapping(existing.id, {
            discordRoleId: mapping.discordRoleId,
            rbacPermissions: mapping.rbacPermissions,
            priority: mapping.priority,
            description: mapping.description,
          });
          result.updated++;
        } else {
          await this.createMapping({
            organizationId,
            rsiRank: mapping.rsiRank,
            discordRoleId: mapping.discordRoleId,
            rbacPermissions: mapping.rbacPermissions,
            priority: mapping.priority,
            description: mapping.description,
          });
          result.created++;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed for "${mapping.rsiRank}": ${errorMessage}`);
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Delete all mappings for an organization
   */
  public async deleteAllMappings(organizationId: string, deletedBy?: string): Promise<number> {
    try {
      const mappings = await this.getMappingsByOrganization(organizationId, true);

      let deletedCount = 0;
      for (const mapping of mappings) {
        if (await this.deleteMapping(mapping.id, deletedBy)) {
          deletedCount++;
        }
      }

      logger.info(`Deleted ${deletedCount} mappings for organization ${organizationId}`);
      return deletedCount;
    } catch (error: unknown) {
      logger.error(`Failed to delete all mappings`, { error, organizationId });
      return 0;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get available templates
   */
  public getAvailableTemplates(): Array<{ name: string; description: string; rankCount: number }> {
    return RsiRoleMappingService.DEFAULT_TEMPLATES.map(t => ({
      name: t.name,
      description: t.description,
      rankCount: t.mappings.length,
    }));
  }

  /**
   * Get template details
   */
  public getTemplateDetails(templateName: string): RoleMappingTemplate | null {
    return RsiRoleMappingService.DEFAULT_TEMPLATES.find(t => t.name === templateName) ?? null;
  }

  /**
   * Validate Discord role ID format
   */
  public isValidDiscordRoleId(roleId: string): boolean {
    // Discord IDs are snowflakes - 18-19 digit numbers
    return /^\d{17,20}$/.test(roleId);
  }

  /**
   * Get organization mapping summary
   */
  public async getOrganizationMappingSummary(organizationId: string): Promise<{
    totalMappings: number;
    activeMappings: number;
    withDiscordRole: number;
    withRbacPermissions: number;
    ranks: string[];
  }> {
    try {
      const allMappings = await this.getMappingsByOrganization(organizationId, true);
      const activeMappings = allMappings.filter(m => m.isActive);

      return {
        totalMappings: allMappings.length,
        activeMappings: activeMappings.length,
        withDiscordRole: allMappings.filter(m => m.hasDiscordRole()).length,
        withRbacPermissions: allMappings.filter(m => m.hasRbacPermissions()).length,
        ranks: allMappings.map(m => m.rsiRank),
      };
    } catch (error: unknown) {
      logger.error(`Failed to get mapping summary`, { error, organizationId });
      return {
        totalMappings: 0,
        activeMappings: 0,
        withDiscordRole: 0,
        withRbacPermissions: 0,
        ranks: [],
      };
    }
  }

  /**
   * Get effective permissions for a user based on their RSI rank
   */
  public async getEffectivePermissions(
    organizationId: string,
    rsiRank: string
  ): Promise<RbacPermissions | null> {
    const mapping = await this.getMappingByRank(organizationId, rsiRank);
    return mapping?.rbacPermissions ?? null;
  }

  /**
   * Get Discord role for a user based on their RSI rank
   */
  public async getDiscordRoleForRank(
    organizationId: string,
    rsiRank: string
  ): Promise<string | null> {
    const mapping = await this.getMappingByRank(organizationId, rsiRank);
    return mapping?.discordRoleId ?? null;
  }

  /**
   * Clone mappings from one organization to another
   */
  public async cloneMappings(
    sourceOrgId: string,
    targetOrgId: string,
    includeDiscordRoles: boolean = false
  ): Promise<BulkMappingResult> {
    const result: BulkMappingResult = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    try {
      const sourceMappings = await this.getMappingsByOrganization(sourceOrgId, false);

      if (sourceMappings.length === 0) {
        result.errors.push('No mappings found in source organization');
        return result;
      }

      for (const mapping of sourceMappings) {
        try {
          const existing = await this.getMappingByRank(targetOrgId, mapping.rsiRank);

          const discordRoleId = includeDiscordRoles ? mapping.discordRoleId : undefined;

          if (existing) {
            await this.updateMapping(existing.id, {
              rbacPermissions: mapping.rbacPermissions,
              priority: mapping.priority,
              description: mapping.description,
              discordRoleId,
            });
            result.updated++;
          } else {
            await this.createMapping({
              organizationId: targetOrgId,
              rsiRank: mapping.rsiRank,
              rbacPermissions: mapping.rbacPermissions,
              priority: mapping.priority,
              description: mapping.description,
              discordRoleId,
            });
            result.created++;
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to clone mapping for "${mapping.rsiRank}": ${errorMessage}`);
          result.failed++;
        }
      }

      logger.info(`Cloned mappings from ${sourceOrgId} to ${targetOrgId}`, result);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Clone operation failed: ${errorMessage}`);
      return result;
    }
  }
}

// Export singleton instance
export const rsiRoleMappingService = new RsiRoleMappingService();

