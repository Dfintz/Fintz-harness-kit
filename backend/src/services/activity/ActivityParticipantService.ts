import crypto from 'node:crypto';

import { AppDataSource } from '../../data-source';
import {
  Activity,
  ActivityParticipant,
  ParticipantRole,
  ShipAssignment,
} from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import {
  ActivityFullError,
  ActivityNotFoundError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import {
  emitParticipantJoined,
  emitParticipantLeft,
} from '../../websocket/controllers/activityWebSocketController';
import { TenantService } from '../base/TenantService';

import { ActivityAuditAction, activityAuditLogger } from './ActivityAuditLogger';
import { RouteCalculationService } from './RouteCalculationService';

export interface JoinActivityDTO {
  userId: string;
  userName: string;
  organizationId?: string;
  organizationName?: string;
  role?: ParticipantRole;
  shipId?: string;
  shipType?: string;
  shipName?: string;
  crewPosition?: string;
  crewShipId?: string;
  notes?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ShipDTO {
  shipType: string;
  shipName: string;
  captainId: string;
  captainName: string;
  maxCrew?: number;
  currentCrew?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface AvailableCrewPosition {
  activityId: string;
  shipId: string;
  shipName: string;
  shipType: string;
  position: string;
  available: boolean;
  requirements?: string[];
}

/**
 * ActivityParticipantService
 *
 * Handles participant management for activities
 * Phase 4.1 - Domain Separation
 *
 * Responsibilities:
 * - Join/leave activities
 * - Ship management and crew assignments
 * - Participant role management
 * - Organization invitations and participation
 *
 * @author GitHub Copilot
 * @since October 2025
 */
export class ActivityParticipantService extends TenantService<Activity> {
  private readonly participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
  private _routeCalcService?: RouteCalculationService;
  private get routeCalcService(): RouteCalculationService {
    this._routeCalcService ??= new RouteCalculationService();
    return this._routeCalcService;
  }

  constructor() {
    super(AppDataSource.getRepository(Activity));
  }

  private async findActivityById(activityId: string): Promise<Activity | null> {
    return this.repository
      .createQueryBuilder('activity')
      .where('activity.id = :activityId', { activityId })
      .getOne();
  }

  private async findParticipantByActivityAndUser(
    activityId: string,
    userId: string
  ): Promise<ActivityParticipantEntity | null> {
    return this.participantRepo
      .createQueryBuilder('participant')
      .where('participant.activityId = :activityId', { activityId })
      .andWhere('participant.userId = :userId', { userId })
      .getOne();
  }

  // ==================== NORMALIZED TABLE METHODS (Phase 4) ====================
  // These methods use the activity_participants table directly.
  // Used by new code; existing JSON-based methods below still work for backward compat.

  /**
   * Check if a user is a participant in an activity (normalized table lookup)
   * O(1) indexed query instead of loading full activity + JSON parse + array.find()
   */
  async isParticipant(activityId: string, userId: string): Promise<boolean> {
    const count = await this.participantRepo.count({
      where: { activityId, userId },
    });
    return count > 0;
  }

  /**
   * Get participant count for an activity using the normalized table
   */
  async getParticipantCount(
    activityId: string,
    status?: ActivityParticipantStatus
  ): Promise<number> {
    const where: Record<string, unknown> = { activityId };
    if (status) {
      where.status = status;
    }
    return this.participantRepo.count({ where });
  }

  /**
   * Get all participants for an activity from the normalized table
   */
  async getParticipants(
    activityId: string,
    status?: ActivityParticipantStatus
  ): Promise<ActivityParticipantEntity[]> {
    const queryBuilder = this.participantRepo
      .createQueryBuilder('participant')
      .where('participant.activityId = :activityId', { activityId });

    if (status) {
      queryBuilder.andWhere('participant.status = :status', { status });
    }

    return queryBuilder.orderBy('participant.joinedAt', 'ASC').getMany();
  }

  /**
   * Get all activities a user is participating in (normalized table)
   * This query was IMPOSSIBLE with the JSON column approach.
   */
  async getUserActivities(userId: string): Promise<ActivityParticipantEntity[]> {
    return this.participantRepo
      .createQueryBuilder('participant')
      .where('participant.userId = :userId', { userId })
      .orderBy('participant.joinedAt', 'DESC')
      .getMany();
  }

  /**
   * Get a single participant record from the normalized table.
   * Returns null if the user is not a participant.
   */
  async getParticipant(
    activityId: string,
    userId: string
  ): Promise<ActivityParticipantEntity | null> {
    return this.findParticipantByActivityAndUser(activityId, userId);
  }

  /**
   * Check if a user has a LEADER role in an activity (normalized table query).
   */
  async isLeader(activityId: string, userId: string): Promise<boolean> {
    const count = await this.participantRepo.count({
      where: { activityId, userId, role: ParticipantRole.LEADER },
    });
    return count > 0;
  }

  /**
   * Check whether a user can manage activity-level orchestration operations.
   * Leaders and organizers can issue external orchestration commands.
   */
  async canManageActivity(activityId: string, userId: string): Promise<boolean> {
    const participant = await this.findParticipantByActivityAndUser(activityId, userId);
    if (!participant) {
      return false;
    }

    if (participant.status !== ActivityParticipantStatus.ACCEPTED) {
      return false;
    }

    return (
      participant.role === ParticipantRole.LEADER ||
      participant.role === ParticipantRole.CO_LEADER ||
      participant.role === ParticipantRole.COMMANDER
    );
  }

  /**
   * Update a participant's fields in the normalized table (e.g., ship/crew assignment).
   */
  async updateParticipant(
    activityId: string,
    userId: string,
    updates: Partial<
      Pick<
        ActivityParticipantEntity,
        | 'shipId'
        | 'shipType'
        | 'shipName'
        | 'crewPosition'
        | 'crewShipId'
        | 'role'
        | 'status'
        | 'notes'
      >
    >
  ): Promise<number> {
    const result = await this.participantRepo.update({ activityId, userId }, updates);
    return result.affected ?? 0;
  }

  /**
   * Invite members to an activity by creating participant rows with status
   * INVITED. Members who are already participants (any status) are skipped so
   * an invite never overwrites an existing RSVP. Invitees accept or decline via
   * the normal RSVP flow.
   *
   * @returns the user IDs that were newly invited and those skipped.
   */
  async inviteMembers(
    activityId: string,
    members: Array<{
      userId: string;
      userName: string;
      organizationId?: string;
      organizationName?: string;
    }>
  ): Promise<{ invited: string[]; skipped: string[] }> {
    const invited: string[] = [];
    const skipped: string[] = [];

    for (const member of members) {
      const existing = await this.findParticipantByActivityAndUser(activityId, member.userId);
      if (existing) {
        skipped.push(member.userId);
        continue;
      }

      const row = this.participantRepo.create({
        activityId,
        userId: member.userId,
        userName: member.userName,
        organizationId: member.organizationId,
        organizationName: member.organizationName,
        role: ParticipantRole.MEMBER,
        status: ActivityParticipantStatus.INVITED,
        joinedAt: new Date(),
      });
      await this.participantRepo.save(row);
      invited.push(member.userId);
    }

    return { invited, skipped };
  }

  /**
   * Sync a participant to the normalized table (dual-write helper).
   * Called after any JSON-based participant mutation to keep the table in sync.
   */
  async syncParticipantToTable(
    activityId: string,
    participant: ActivityParticipant
  ): Promise<void> {
    // Use INSERT ... ON CONFLICT UPDATE for atomic upsert (no findOne+save race)
    await this.participantRepo
      .createQueryBuilder()
      .insert()
      .into(ActivityParticipantEntity)
      .values({
        activityId,
        userId: participant.userId,
        userName: participant.userName,
        avatarUrl: participant.avatarUrl,
        organizationId: participant.organizationId,
        organizationName: participant.organizationName,
        role: participant.role,
        status: participant.status as ActivityParticipantStatus,
        joinedAt:
          participant.joinedAt instanceof Date
            ? participant.joinedAt
            : new Date(participant.joinedAt),
        shipType: participant.shipType,
        shipName: participant.shipName,
        shipId: participant.shipId,
        crewPosition: participant.crewPosition,
        crewShipId: participant.crewShipId,
        reputation: participant.reputation,
        notes: participant.notes,
        message: participant.message,
      })
      .orUpdate(
        [
          'userName',
          'avatarUrl',
          'organizationId',
          'organizationName',
          'role',
          'status',
          'shipType',
          'shipName',
          'shipId',
          'crewPosition',
          'crewShipId',
          'reputation',
          'notes',
          'message',
          'updatedAt',
        ],
        ['activityId', 'userId']
      )
      .execute();
  }

  /**
   * Remove a participant from the normalized table (dual-write helper).
   */
  async removeParticipantFromTable(activityId: string, userId: string): Promise<void> {
    await this.participantRepo.delete({ activityId, userId });
  }

  // ==================== PARTICIPANT MANAGEMENT ====================

  /**
   * Join an activity as a participant, or update ship/role if already joined.
   * Primary: writes to normalized `activity_participants` table.
   * Secondary: syncs to JSON column for backward compatibility.
   */
  async joinActivity(
    activityId: string,
    dto: JoinActivityDTO
  ): Promise<{ activity: Activity; wasUpdate: boolean }> {
    let wasUpdate = false;
    let effectiveRole: ParticipantRole = dto.role ?? ParticipantRole.MEMBER;

    const savedActivity = await this.withEntityLock(
      activityId,
      async (activity, queryRunner) => {
        const activityRepo = queryRunner.manager.getRepository(Activity);
        const participantRepo = queryRunner.manager.getRepository(ActivityParticipantEntity);

        const existingRow = await participantRepo
          .createQueryBuilder('participant')
          .where('participant.activityId = :activityId', { activityId })
          .andWhere('participant.userId = :userId', { userId: dto.userId })
          .getOne();

        const now = new Date();

        if (existingRow) {
          wasUpdate = true;
          effectiveRole = dto.role ?? existingRow.role;

          await participantRepo.update(
            { activityId, userId: dto.userId },
            {
              role: effectiveRole,
              shipId: dto.shipId ?? existingRow.shipId,
              shipType: dto.shipType ?? existingRow.shipType,
              shipName: dto.shipName ?? existingRow.shipName,
              crewPosition: dto.crewPosition ?? existingRow.crewPosition,
              notes: dto.notes ?? existingRow.notes,
              message: dto.message ?? existingRow.message,
            }
          );

          activity.updatedAt = now;
          return activityRepo.save(activity);
        }

        if (activity.maxParticipants) {
          const acceptedCount = await participantRepo.count({
            where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
          });

          if (acceptedCount >= activity.maxParticipants) {
            throw new ActivityFullError('Activity has reached maximum participants');
          }
        }

        const newRow = participantRepo.create({
          activityId,
          userId: dto.userId,
          userName: dto.userName,
          organizationId: dto.organizationId,
          organizationName: dto.organizationName,
          role: effectiveRole,
          status: ActivityParticipantStatus.ACCEPTED,
          joinedAt: now,
          shipId: dto.shipId,
          shipType: dto.shipType,
          shipName: dto.shipName,
          crewPosition: dto.crewPosition,
          notes: dto.notes,
          message: dto.message,
          metadata: dto.metadata,
        });
        await participantRepo.save(newRow);

        activity.currentParticipants = await participantRepo.count({
          where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
        });
        activity.updatedAt = now;

        return activityRepo.save(activity);
      },
      { onNotFound: () => new ActivityNotFoundError('activity') }
    );

    activityAuditLogger.log({
      action: ActivityAuditAction.PARTICIPANT_JOINED,
      activityId,
      activityTitle: savedActivity.title,
      activityType: savedActivity.activityType,
      organizationId: savedActivity.organizationId ?? '',
      performedById: dto.userId,
      performedByName: dto.userName,
      details: wasUpdate
        ? { updated: true, role: effectiveRole, shipType: dto.shipType }
        : {
            role: effectiveRole,
            organizationId: dto.organizationId,
            organizationName: dto.organizationName,
            shipType: dto.shipType,
            currentParticipants: savedActivity.currentParticipants,
            maxParticipants: savedActivity.maxParticipants,
          },
    });

    if (wasUpdate) {
      logger.info(`User ${dto.userId} updated participation in activity ${activityId}`);
      return { activity: savedActivity, wasUpdate: true };
    }

    logger.info(`User ${dto.userId} joined activity ${activityId}`);

    if (savedActivity.organizationId) {
      emitParticipantJoined(
        savedActivity.organizationId,
        activityId,
        { userId: dto.userId, userName: dto.userName, role: effectiveRole },
        dto.userId
      );
    }

    return { activity: savedActivity, wasUpdate: false };
  }

  /**
   * Leave an activity.
   * Primary: removes from normalized `activity_participants` table.
   * Secondary: syncs removal to JSON column for backward compatibility.
   *
   * Runs in a transaction with a `pessimistic_write` lock on the activity row so the
   * participant delete and the `currentParticipants` recount are atomic and cannot race
   * with a concurrent join/leave on the same activity.
   */
  async leaveActivity(activityId: string, userId: string): Promise<Activity> {
    let leavingUserName: string | undefined;
    let previousCount = 0;

    const savedActivity = await this.withEntityLock(
      activityId,
      async (activity, queryRunner) => {
        const activityRepo = queryRunner.manager.getRepository(Activity);
        const participantRepo = queryRunner.manager.getRepository(ActivityParticipantEntity);

        // Cannot leave if you're the creator
        if (activity.creatorId === userId) {
          throw new ForbiddenError('Activity creator cannot leave their own activity');
        }

        // Check membership via normalized table (indexed lookup)
        const participantRow = await participantRepo
          .createQueryBuilder('participant')
          .where('participant.activityId = :activityId', { activityId })
          .andWhere('participant.userId = :userId', { userId })
          .getOne();
        if (!participantRow) {
          throw new ValidationError('User is not a participant in this activity');
        }

        leavingUserName = participantRow.userName ?? userId;
        previousCount = activity.currentParticipants;

        // Remove from normalized table (primary)
        await participantRepo.delete({ activityId, userId });

        // Recompute the accepted count from the normalized table under the row lock so the
        // cached value stays accurate even under concurrent join/leave.
        activity.currentParticipants = await participantRepo.count({
          where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
        });
        activity.updatedAt = new Date();

        // Also remove from any ships they might be crewing
        if (activity.ships) {
          for (const ship of activity.ships) {
            if (ship.crew) {
              ship.crew = ship.crew.filter(crewMember => crewMember.userId !== userId);
              ship.currentCrew = ship.crew.length;
            }
          }
        }

        return activityRepo.save(activity);
      },
      { onNotFound: () => new ActivityNotFoundError('activity') }
    );

    activityAuditLogger.log({
      action: ActivityAuditAction.PARTICIPANT_LEFT,
      activityId,
      activityTitle: savedActivity.title,
      activityType: savedActivity.activityType,
      organizationId: savedActivity.organizationId ?? '',
      performedById: userId,
      performedByName: leavingUserName ?? userId,
      details: {
        previousParticipantCount: previousCount,
        currentParticipants: savedActivity.currentParticipants,
      },
    });

    logger.info(`User ${userId} left activity ${activityId}`);

    if (savedActivity.organizationId) {
      emitParticipantLeft(savedActivity.organizationId, activityId, userId, userId);
    }

    return savedActivity;
  }

  // ==================== SHIP MANAGEMENT ====================

  /**
   * Add a ship to an activity
   */
  async addShip(activityId: string, userId: string, shipDto: ShipDTO): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Check if user is a participant (normalized table — indexed lookup)
    if (!(await this.isParticipant(activityId, userId))) {
      throw new ForbiddenError('Only activity participants can add ships');
    }

    // Create ship assignment
    const ship: ShipAssignment = {
      id: `ship_${crypto.randomUUID()}`,
      shipType: shipDto.shipType,
      shipName: shipDto.shipName,
      ownerId: userId,
      ownerName: shipDto.captainName || 'Unknown',
      captainId: shipDto.captainId,
      captainName: shipDto.captainName,
      role: 'other',
      crewCapacity: shipDto.maxCrew ?? 1,
      crewAssigned: 1,
      maxCrew: shipDto.maxCrew ?? 1,
      currentCrew: 1, // Captain counts as crew
      description: shipDto.description,
      metadata: shipDto.metadata ?? {},
      capabilities: [],
      status: 'assigned',
      crewMembers: [
        {
          userId: shipDto.captainId,
          userName: shipDto.captainName,
          position: 'Captain',
        },
      ],
      crew: [
        {
          userId: shipDto.captainId,
          userName: shipDto.captainName,
          position: 'Captain',
        },
      ],
    };

    // Add ship to activity
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.ships = [...(activity.ships ?? []), ship];
    activity.updatedAt = new Date();

    // Enrich ship with catalogue data (SCU, fuel, hangar, etc.)
    await this.routeCalcService.enrichShipMetadata([ship]);

    // Recalculate fleet-level totals
    await this.routeCalcService.updateActivityRouteData(activity);

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.SHIP_ASSIGNED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: userId,
      performedByName: shipDto.captainName || 'Unknown',
      details: {
        shipId: ship.id,
        shipName: shipDto.shipName,
        shipType: shipDto.shipType,
        maxCrew: shipDto.maxCrew,
        captainId: shipDto.captainId,
        totalShips: updatedActivity.ships?.length ?? 0,
      },
    });

    logger.info(`Ship ${shipDto.shipName} added to activity ${activityId} by ${userId}`);
    return updatedActivity;
  }

  /**
   * Join a ship as crew member
   */
  async joinShipAsCrew(
    activityId: string,
    shipId: string,
    userId: string,
    userName: string,
    position: string
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Check if user is a participant (normalized table — indexed lookup)
    if (!(await this.isParticipant(activityId, userId))) {
      throw new ForbiddenError('Only activity participants can join ship crews');
    }

    // Find the ship
    const ship = activity.ships?.find(s => s.id === shipId);
    if (!ship) {
      throw new NotFoundError('Ship');
    }

    // Check if ship has space
    if ((ship.currentCrew ?? 0) >= (ship.maxCrew ?? 0)) {
      throw new ActivityFullError('Ship has reached maximum crew capacity');
    }

    // Check if user is already crew on this ship
    const isAlreadyCrew = ship.crew?.some(c => c.userId === userId);
    if (isAlreadyCrew) {
      throw new ConflictError('User is already crew on this ship');
    }

    // Add crew member
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    ship.crew = [
      ...(ship.crew ?? []),
      {
        userId,
        userName,
        position,
      },
    ];
    ship.currentCrew = ship.crew.length;
    activity.ships = activity.ships ? [...activity.ships] : activity.ships;
    activity.updatedAt = new Date();

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.CREW_JOINED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: userId,
      performedByName: userName,
      details: {
        shipId,
        shipName: ship.shipName,
        shipType: ship.shipType,
        position,
        currentCrew: ship.currentCrew,
        maxCrew: ship.maxCrew,
      },
    });

    logger.info(`User ${userId} joined ship ${shipId} in activity ${activityId} as ${position}`);
    return updatedActivity;
  }

  /**
   * Find and remove user from ship crew
   */
  private findAndRemoveFromCrew(
    activity: Activity,
    userId: string
  ): {
    shipId: string;
    shipName: string;
    shipType: string;
    position: string;
    userName: string;
  } | null {
    if (!activity.ships) {
      return null;
    }

    for (const ship of activity.ships) {
      if (!ship.crew) {
        continue;
      }
      const crewIndex = ship.crew.findIndex(c => c.userId === userId);
      if (crewIndex === -1) {
        continue;
      }
      if (ship.captainId === userId) {
        throw new ForbiddenError('Ship captain cannot leave crew without transferring captaincy');
      }
      const crewMember = ship.crew[crewIndex];
      const info = {
        shipId: ship.id ?? '',
        shipName: ship.shipName ?? '',
        shipType: ship.shipType,
        position: crewMember.position,
        userName: crewMember.userName,
      };
      // Spread-and-replace to ensure TypeORM detects the JSONB change.
      // See /memories/repo/typeorm-jsonb-pitfall.md
      ship.crew = ship.crew.filter((_, i) => i !== crewIndex);
      ship.currentCrew = ship.crew.length;
      return info;
    }
    return null;
  }

  /**
   * Leave ship crew
   */
  async leaveShipCrew(activityId: string, userId: string): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const leftShipInfo = this.findAndRemoveFromCrew(activity, userId);

    if (!leftShipInfo) {
      throw new ValidationError('User is not crew on any ship in this activity');
    }

    // Spread-and-replace top-level array reference to trigger JSONB dirty check.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.ships = activity.ships ? [...activity.ships] : activity.ships;
    activity.updatedAt = new Date();
    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    if (leftShipInfo) {
      activityAuditLogger.log({
        action: ActivityAuditAction.CREW_LEFT,
        activityId,
        activityTitle: activity.title,
        activityType: activity.activityType,
        organizationId: activity.organizationId ?? '',
        performedById: userId,
        performedByName: leftShipInfo.userName || userId,
        details: {
          shipId: leftShipInfo.shipId,
          shipName: leftShipInfo.shipName,
          shipType: leftShipInfo.shipType,
          previousPosition: leftShipInfo.position,
        },
      });
    }

    logger.info(`User ${userId} left ship crew in activity ${activityId}`);
    return updatedActivity;
  }

  /**
   * Get available crew positions for an activity
   */
  async getAvailableCrewPositions(activityId: string): Promise<AvailableCrewPosition[]> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const positions: AvailableCrewPosition[] = [];

    if (activity.ships) {
      const commonPositions = [
        'Pilot',
        'Co-pilot',
        'Gunner',
        'Engineer',
        'Navigator',
        'Cargo',
        'Medical',
      ];

      for (const ship of activity.ships) {
        const availableSlots = (ship.maxCrew ?? 0) - (ship.currentCrew ?? 0);

        for (let i = 0; i < availableSlots; i++) {
          // Try to suggest positions based on ship type and existing crew
          const existingPositions = ship.crew?.map(c => c.position) ?? [];
          const suggestedPosition =
            commonPositions.find(pos => !existingPositions.includes(pos)) ??
            `Crew Member ${existingPositions.length + 1}`;

          positions.push({
            activityId,
            shipId: ship.id ?? '',
            shipName: ship.shipName ?? 'Unknown Ship',
            shipType: ship.shipType,
            position: suggestedPosition,
            available: true,
            requirements: (
              (ship.metadata as Record<string, unknown>)?.positionRequirements as
                Record<string, unknown> | undefined
            )?.[suggestedPosition] as string[] | undefined,
          });
        }
      }
    }

    return positions;
  }

  // ==================== ORGANIZATION MANAGEMENT ====================

  /**
   * Invite an organization to participate in an activity
   */
  async inviteOrganization(
    activityId: string,
    organizationId: string,
    organizationName: string,
    invitedByUserId: string,
    role: string = 'participant'
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Check if user has permission to invite organizations
    const isCreator = activity.creatorId === invitedByUserId;
    if (!isCreator) {
      throw new ForbiddenError('Only activity creator can invite organizations');
    }

    // Check if organization is already participating or invited
    const existingOrg = activity.participatingOrgs?.find(
      org => org.organizationId === organizationId
    );
    if (existingOrg) {
      throw new ConflictError('Organization is already participating or invited to this activity');
    }

    // Add organization invitation
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.participatingOrgs = [
      ...(activity.participatingOrgs ?? []),
      {
        organizationId,
        organizationName,
        role: (role || 'participant') as
          'host' | 'co_host' | 'participant' | 'allied' | 'contracted',
        memberCount: 0,
        status: 'invited',
        joinedAt: new Date(),
        invitedBy: invitedByUserId,
      },
    ];

    activity.updatedAt = new Date();

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.ORG_INVITED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: invitedByUserId,
      performedByName: activity.creatorName || invitedByUserId,
      details: {
        invitedOrganizationId: organizationId,
        invitedOrganizationName: organizationName,
        role,
        totalInvitedOrgs:
          updatedActivity.participatingOrgs?.filter(o => o.status === 'invited').length || 0,
      },
    });

    logger.info(
      `Organization ${organizationId} invited to activity ${activityId} by ${invitedByUserId}`
    );
    return updatedActivity;
  }

  /**
   * Accept organization invitation
   */
  async acceptOrganizationInvite(activityId: string, organizationId: string): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Find the organization invitation
    const orgParticipation = activity.participatingOrgs?.find(
      org => org.organizationId === organizationId
    );

    if (!orgParticipation) {
      throw new NotFoundError('Organization invitation');
    }

    if (orgParticipation.status !== 'invited') {
      throw new ValidationError('Organization invitation is not in pending status');
    }

    // Accept the invitation
    orgParticipation.status = 'accepted';
    orgParticipation.joinedAt = new Date();
    // Spread-and-replace top-level array reference to trigger JSONB dirty check.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.participatingOrgs = [...activity.participatingOrgs];
    activity.updatedAt = new Date();

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.ORG_INVITE_ACCEPTED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: organizationId,
      performedByName: orgParticipation.organizationName,
      details: {
        acceptedOrganizationId: organizationId,
        acceptedOrganizationName: orgParticipation.organizationName,
        role: orgParticipation.role,
        totalParticipatingOrgs:
          updatedActivity.participatingOrgs?.filter(o => o.status === 'accepted').length || 0,
      },
    });

    logger.info(`Organization ${organizationId} accepted invitation to activity ${activityId}`);
    return updatedActivity;
  }

  /**
   * Decline organization invitation
   */
  async declineOrganizationInvite(activityId: string, organizationId: string): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Find and remove the organization invitation
    const orgIndex = activity.participatingOrgs?.findIndex(
      org => org.organizationId === organizationId
    );

    if (orgIndex === undefined || orgIndex === -1) {
      throw new NotFoundError('Organization invitation');
    }

    const declinedOrg = activity.participatingOrgs[orgIndex];
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.participatingOrgs = activity.participatingOrgs.filter((_, i) => i !== orgIndex);
    activity.updatedAt = new Date();

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.ORG_INVITE_DECLINED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: organizationId,
      performedByName: declinedOrg.organizationName,
      details: {
        declinedOrganizationId: organizationId,
        declinedOrganizationName: declinedOrg.organizationName,
      },
    });

    logger.info(`Organization ${organizationId} declined invitation to activity ${activityId}`);
    return updatedActivity;
  }
}
