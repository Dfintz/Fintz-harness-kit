/**
 * UnifiedParticipantService — Sprint 19-E
 *
 * Cross-system participation aggregator that unifies participant data
 * from Teams, Activities, Jobs, and LFG into a single view.
 *
 * Uses shared-types ParticipantInfo for normalized output.
 */

import {
  mapActivityRoleToSystemRoles,
  mapActivityStatusToParticipantStatus,
  type ParticipantInfo,
  type ParticipantLifecycleStatus,
  type ParticipationQuery,
  type ParticipationSummary,
  type ParticipationSystemType,
  type SystemParticipation,
  SystemRole,
} from '@sc-fleet-manager/shared-types';

import { AppDataSource } from '../../data-source';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { logger } from '../../utils/logger';
import { ActivityService } from '../activity/ActivityService';
import { JobApplicationService } from '../organization/JobApplicationService';
import { LFGSessionService } from '../social/LFGSessionService';
import { TeamService } from '../team/TeamService';

// Re-export types for backward compatibility
export type {
  ParticipationQuery,
  ParticipationSummary,
  ParticipationSystemType,
  SystemParticipation
} from '@sc-fleet-manager/shared-types';

// ── Service ─────────────────────────────────────────────────────────────

export class UnifiedParticipantService {
  private readonly teamService: TeamService;
  private readonly activityService: ActivityService;
  private readonly jobApplicationService: JobApplicationService;
  private readonly lfgSessionService: LFGSessionService;

  constructor(
    teamService?: TeamService,
    activityService?: ActivityService,
    jobApplicationService?: JobApplicationService,
    lfgSessionService?: LFGSessionService
  ) {
    this.teamService = teamService ?? new TeamService();
    this.activityService = activityService ?? new ActivityService();
    this.jobApplicationService = jobApplicationService ?? new JobApplicationService();
    this.lfgSessionService = lfgSessionService ?? new LFGSessionService();
  }

  /**
   * Get unified participation summary across all systems for a user.
   */
  async getUserParticipationSummary(query: ParticipationQuery): Promise<ParticipationSummary> {
    const { userId, systems } = query;
    const enabledSystems = systems ?? ['team', 'activity', 'job', 'lfg'];

    const systemResults = await Promise.allSettled(
      enabledSystems.map(system => this.getSystemParticipation(system, query))
    );

    const systemParticipations: SystemParticipation[] = systemResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      logger.warn(`Failed to fetch ${enabledSystems[index]} participation for user ${userId}`, {
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      return {
        system: enabledSystems[index],
        participants: [],
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    });

    return this.buildSummary(userId, systemParticipations);
  }

  // ── System Dispatchers ──────────────────────────────────────────────

  private async getSystemParticipation(
    system: ParticipationSystemType,
    query: ParticipationQuery
  ): Promise<SystemParticipation> {
    switch (system) {
      case 'team':
        return this.getTeamParticipation(query);
      case 'activity':
        return this.getActivityParticipation(query);
      case 'job':
        return this.getJobParticipation(query);
      case 'lfg':
        return this.getLfgParticipation(query);
    }
  }

  // ── Team System ─────────────────────────────────────────────────────

  private async getTeamParticipation(query: ParticipationQuery): Promise<SystemParticipation> {
    const { userId, organizationId } = query;

    if (!organizationId) {
      return { system: 'team', participants: [] };
    }

    const members = await this.teamService.findByUser(organizationId, userId);
    const participants = members.map(member => TeamService.toParticipantInfo(member));

    return { system: 'team', participants };
  }

  // ── Activity System ─────────────────────────────────────────────────

  private async getActivityParticipation(query: ParticipationQuery): Promise<SystemParticipation> {
    const { userId, organizationIds } = query;
    const orgIds = organizationIds ?? (query.organizationId ? [query.organizationId] : []);

    // Query normalized activity_participants table directly (Phase 4)
    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
    const qb = participantRepo
      .createQueryBuilder('ap')
      .innerJoinAndSelect('ap.activity', 'activity')
      .where('ap."userId" = :userId', { userId });

    if (orgIds.length > 0) {
      qb.andWhere('activity."organizationId" IN (:...orgIds)', { orgIds });
    }

    const participantRows = await qb.getMany();

    const participants: ParticipantInfo[] = participantRows.map(row => {
      const roles = mapActivityRoleToSystemRoles(row.role);
      const status: ParticipantLifecycleStatus = mapActivityStatusToParticipantStatus(row.status);
      const act = row.activity as { organizationId?: string; title?: string; activityType?: string } | undefined;

      return {
        userId: row.userId,
        organizationId: row.organizationId ?? act?.organizationId ?? '',
        username: row.userName,
        roles,
        status,
        joinedAt: row.joinedAt,
        source: 'manual' as const,
        metadata: {
          activityId: row.activityId,
          activityTitle: act?.title,
          activityType: act?.activityType,
          role: row.role,
          shipType: row.shipType,
          crewPosition: row.crewPosition,
        },
      };
    });

    return { system: 'activity', participants };
  }

  // ── Job System ──────────────────────────────────────────────────────

  private async getJobParticipation(query: ParticipationQuery): Promise<SystemParticipation> {
    const { userId } = query;
    const applications = await this.jobApplicationService.getApplicationsByUser(userId);
    const participants = applications.map(app => JobApplicationService.toParticipantInfo(app));

    return { system: 'job', participants };
  }

  // ── LFG System ──────────────────────────────────────────────────────

  private async getLfgParticipation(query: ParticipationQuery): Promise<SystemParticipation> {
    const { userId } = query;
    const [userSessions, hostedSessions] = await Promise.all([
      this.lfgSessionService.getUserSessions(userId),
      this.lfgSessionService.getHostedSessions(userId),
    ]);

    // Merge and deduplicate (host may also appear in user sessions)
    const sessionMap = new Map<string, (typeof userSessions)[0]>();
    for (const session of [...userSessions, ...hostedSessions]) {
      sessionMap.set(session.id, session);
    }

    const participants = Array.from(sessionMap.values()).map(session =>
      LFGSessionService.toParticipantInfo(userId, session)
    );

    return { system: 'lfg', participants };
  }

  // ── Summary Builder ─────────────────────────────────────────────────

  private buildSummary(userId: string, systems: SystemParticipation[]): ParticipationSummary {
    const allParticipants = systems.flatMap(s => s.participants);
    const roleSet = new Set<SystemRole>();
    let activeCount = 0;
    let pendingCount = 0;

    for (const p of allParticipants) {
      for (const role of p.roles) {
        roleSet.add(role);
      }
      if (p.status === 'active') {
        activeCount++;
      }
      if (p.status === 'pending' || p.status === 'invited' || p.status === 'waitlisted') {
        pendingCount++;
      }
    }

    return {
      userId,
      totalParticipations: allParticipants.length,
      systems,
      activeCount,
      pendingCount,
      allRoles: Array.from(roleSet),
    };
  }
}

