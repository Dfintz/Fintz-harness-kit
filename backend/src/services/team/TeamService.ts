/**
 * TeamService — Wave 2.6 Teams System
 *
 * Manages team CRUD, hierarchy, member management, and capacity.
 * Follows the same patterns as FleetService with hierarchy support.
 */

import {
  mapTeamStatusToParticipantStatus,
  mapTeamsRoleToSystemRoles,
  type ParticipantInfo,
} from '@sc-fleet-manager/shared-types';
import { FindOptionsWhere, In, IsNull, QueryRunner } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { AssignmentStatus, CrewAssignment } from '../../models/CrewAssignment';
import type { TeamJoinPolicy, TeamType } from '../../models/Team';
import { Team } from '../../models/Team';
import type { TeamMemberRole, TeamMemberStatus } from '../../models/TeamMember';
import { TeamMember } from '../../models/TeamMember';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import type { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { AuditCategory, auditService } from '../audit/AuditService';
import { TenantService } from '../base/TenantService';
import { StarCommsContextSyncService } from '../communication/starcomms';
import { domainEvents } from '../shared/DomainEventBus';

export interface TeamTreeNode {
  id: string;
  name: string;
  description?: string;
  type: TeamType;
  parentTeamId?: string;
  level: number;
  sortOrder: number;
  maxMembers: number;
  isActive: boolean;
  joinPolicy: TeamJoinPolicy;
  emblem?: string | null;
  memberCount: number;
  children: TeamTreeNode[];
}

/**
 * Interface for advanced team member filtering (mirrors SquadronMemberFilterOptions)
 */
export interface TeamMemberFilterOptions extends PaginationOptions {
  teamId?: string;
  userId?: string;
  role?: TeamMemberRole;
  shipType?: string;
  status?: TeamMemberStatus | TeamMemberStatus[];
  joinedAfter?: Date;
  joinedBefore?: Date;
  lastActiveAfter?: Date;
  lastActiveBefore?: Date;
  searchTerm?: string;
}

export class TeamService extends TenantService<Team> {
  private readonly memberRepo = AppDataSource.getRepository(TeamMember);
  private readonly starCommsContextSyncService = new StarCommsContextSyncService();

  constructor() {
    super(AppDataSource.getRepository(Team), {
      enableCache: true,
      cacheTTL: 300,
      cacheCheckPeriod: 60,
    });
  }

  // ── Team CRUD ────────────────────────────────────────────────────────────

  async createTeam(
    organizationId: string,
    data: {
      name: string;
      description?: string;
      type?: TeamType;
      parentTeamId?: string | null;
      maxMembers?: number;
      joinPolicy?: TeamJoinPolicy;
      emblem?: string | null;
    }
  ): Promise<Team> {
    logger.info('TeamService.createTeam', { organizationId, name: data.name });

    let level = 0;
    let sortOrder = 0;

    if (data.parentTeamId) {
      const parent = await this.findById(organizationId, data.parentTeamId);
      if (!parent) {
        throw new NotFoundError('Parent team');
      }
      if (parent.level >= 4) {
        throw new ValidationError('Maximum nesting depth of 5 levels exceeded');
      }
      level = parent.level + 1;

      // Get next sortOrder among siblings
      const maxSort = await this.repository
        .createQueryBuilder('t')
        .where('t.organizationId = :organizationId', { organizationId })
        .andWhere('t.parentTeamId = :parentTeamId', { parentTeamId: data.parentTeamId })
        .select('MAX(t.sortOrder)', 'max')
        .getRawOne();
      sortOrder = (maxSort?.max ?? -1) + 1;
    } else {
      const maxSort = await this.repository
        .createQueryBuilder('t')
        .where('t.organizationId = :organizationId', { organizationId })
        .andWhere('t.parentTeamId IS NULL')
        .select('MAX(t.sortOrder)', 'max')
        .getRawOne();
      sortOrder = (maxSort?.max ?? -1) + 1;
    }

    const team = this.repository.create({
      organizationId,
      name: data.name,
      description: data.description,
      type: data.type ?? 'squadron',
      parentTeamId: data.parentTeamId ?? undefined,
      level,
      sortOrder,
      maxMembers: data.maxMembers ?? 20,
      isActive: true,
      joinPolicy: data.joinPolicy ?? 'closed',
      emblem: data.emblem ?? null,
    });

    const saved = await this.repository.save(team);
    this.invalidateOrgCache(organizationId);

    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'TEAM_CREATED',
      message: `Team created: ${saved.name}`,
      organizationId,
      resource: `team/${saved.id}`,
      metadata: {
        teamId: saved.id,
        teamName: saved.name,
        type: saved.type,
        level,
      },
    });

    domainEvents.emit('team:created', {
      teamId: saved.id,
      organizationId,
      teamName: saved.name,
      teamType: saved.type,
      parentTeamId: saved.parentTeamId,
      timestamp: new Date().toISOString(),
    });

    this.starCommsContextSyncService
      .syncTeamContext({
        organizationId,
        teamId: saved.id,
        teamName: saved.name,
        teamType: saved.type,
        action: 'team-created',
      })
      .catch(() => {
        // Keep team creation non-blocking if StarComms sync is unavailable.
      });

    return saved;
  }

  async updateTeam(
    organizationId: string,
    teamId: string,
    data: {
      name?: string;
      description?: string;
      type?: TeamType;
      parentTeamId?: string | null;
      maxMembers?: number;
      isActive?: boolean;
      joinPolicy?: TeamJoinPolicy;
      emblem?: string | null;
    }
  ): Promise<Team> {
    logger.info('TeamService.updateTeam', { organizationId, teamId });

    const team = await this.findById(organizationId, teamId);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // If parentTeamId is changing, use moveTeam logic
    if (
      data.parentTeamId !== undefined &&
      (data.parentTeamId ?? null) !== (team.parentTeamId ?? null)
    ) {
      await this.moveTeam(organizationId, teamId, data.parentTeamId);
    }

    if (data.name !== undefined) {
      team.name = data.name;
    }
    if (data.description !== undefined) {
      team.description = data.description;
    }
    if (data.type !== undefined) {
      team.type = data.type;
    }
    if (data.maxMembers !== undefined) {
      team.maxMembers = data.maxMembers;
    }
    if (data.isActive !== undefined) {
      team.isActive = data.isActive;
    }
    if (data.joinPolicy !== undefined) {
      team.joinPolicy = data.joinPolicy;
    }

    // Track emblem change for domain event
    const emblemChanged =
      data.emblem !== undefined && (data.emblem ?? null) !== (team.emblem ?? null);
    if (data.emblem !== undefined) {
      team.emblem = data.emblem ?? null;
    }

    const saved = await this.repository.save(team);
    this.invalidateOrgCache(organizationId);

    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'TEAM_UPDATED',
      message: `Team updated: ${saved.name}`,
      organizationId,
      resource: `team/${saved.id}`,
      metadata: {
        teamId: saved.id,
        teamName: saved.name,
        emblemChanged,
      },
    });

    // Emit domain event so FleetTeamService can sync emblem to linked fleets
    if (emblemChanged) {
      domainEvents.emit('team:emblem_updated', {
        teamId: saved.id,
        organizationId,
        emblemUrl: saved.emblem ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    return saved;
  }

  async deleteTeam(organizationId: string, teamId: string): Promise<void> {
    logger.info('TeamService.deleteTeam', { organizationId, teamId });

    const team = await this.findById(organizationId, teamId);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Count active members before deletion
    const memberCount = await this.memberRepo.count({
      where: { organizationId, teamId, status: 'active' as TeamMemberStatus },
    });
    const teamName = team.name;

    // Remove the team (cascade will handle members, children get SET NULL)
    await this.repository.remove(team);
    this.invalidateOrgCache(organizationId);

    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'TEAM_DELETED',
      message: `Team deleted: ${teamName}`,
      organizationId,
      resource: `team/${teamId}`,
      metadata: {
        teamId,
        teamName,
        memberCount,
      },
    });

    domainEvents.emit('team:deleted', {
      teamId,
      organizationId,
      teamName,
      memberCount,
      timestamp: new Date().toISOString(),
    });

    this.starCommsContextSyncService
      .syncTeamContext({
        organizationId,
        teamId,
        teamName,
        teamType: team.type,
        action: 'team-deleted',
      })
      .catch(() => {
        // Keep team deletion non-blocking if StarComms sync is unavailable.
      });
  }

  // ── Hierarchy ────────────────────────────────────────────────────────────

  async getTeamTree(organizationId: string): Promise<TeamTreeNode[]> {
    logger.debug('TeamService.getTeamTree', { organizationId });

    const allTeams = await this.repository.find({
      where: { organizationId },
      order: { level: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });

    // Get member counts per team
    const memberCounts = await this.memberRepo
      .createQueryBuilder('tm')
      .select('tm.teamId', 'teamId')
      .addSelect('COUNT(*)', 'count')
      .where('tm.organizationId = :organizationId', { organizationId })
      .andWhere('tm.status = :status', { status: 'active' })
      .groupBy('tm.teamId')
      .getRawMany<{ teamId: string; count: string }>();

    const countMap = new Map<string, number>();
    for (const row of memberCounts) {
      countMap.set(row.teamId, Number.parseInt(row.count, 10));
    }

    // Build tree in-memory
    const nodeMap = new Map<string, TeamTreeNode>();
    const roots: TeamTreeNode[] = [];

    for (const team of allTeams) {
      nodeMap.set(team.id, {
        id: team.id,
        name: team.name,
        description: team.description,
        type: team.type,
        parentTeamId: team.parentTeamId,
        level: team.level,
        sortOrder: team.sortOrder,
        maxMembers: team.maxMembers,
        isActive: team.isActive,
        joinPolicy: team.joinPolicy,
        emblem: team.emblem,
        memberCount: countMap.get(team.id) ?? 0,
        children: [],
      });
    }

    for (const team of allTeams) {
      const node = nodeMap.get(team.id)!;
      if (team.parentTeamId && nodeMap.has(team.parentTeamId)) {
        nodeMap.get(team.parentTeamId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async moveTeam(
    organizationId: string,
    teamId: string,
    newParentId: string | null
  ): Promise<Team> {
    logger.info('TeamService.moveTeam', { organizationId, teamId, newParentId });

    const team = await this.findById(organizationId, teamId);
    if (!team) {
      throw new NotFoundError('Team');
    }

    if ((team.parentTeamId || null) === newParentId) {
      return team;
    }

    let parentLevel = -1;
    if (newParentId) {
      if (newParentId === teamId) {
        throw new ValidationError('Cannot move a team under itself');
      }

      const parent = await this.findById(organizationId, newParentId);
      if (!parent) {
        throw new NotFoundError('Target parent team');
      }

      if (await this.isDescendantOf(organizationId, newParentId, teamId)) {
        throw new ValidationError('Cannot move team under its own descendant');
      }

      if (parent.level >= 4) {
        throw new ValidationError('Maximum nesting depth of 5 levels exceeded');
      }

      parentLevel = parent.level;
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      team.parentTeamId = newParentId || undefined;
      team.level = parentLevel + 1;

      // Set sortOrder to last among new siblings
      const maxSort = await queryRunner.manager
        .createQueryBuilder(Team, 't')
        .where('t.organizationId = :organizationId', { organizationId })
        .andWhere(newParentId ? 't.parentTeamId = :parentId' : 't.parentTeamId IS NULL', {
          parentId: newParentId,
        })
        .andWhere('t.id != :teamId', { teamId })
        .select('MAX(t.sortOrder)', 'max')
        .getRawOne();
      team.sortOrder = (maxSort?.max ?? -1) + 1;

      await queryRunner.manager.save(team);

      // Recursively update descendant levels
      await this.updateDescendantLevels(queryRunner, organizationId, team);

      await queryRunner.commitTransaction();
      this.invalidateOrgCache(organizationId);

      auditService.log({
        category: AuditCategory.ORGANIZATION,
        action: 'TEAM_MOVED',
        message: `Team moved: ${team.name}`,
        organizationId,
        resource: `team/${teamId}`,
        metadata: {
          teamId,
          teamName: team.name,
          newParentId,
          newLevel: team.level,
        },
      });

      return team;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async reorderTeams(
    organizationId: string,
    orderedIds: string[],
    _parentTeamId: string | null
  ): Promise<void> {
    logger.info('TeamService.reorderTeams', { organizationId, count: orderedIds.length });

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await queryRunner.manager.update(
          Team,
          { id: orderedIds[i], organizationId },
          { sortOrder: i }
        );
      }
      await queryRunner.commitTransaction();
      this.invalidateOrgCache(organizationId);

      auditService.log({
        category: AuditCategory.ORGANIZATION,
        action: 'TEAMS_REORDERED',
        message: `Teams reordered: ${orderedIds.length} teams`,
        organizationId,
        resource: `organization/${organizationId}/teams`,
        metadata: {
          teamCount: orderedIds.length,
        },
      });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async isDescendantOf(
    organizationId: string,
    potentialDescendantId: string,
    ancestorId: string
  ): Promise<boolean> {
    // Walk up the tree from potentialDescendant to root
    let currentId: string | undefined = potentialDescendantId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        return false;
      } // Cycle protection
      visited.add(currentId);

      const team = await this.findById(organizationId, currentId);
      if (!team) {
        return false;
      }
      if (team.parentTeamId === ancestorId) {
        return true;
      }
      currentId = team.parentTeamId;
    }
    return false;
  }

  private async updateDescendantLevels(
    queryRunner: QueryRunner,
    organizationId: string,
    parentTeam: Team
  ): Promise<void> {
    const children = await queryRunner.manager.find(Team, {
      where: { organizationId, parentTeamId: parentTeam.id },
    });

    for (const child of children) {
      child.level = parentTeam.level + 1;
      await queryRunner.manager.save(child);
      await this.updateDescendantLevels(queryRunner, organizationId, child);
    }
  }

  // ── Member Management ────────────────────────────────────────────────────

  async getTeamMembers(organizationId: string, teamId: string): Promise<TeamMember[]> {
    return this.memberRepo.find({
      where: { organizationId, teamId },
      relations: ['user'],
      order: { role: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Non-breaking Phase 1 adapter for canonical participant shape.
   */
  static toParticipantInfo(member: TeamMember): ParticipantInfo {
    return {
      userId: member.userId,
      organizationId: member.organizationId,
      username: member.user?.username || member.userId,
      displayName: member.user?.displayName,
      roles: mapTeamsRoleToSystemRoles(member.role),
      primaryRole: member.role,
      status: mapTeamStatusToParticipantStatus(member.status),
      joinedAt: member.joinedAt || member.createdAt,
      lastActiveAt: member.lastActiveAt,
      source: 'system',
      metadata: {
        teamId: member.teamId,
        rank: member.rank,
        shipType: member.shipType,
        specialization: member.specialization,
      },
    };
  }

  toParticipantInfo(member: TeamMember): ParticipantInfo {
    return TeamService.toParticipantInfo(member);
  }

  async addMember(
    organizationId: string,
    teamId: string,
    userId: string,
    role: TeamMemberRole = 'member',
    personnelData?: {
      rank?: string;
      shipType?: string;
      specialization?: string;
      certifications?: string[];
      additionalRoles?: string[];
    }
  ): Promise<TeamMember> {
    logger.info('TeamService.addMember', { organizationId, teamId, userId, role });

    const team = await this.findById(organizationId, teamId);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check capacity
    const activeCount = await this.memberRepo.count({
      where: { organizationId, teamId, status: 'active' as TeamMemberStatus },
    });
    if (activeCount >= team.maxMembers) {
      throw new ConflictError('Team is at maximum capacity');
    }

    // Check if user is already a member
    const existing = await this.memberRepo.findOne({
      where: { userId, teamId },
    });
    if (existing) {
      if (existing.status === 'removed' || existing.status === 'inactive') {
        // Re-activate
        existing.status = 'active';
        existing.role = role;
        existing.leftAt = undefined;
        existing.joinedAt = new Date();
        if (personnelData?.rank !== undefined) {
          existing.rank = personnelData.rank;
        }
        if (personnelData?.shipType !== undefined) {
          existing.shipType = personnelData.shipType;
        }
        if (personnelData?.specialization !== undefined) {
          existing.specialization = personnelData.specialization;
        }
        if (personnelData?.certifications !== undefined) {
          existing.certifications = personnelData.certifications;
        }
        if (personnelData?.additionalRoles !== undefined) {
          existing.additionalRoles = personnelData.additionalRoles;
        }
        const saved = await this.memberRepo.save(existing);

        auditService.log({
          category: AuditCategory.ORGANIZATION,
          action: 'TEAM_MEMBER_REACTIVATED',
          message: `Member reactivated in team: ${userId}`,
          organizationId,
          resource: `team/${teamId}/member/${saved.id}`,
          metadata: {
            teamId,
            teamName: team.name,
            userId,
            role,
          },
        });

        domainEvents.emit('team:member_added', {
          teamId,
          organizationId,
          userId,
          role,
          teamName: team.name,
          timestamp: new Date().toISOString(),
        });

        return saved;
      }
      throw new ConflictError('User is already a member of this team');
    }

    const member = this.memberRepo.create({
      organizationId,
      teamId,
      userId,
      role,
      status: 'active' as TeamMemberStatus,
      joinedAt: new Date(),
      ...(personnelData?.rank !== undefined && { rank: personnelData.rank }),
      ...(personnelData?.shipType !== undefined && { shipType: personnelData.shipType }),
      ...(personnelData?.specialization !== undefined && {
        specialization: personnelData.specialization,
      }),
      ...(personnelData?.certifications !== undefined && {
        certifications: personnelData.certifications,
      }),
      ...(personnelData?.additionalRoles !== undefined && {
        additionalRoles: personnelData.additionalRoles,
      }),
    });

    const saved = await this.memberRepo.save(member);

    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'TEAM_MEMBER_ADDED',
      message: `Member added to team: ${userId}`,
      organizationId,
      resource: `team/${teamId}/member/${saved.id}`,
      metadata: {
        teamId,
        teamName: team.name,
        userId,
        role,
      },
    });

    domainEvents.emit('team:member_added', {
      teamId,
      organizationId,
      userId,
      role,
      teamName: team.name,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async updateMember(
    organizationId: string,
    teamId: string,
    memberId: string,
    data: {
      role?: TeamMemberRole;
      status?: TeamMemberStatus;
      rank?: string;
      shipType?: string;
      specialization?: string;
      stats?: { missionsCompleted?: number; hoursFlown?: number; creditsEarned?: number };
      certifications?: string[];
      additionalRoles?: string[];
      lastActiveAt?: string | null;
      departureReason?: string;
    }
  ): Promise<TeamMember> {
    logger.info('TeamService.updateMember', { organizationId, teamId, memberId });

    const member = await this.memberRepo.findOne({
      where: { id: memberId, organizationId, teamId },
    });
    if (!member) {
      throw new NotFoundError('Team member');
    }

    if (data.role !== undefined) {
      member.role = data.role;
    }
    if (data.status !== undefined) {
      const previousStatus = member.status;
      member.status = data.status;
      if (data.status === 'removed') {
        member.leftAt = new Date();
      }
      // Emit status change event for cross-domain observation (fleet crew audit)
      if (previousStatus !== data.status) {
        domainEvents.emit('team:member_status_changed', {
          teamId,
          organizationId,
          userId: member.userId,
          memberName: member.rank || undefined,
          previousStatus,
          newStatus: data.status,
          timestamp: new Date().toISOString(),
        });
      }
    }
    if (data.rank !== undefined) {
      member.rank = data.rank || undefined;
    }
    if (data.shipType !== undefined) {
      member.shipType = data.shipType || undefined;
    }
    if (data.specialization !== undefined) {
      member.specialization = data.specialization || undefined;
    }
    if (data.stats !== undefined) {
      member.stats = data.stats;
    }
    if (data.certifications !== undefined) {
      member.certifications = data.certifications;
    }
    if (data.additionalRoles !== undefined) {
      member.additionalRoles = data.additionalRoles;
    }
    if (data.lastActiveAt !== undefined) {
      member.lastActiveAt = data.lastActiveAt ? new Date(data.lastActiveAt) : undefined;
    }
    if (data.departureReason !== undefined) {
      member.departureReason = data.departureReason || undefined;
    }

    const saved = await this.memberRepo.save(member);

    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'TEAM_MEMBER_UPDATED',
      message: `Member updated in team: ${memberId}`,
      organizationId,
      resource: `team/${teamId}/member/${memberId}`,
      metadata: {
        teamId,
        memberId,
        updatedFields: Object.keys(data),
      },
    });

    return saved;
  }

  async removeMember(organizationId: string, teamId: string, memberId: string): Promise<void> {
    logger.info('TeamService.removeMember', { organizationId, teamId, memberId });

    const member = await this.memberRepo.findOne({
      where: { id: memberId, organizationId, teamId },
    });
    if (!member) {
      throw new NotFoundError('Team member');
    }

    // Fetch team name for the event before updating
    const team = await this.findById(organizationId, teamId);

    member.status = 'removed';
    member.leftAt = new Date();
    await this.memberRepo.save(member);

    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'TEAM_MEMBER_REMOVED',
      message: `Member removed from team: ${member.userId}`,
      organizationId,
      resource: `team/${teamId}/member/${memberId}`,
      metadata: {
        teamId,
        userId: member.userId,
        memberName: member.rank,
      },
    });

    domainEvents.emit('team:member_removed', {
      teamId,
      organizationId,
      userId: member.userId,
      teamName: team?.name ?? 'Unknown',
      timestamp: new Date().toISOString(),
    });
  }

  // ── Advanced Member Queries ───────────────────────────────────────────────

  /**
   * Get team members with advanced filtering and pagination.
   * Mirrors SquadronService.getSquadronMembers for feature parity.
   */
  async getTeamMembersFiltered(
    organizationId: string,
    filters: TeamMemberFilterOptions
  ): Promise<PaginatedResponse<TeamMember>> {
    const queryBuilder = this.memberRepo
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('member.team', 'team')
      .where('member.organizationId = :organizationId', { organizationId });

    if (filters.teamId) {
      queryBuilder.andWhere('member.teamId = :teamId', { teamId: filters.teamId });
    }
    if (filters.userId) {
      queryBuilder.andWhere('member.userId = :userId', { userId: filters.userId });
    }
    if (filters.role) {
      queryBuilder.andWhere('member.role = :role', { role: filters.role });
    }
    if (filters.shipType) {
      queryBuilder.andWhere('member.shipType = :shipType', { shipType: filters.shipType });
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        queryBuilder.andWhere('member.status IN (:...statuses)', { statuses: filters.status });
      } else {
        queryBuilder.andWhere('member.status = :status', { status: filters.status });
      }
    }
    if (filters.joinedAfter) {
      queryBuilder.andWhere('member.joinedAt >= :joinedAfter', {
        joinedAfter: filters.joinedAfter,
      });
    }
    if (filters.joinedBefore) {
      queryBuilder.andWhere('member.joinedAt <= :joinedBefore', {
        joinedBefore: filters.joinedBefore,
      });
    }
    if (filters.lastActiveAfter) {
      queryBuilder.andWhere('member.lastActiveAt >= :lastActiveAfter', {
        lastActiveAfter: filters.lastActiveAfter,
      });
    }
    if (filters.lastActiveBefore) {
      queryBuilder.andWhere('member.lastActiveAt <= :lastActiveBefore', {
        lastActiveBefore: filters.lastActiveBefore,
      });
    }
    if (filters.searchTerm) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR member.role ILIKE :search OR member.shipType ILIKE :search)',
        { search: `%${filters.searchTerm}%` }
      );
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const sortBy = filters.sortBy || 'joinedAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`member.${sortBy}`, sortOrder);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get a specific team member by ID
   */
  async getTeamMemberById(organizationId: string, memberId: string): Promise<TeamMember | null> {
    return this.memberRepo.findOne({
      where: { organizationId, id: memberId },
      relations: ['user', 'team'],
    });
  }

  /**
   * Find all team memberships for a user
   */
  async findByUser(organizationId: string, userId: string): Promise<TeamMember[]> {
    return this.memberRepo.find({
      where: { organizationId, userId } as FindOptionsWhere<TeamMember>,
      relations: ['team'],
      order: { joinedAt: 'DESC' },
    });
  }

  /**
   * Check if user is a member of a team
   */
  async isMember(organizationId: string, teamId: string, userId: string): Promise<boolean> {
    const count = await this.memberRepo.count({
      where: { organizationId, teamId, userId } as FindOptionsWhere<TeamMember>,
    });
    return count > 0;
  }

  /**
   * Get membership record if it exists
   */
  async getMembership(
    organizationId: string,
    teamId: string,
    userId: string
  ): Promise<TeamMember | null> {
    const membership = await this.memberRepo.findOne({
      where: { organizationId, teamId, userId },
      relations: ['user', 'team'],
    });
    return membership || null;
  }

  // ── Ship Assignment & Auto-Nesting ──────────────────────────────────────

  /**
   * Assign a team (squadron/crew/platoon) to a ship.
   * If the ship is a capital (has a crew team), auto-nests this team under it.
   *
   * Example: Alpha Squadron stationed on Idris-1 → moves under the Idris crew team.
   * Example: Platoon assigned to a dropship/transport → moves under that transport's crew.
   *
   * @param organizationId - Organization scope
   * @param teamId - Team to assign (squadron, crew, or platoon)
   * @param shipId - Ship ID to station on
   * @param autoNest - If true, auto-move under the ship's crew team (default: true)
   */
  async assignTeamToShip(
    organizationId: string,
    teamId: string,
    shipId: string,
    autoNest: boolean = true
  ): Promise<Team> {
    logger.info('TeamService.assignTeamToShip', { organizationId, teamId, shipId });

    const team = await this.findById(organizationId, teamId);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Update ship assignment
    team.assignedShipId = shipId;
    await this.repository.save(team);

    // Auto-nest: find the crew team for this ship and move under it
    if (autoNest) {
      const crewTeam = await this.repository.findOne({
        where: {
          organizationId,
          assignedShipId: shipId,
          type: 'crew',
        },
      });

      if (crewTeam && crewTeam.id !== teamId) {
        await this.moveTeam(organizationId, teamId, crewTeam.id);
        logger.info('TeamService.assignTeamToShip — auto-nested under crew', {
          teamId,
          crewTeamId: crewTeam.id,
          shipId,
        });
      }
    }

    this.invalidateOrgCache(organizationId);
    return (await this.findById(organizationId, teamId))!;
  }

  /**
   * Remove ship assignment from a team.
   * Does NOT auto-move the team back — the admin decides where it goes.
   */
  async unassignTeamFromShip(organizationId: string, teamId: string): Promise<Team> {
    logger.info('TeamService.unassignTeamFromShip', { organizationId, teamId });

    const team = await this.findById(organizationId, teamId);
    if (!team) {
      throw new NotFoundError('Team');
    }

    team.assignedShipId = undefined;
    const saved = await this.repository.save(team);
    this.invalidateOrgCache(organizationId);
    return saved;
  }

  /**
   * Assign a team to a functional division (for dynamic fleet function grouping).
   * When a fleet has a function (mining/salvage), its crews and squadrons
   * can be moved under the appropriate org division (T&I, Security, R&D, etc.).
   *
   * @param organizationId - Organization scope
   * @param teamId - Team to assign
   * @param divisionId - Target division team ID
   * @param autoNest - If true, auto-move under the division (default: true)
   */
  async assignTeamToDivision(
    organizationId: string,
    teamId: string,
    divisionId: string,
    autoNest: boolean = true
  ): Promise<Team> {
    logger.info('TeamService.assignTeamToDivision', { organizationId, teamId, divisionId });

    const team = await this.findById(organizationId, teamId);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const division = await this.findById(organizationId, divisionId);
    if (!division) {
      throw new NotFoundError('Division');
    }

    team.assignedDivisionId = divisionId;
    await this.repository.save(team);

    if (autoNest) {
      await this.moveTeam(organizationId, teamId, divisionId);
      logger.info('TeamService.assignTeamToDivision — auto-nested under division', {
        teamId,
        divisionId,
        divisionName: division.name,
      });
    }

    this.invalidateOrgCache(organizationId);
    return (await this.findById(organizationId, teamId))!;
  }

  /**
   * Populate a crew team's members from the ship's CrewAssignment.
   * Copies crew members from the ship's active CrewAssignment into the team.
   *
   * @param organizationId - Organization scope
   * @param crewTeamId - The crew team to populate
   * @param shipId - Ship whose crew assignment to pull from
   */
  async populateCrewFromAssignment(
    organizationId: string,
    crewTeamId: string,
    shipId: string
  ): Promise<{ added: number; skipped: number }> {
    logger.info('TeamService.populateCrewFromAssignment', { organizationId, crewTeamId, shipId });

    const crewAssignmentRepo = AppDataSource.getRepository(CrewAssignment);
    const assignment = await crewAssignmentRepo.findOne({
      where: {
        organizationId,
        shipId,
        status: AssignmentStatus.ACTIVE,
      },
    });

    if (!assignment) {
      return { added: 0, skipped: 0 };
    }

    const crew = assignment.crew || [];
    let added = 0;
    let skipped = 0;

    for (const member of crew) {
      try {
        await this.addMember(organizationId, crewTeamId, member.userId, 'member', {
          specialization: member.role,
        });
        added++;
      } catch {
        // Already in team or team full
        skipped++;
      }
    }

    logger.info('TeamService.populateCrewFromAssignment — done', {
      crewTeamId,
      shipId,
      added,
      skipped,
    });
    return { added, skipped };
  }

  // ── Bulk Operations ──────────────────────────────────────────────────────

  /**
   * Bulk add multiple team members with transaction support
   */
  async bulkAddMembers(
    organizationId: string,
    teamId: string,
    members: Array<{
      userId: string;
      role?: TeamMemberRole;
      rank?: string;
      shipType?: string;
      specialization?: string;
      certifications?: string[];
      additionalRoles?: string[];
    }>
  ): Promise<TeamMember[]> {
    if (members.length === 0) {
      throw new ValidationError('No members provided for bulk add');
    }
    if (members.length > 100) {
      throw new ValidationError('Cannot add more than 100 members in a single bulk operation');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const created: TeamMember[] = [];

      for (const memberData of members) {
        const member = this.memberRepo.create({
          organizationId,
          teamId,
          userId: memberData.userId,
          role: memberData.role || 'member',
          status: 'active' as TeamMemberStatus,
          joinedAt: new Date(),
          ...(memberData.rank !== undefined && { rank: memberData.rank }),
          ...(memberData.shipType !== undefined && { shipType: memberData.shipType }),
          ...(memberData.specialization !== undefined && {
            specialization: memberData.specialization,
          }),
          ...(memberData.certifications !== undefined && {
            certifications: memberData.certifications,
          }),
          ...(memberData.additionalRoles !== undefined && {
            additionalRoles: memberData.additionalRoles,
          }),
        });
        const saved = await queryRunner.manager.save(member);
        created.push(saved);
      }

      await queryRunner.commitTransaction();
      logger.info(`Bulk added ${created.length} members to team ${teamId}`, { organizationId });
      return created;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Bulk add team members failed, transaction rolled back', {
        error,
        organizationId,
        teamId,
        count: members.length,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk update multiple team members with transaction support
   */
  async bulkUpdateMembers(
    organizationId: string,
    updates: Array<{
      id: string;
      data: Partial<
        Pick<
          TeamMember,
          | 'role'
          | 'status'
          | 'rank'
          | 'shipType'
          | 'specialization'
          | 'stats'
          | 'certifications'
          | 'additionalRoles'
          | 'lastActiveAt'
          | 'departureReason'
        >
      >;
    }>
  ): Promise<TeamMember[]> {
    if (updates.length === 0) {
      throw new ValidationError('No updates provided for bulk update');
    }
    if (updates.length > 100) {
      throw new ValidationError('Cannot update more than 100 members in a single bulk operation');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updated: TeamMember[] = [];

      for (const { id, data } of updates) {
        const member = await queryRunner.manager.findOne(TeamMember, {
          where: { id, organizationId },
        });
        if (!member) {
          throw new NotFoundError('Team member', id);
        }

        Object.assign(member, data);
        const saved = await queryRunner.manager.save(member);
        updated.push(saved);
      }

      await queryRunner.commitTransaction();
      logger.info(`Bulk updated ${updated.length} team members`, { organizationId });
      return updated;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Bulk update team members failed, transaction rolled back', {
        error,
        organizationId,
        count: updates.length,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk delete (soft-remove) multiple team members
   */
  async bulkDeleteMembers(
    organizationId: string,
    teamId: string,
    memberIds: string[]
  ): Promise<void> {
    if (memberIds.length === 0) {
      throw new ValidationError('No member IDs provided for bulk delete');
    }
    if (memberIds.length > 100) {
      throw new ValidationError('Cannot delete more than 100 members in a single bulk operation');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(
        TeamMember,
        {
          id: In(memberIds),
          organizationId,
          teamId,
        },
        {
          status: 'removed',
          leftAt: new Date(),
        }
      );

      await queryRunner.commitTransaction();
      logger.info(`Bulk soft-deleted ${memberIds.length} team members`, { organizationId, teamId });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Bulk delete team members failed, transaction rolled back', {
        error,
        organizationId,
        count: memberIds.length,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk update status for multiple team members
   */
  async bulkUpdateStatus(
    organizationId: string,
    teamId: string,
    memberIds: string[],
    status: TeamMemberStatus
  ): Promise<void> {
    if (memberIds.length === 0) {
      throw new ValidationError('No member IDs provided for bulk status update');
    }
    if (memberIds.length > 100) {
      throw new ValidationError(
        'Cannot update status for more than 100 members in a single bulk operation'
      );
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const setData: Record<string, unknown> = { status };
      if (status === 'removed') {
        setData.leftAt = new Date();
      }

      await queryRunner.manager
        .createQueryBuilder()
        .update(TeamMember)
        .set(setData)
        .where({ id: In(memberIds), organizationId, teamId })
        .execute();

      await queryRunner.commitTransaction();
      logger.info(`Bulk updated status to ${status} for ${memberIds.length} team members`, {
        organizationId,
        teamId,
      });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Bulk status update failed, transaction rolled back', {
        error,
        organizationId,
        status,
        count: memberIds.length,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Member Statistics ────────────────────────────────────────────────────

  /**
   * Get total count of team members
   */
  async getTeamMemberCount(organizationId: string, teamId: string): Promise<number> {
    return this.memberRepo.count({
      where: { organizationId, teamId } as FindOptionsWhere<TeamMember>,
    });
  }

  /**
   * Get count of active team members
   */
  async getActiveCount(organizationId: string, teamId: string): Promise<number> {
    return this.memberRepo.count({
      where: {
        organizationId,
        teamId,
        status: 'active',
      } as FindOptionsWhere<TeamMember>,
    });
  }

  /**
   * Get member count grouped by role
   */
  async getMembersByRole(organizationId: string, teamId: string): Promise<Record<string, number>> {
    const members = await this.memberRepo.find({
      where: { organizationId, teamId } as FindOptionsWhere<TeamMember>,
      select: ['role'],
    });
    return members.reduce(
      (acc: Record<string, number>, member: TeamMember) => {
        if (member.role) {
          acc[member.role] = (acc[member.role] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Get member count grouped by ship type
   */
  async getMembersByShipType(
    organizationId: string,
    teamId: string
  ): Promise<Record<string, number>> {
    const members = await this.memberRepo.find({
      where: { organizationId, teamId } as FindOptionsWhere<TeamMember>,
      select: ['shipType'],
    });
    return members.reduce(
      (acc: Record<string, number>, member: TeamMember) => {
        if (member.shipType) {
          acc[member.shipType] = (acc[member.shipType] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Get team statistics (total members + breakdown by role)
   */
  async getTeamStatistics(
    organizationId: string,
    teamId: string
  ): Promise<{ totalMembers: number; byRole: Record<string, number> }> {
    const members = await this.getTeamMembers(organizationId, teamId);
    const stats = {
      totalMembers: members.length,
      byRole: {} as Record<string, number>,
    };
    for (const member of members) {
      const role = member.role || 'unknown';
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
    }
    return stats;
  }

  /**
   * Get user's team membership count
   */
  async getUserTeamCount(organizationId: string, userId: string): Promise<number> {
    return this.memberRepo.count({
      where: { organizationId, userId } as FindOptionsWhere<TeamMember>,
    });
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async getTeamsByOrg(organizationId: string): Promise<Team[]> {
    return this.repository.find({
      where: { organizationId },
      order: { level: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getTeamById(organizationId: string, teamId: string): Promise<Team | null> {
    return this.findById(organizationId, teamId);
  }

  async getRootTeams(organizationId: string): Promise<Team[]> {
    return this.repository.find({
      where: { organizationId, parentTeamId: IsNull() },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Remove a user from all teams in an organization.
   * Used by cascading cleanup when a member leaves the platform.
   * Returns the number of team memberships removed.
   */
  async removeUserFromAllTeams(organizationId: string, userId: string): Promise<number> {
    logger.info('TeamService.removeUserFromAllTeams', { organizationId, userId });

    const activeMembers = await this.memberRepo.find({
      where: { organizationId, userId, status: 'active' as TeamMemberStatus },
      relations: ['team'],
    });

    if (activeMembers.length === 0) {
      return 0;
    }

    const now = new Date();
    const timestamp = now.toISOString();

    for (const member of activeMembers) {
      member.status = 'removed';
      member.leftAt = now;
      await this.memberRepo.save(member);

      domainEvents.emit('team:member_removed', {
        teamId: member.teamId,
        organizationId,
        userId,
        teamName: member.team?.name ?? 'Unknown',
        reason: 'platform_left',
        timestamp,
      });
    }

    return activeMembers.length;
  }
}
