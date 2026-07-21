import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  FederationTeam,
  FederationTeamMember,
  FederationTeamStatus,
  FederationTeamType,
} from '../../models/FederationTeam';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationPermission, requireFederationViewAccess } from './federationPermissions';

// ─── Data Interface ───────────────────────────────────────────

export interface FederationTeamData {
  id: string;
  federationId: string;
  name: string;
  description: string | null;
  type: FederationTeamType;
  leaderId: string | null;
  leaderName: string | null;
  leaderOrgId: string | null;
  members: FederationTeamMember[];
  memberCount: number;
  status: FederationTeamStatus;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * FederationTeamService
 *
 * Manages cross-org operational teams within a federation.
 * Ambassadors with 'hr' permission can create/manage teams.
 * Team members are drawn from any member org's user pool.
 */
export class FederationTeamService {
  private static instance: FederationTeamService;
  private readonly teamRepository: Repository<FederationTeam>;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.teamRepository = AppDataSource.getRepository(FederationTeam);
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationTeamService {
    if (!FederationTeamService.instance) {
      FederationTeamService.instance = new FederationTeamService();
    }
    return FederationTeamService.instance;
  }

  // ─── Helpers ───────────────────────────────────────────────

  private toData(entity: FederationTeam): FederationTeamData {
    return {
      id: entity.id,
      federationId: entity.federationId,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      leaderId: entity.leaderId,
      leaderName: entity.leaderName,
      leaderOrgId: entity.leaderOrgId,
      members: entity.members ?? [],
      memberCount: entity.members?.length ?? 0,
      status: entity.status,
      maxMembers: entity.maxMembers,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private async requireHRPermission(federationId: string, userId: string): Promise<void> {
    return requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'hr',
      'Ambassador HR permission required to manage federation teams'
    );
  }

  private async requireViewAccess(federationId: string, userId: string): Promise<void> {
    return requireFederationViewAccess(
      this.ambassadorService,
      federationId,
      userId,
      'federation teams'
    );
  }

  // ─── CRUD ─────────────────────────────────────────────────

  /**
   * Create a federation team.
   */
  async createTeam(
    federationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      type?: FederationTeamType;
      maxMembers?: number;
      leaderId?: string;
      leaderName?: string;
      leaderOrgId?: string;
    }
  ): Promise<FederationTeamData> {
    await this.requireHRPermission(federationId, userId);

    if (!data.name?.trim() || data.name.trim().length < 2) {
      throw new ValidationError('Team name must be at least 2 characters');
    }

    // Check unique name within federation
    const existing = await this.teamRepository.findOne({
      where: { federationId, name: data.name.trim() },
    });
    if (existing) {
      throw new ValidationError(`A team named "${data.name.trim()}" already exists`);
    }

    const team = this.teamRepository.create({
      federationId,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      type: data.type ?? 'task_force',
      maxMembers: data.maxMembers ?? 20,
      leaderId: data.leaderId ?? null,
      leaderName: data.leaderName ?? null,
      leaderOrgId: data.leaderOrgId ?? null,
      members: [],
      status: 'active',
    });

    const saved = await this.teamRepository.save(team);

    logger.info('Federation team created', {
      federationId,
      teamId: saved.id,
      name: saved.name,
    });

    return this.toData(saved);
  }

  /**
   * List federation teams.
   */
  async listTeams(federationId: string, userId: string): Promise<FederationTeamData[]> {
    await this.requireViewAccess(federationId, userId);

    const teams = await this.teamRepository.find({
      where: { federationId },
      order: { createdAt: 'DESC' },
    });

    return teams.map(t => this.toData(t));
  }

  /**
   * Get a single team.
   */
  async getTeam(federationId: string, userId: string, teamId: string): Promise<FederationTeamData> {
    await this.requireViewAccess(federationId, userId);

    const team = await this.teamRepository.findOne({
      where: { id: teamId, federationId },
    });
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    return this.toData(team);
  }

  /**
   * Update a federation team.
   */
  async updateTeam(
    federationId: string,
    userId: string,
    teamId: string,
    data: {
      name?: string;
      description?: string | null;
      type?: FederationTeamType;
      maxMembers?: number;
      leaderId?: string | null;
      leaderName?: string | null;
      leaderOrgId?: string | null;
      status?: FederationTeamStatus;
    }
  ): Promise<FederationTeamData> {
    await this.requireHRPermission(federationId, userId);

    const team = await this.teamRepository.findOne({
      where: { id: teamId, federationId },
    });
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    if (data.name !== undefined) {
      team.name = data.name.trim();
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
    if (data.leaderId !== undefined) {
      team.leaderId = data.leaderId;
    }
    if (data.leaderName !== undefined) {
      team.leaderName = data.leaderName;
    }
    if (data.leaderOrgId !== undefined) {
      team.leaderOrgId = data.leaderOrgId;
    }
    if (data.status !== undefined) {
      team.status = data.status;
    }

    const saved = await this.teamRepository.save(team);

    logger.info('Federation team updated', { federationId, teamId });

    return this.toData(saved);
  }

  /**
   * Add a member to a federation team.
   */
  async addMember(
    federationId: string,
    userId: string,
    teamId: string,
    member: FederationTeamMember
  ): Promise<FederationTeamData> {
    await this.requireHRPermission(federationId, userId);

    const team = await this.teamRepository.findOne({
      where: { id: teamId, federationId },
    });
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }
    if (team.status !== 'active') {
      throw new ValidationError('Cannot add members to a disbanded team');
    }
    if (team.members.length >= team.maxMembers) {
      throw new ValidationError(`Team is at maximum capacity (${team.maxMembers})`);
    }

    // Check duplicate
    if (team.members.some(m => m.userId === member.userId)) {
      throw new ValidationError('User is already a member of this team');
    }

    team.members = [...team.members, member];
    const saved = await this.teamRepository.save(team);

    logger.info('Federation team member added', {
      federationId,
      teamId,
      userId: member.userId,
    });

    return this.toData(saved);
  }

  /**
   * Remove a member from a federation team.
   */
  async removeMember(
    federationId: string,
    userId: string,
    teamId: string,
    memberUserId: string
  ): Promise<FederationTeamData> {
    await this.requireHRPermission(federationId, userId);

    const team = await this.teamRepository.findOne({
      where: { id: teamId, federationId },
    });
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    team.members = team.members.filter(m => m.userId !== memberUserId);
    const saved = await this.teamRepository.save(team);

    logger.info('Federation team member removed', {
      federationId,
      teamId,
      removedUserId: memberUserId,
    });

    return this.toData(saved);
  }

  /**
   * Delete (disband) a federation team.
   */
  async deleteTeam(federationId: string, userId: string, teamId: string): Promise<void> {
    await this.requireHRPermission(federationId, userId);

    const team = await this.teamRepository.findOne({
      where: { id: teamId, federationId },
    });
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    await this.teamRepository.remove(team);

    logger.info('Federation team deleted', { federationId, teamId });
  }
}

