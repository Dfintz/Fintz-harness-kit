import { In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Fleet, FleetType } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { Team } from '../../models/Team';
import type { TeamMemberStatus } from '../../models/TeamMember';
import { TeamMember } from '../../models/TeamMember';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import {
  domainEvents,
  type TeamEmblemUpdatedPayload,
  type TeamMemberStatusChangedPayload,
} from '../shared/DomainEventBus';
import { TeamService } from '../team/TeamService';

import { FleetAuditAction, fleetAuditLogger, type FleetAuditLogger } from './FleetAuditLogger';
import { FleetHealthService } from './FleetHealthService';

/**
 * Maps FleetType → division name hint.
 * Used to find or fall back when looking for a parent division-type team.
 */
const FLEET_TYPE_DIVISION_MAP: Record<FleetType, string> = {
  [FleetType.COMBAT]: 'Security',
  [FleetType.ESCORT]: 'Security',
  [FleetType.RECONNAISSANCE]: 'Security',
  [FleetType.MINING]: 'Industry',
  [FleetType.SALVAGE]: 'Industry',
  [FleetType.TRADING]: 'Logistics',
  [FleetType.EXPLORATION]: 'Exploration',
  [FleetType.MEDICAL]: 'Medical',
  [FleetType.MIXED]: 'Specialist',
};

/**
 * FleetTeamService — Orchestrates fleet ↔ team lifecycle.
 *
 * Responsibilities:
 * - Auto-create a team when a fleet is created
 * - Sync team capacity (maxMembers) when ships are added/removed
 * - Reparent teams when fleets are nested/unnested
 * - Listen for team member status changes and log fleet audit events
 *
 * This service delegates all Team mutations to TeamService (Tell, Don't Ask).
 */
export class FleetTeamService {
  private static instance: FleetTeamService;
  private readonly teamService: TeamService;
  private readonly healthService: FleetHealthService;
  private readonly auditLogger: FleetAuditLogger;
  private listenerRegistered = false;

  private constructor() {
    this.teamService = new TeamService();
    this.healthService = new FleetHealthService();
    this.auditLogger = fleetAuditLogger;
  }

  static getInstance(): FleetTeamService {
    if (!FleetTeamService.instance) {
      FleetTeamService.instance = new FleetTeamService();
    }
    return FleetTeamService.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      FleetTeamService.instance = undefined as unknown as FleetTeamService;
    }
  }

  /**
   * Register domain event listeners for cross-domain status observation.
   * Should be called once during application bootstrap.
   */
  registerListeners(): void {
    if (this.listenerRegistered) {
      return;
    }
    this.listenerRegistered = true;

    domainEvents.on(
      'team:member_status_changed',
      async (payload: TeamMemberStatusChangedPayload) => {
        await this.handleMemberStatusChanged(payload);
      }
    );

    domainEvents.on('team:emblem_updated', async (payload: TeamEmblemUpdatedPayload) => {
      await this.handleTeamEmblemUpdated(payload);
    });

    logger.info('FleetTeamService: domain event listeners registered');
  }

  // ── Auto-Create Team on Fleet Creation ──────────────────────────

  /**
   * Create a team for a newly created fleet and link it.
   * Idempotent — skips if fleet already has a teamId.
   *
   * @returns The fleet with teamId set, or the original fleet if already linked.
   */
  async autoCreateTeamForFleet(organizationId: string, fleet: Fleet): Promise<Fleet> {
    if (fleet.teamId) {
      logger.debug('Fleet already has a team, skipping auto-create', {
        fleetId: fleet.id,
        teamId: fleet.teamId,
      });
      return fleet;
    }

    // Find a matching division team (optional parent)
    const divisionName = FLEET_TYPE_DIVISION_MAP[fleet.type] || 'Specialist';
    const divisionTeam = await this.findDivisionTeam(organizationId, divisionName);

    const teamName = `${fleet.name} Crew`;

    const team = await this.teamService.createTeam(organizationId, {
      name: teamName,
      description: `Auto-created crew team for fleet "${fleet.name}"`,
      type: 'crew',
      parentTeamId: divisionTeam?.id ?? null,
      maxMembers: 0, // Will be recalculated when ships are added
      emblem: fleet.emblem || null, // Reverse-sync: copy fleet emblem to new team
    });

    // Link team to fleet
    const fleetRepo = AppDataSource.getRepository(Fleet);
    fleet.teamId = team.id;
    await fleetRepo.save(fleet);

    this.auditLogger.logTeamCreated(organizationId, fleet.id, fleet.name, team.id, teamName, 0);

    logger.info('Auto-created team for fleet', {
      fleetId: fleet.id,
      teamId: team.id,
      divisionParent: divisionTeam?.name,
    });

    return fleet;
  }

  // ── Sync Team Capacity on Ship Changes ──────────────────────────

  /**
   * Recalculate and update the fleet's team maxMembers based on current ships.
   * Formula: SUM(ship.maxCrew) + ceil(SUM(ship.maxCrew) × 0.30 standby)
   */
  async syncTeamCapacity(organizationId: string, fleetId: string): Promise<void> {
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
    if (!fleet?.teamId) {
      return;
    }

    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const fleetShips = await fleetShipRepo.find({
      where: { fleetId, organizationId },
      relations: ['ship'],
    });

    const ships = fleetShips.map(fs => fs.ship).filter(Boolean);
    const { totalCrewPositions, standbySlots, totalCapacity } =
      this.healthService.calculateTeamCapacity(ships);

    // Read current capacity before update
    const team = await this.teamService.getTeamById(organizationId, fleet.teamId);
    const previousCapacity = team?.maxMembers ?? 0;

    if (previousCapacity !== totalCapacity) {
      await this.teamService.updateTeam(organizationId, fleet.teamId, {
        maxMembers: totalCapacity,
      });

      this.auditLogger.logTeamCapacityUpdated({
        organizationId,
        fleetId,
        fleetName: fleet.name,
        teamId: fleet.teamId,
        previousCapacity,
        newCapacity: totalCapacity,
        totalCrewPositions,
        standbySlots,
      });

      logger.info('Fleet team capacity updated', {
        fleetId,
        teamId: fleet.teamId,
        previousCapacity,
        newCapacity: totalCapacity,
        totalCrewPositions,
        standbySlots,
      });
    }
  }

  // ── Delete Team on Fleet Deletion ────────────────────────────

  /**
   * Delete the team linked to a fleet before the fleet itself is removed.
   * This ensures cascade cleanup of the auto-created crew team.
   */
  async deleteTeamForFleet(organizationId: string, fleet: Fleet): Promise<void> {
    if (!fleet.teamId) {
      return;
    }

    const teamId = fleet.teamId;

    try {
      await this.teamService.deleteTeam(organizationId, teamId);

      this.auditLogger.log({
        action: FleetAuditAction.FLEET_TEAM_DELETED,
        fleetId: fleet.id,
        fleetName: fleet.name,
        organizationId,
        details: { teamId },
      });

      logger.info('Deleted team linked to fleet', {
        fleetId: fleet.id,
        teamId,
      });
    } catch (err: unknown) {
      // Team may have already been deleted (e.g. manual cleanup).
      // Log warning but don't block fleet deletion.
      logger.warn('Failed to delete fleet-linked team (may already be removed)', {
        fleetId: fleet.id,
        teamId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Sync Team Hierarchy on Fleet Nesting ────────────────────────

  /**
   * When fleet B is nested under fleet A, reparent B's team under A's team.
   * When fleet B is unnested (moved to root), move B's team back to its division.
   */
  async syncTeamHierarchy(
    organizationId: string,
    childFleet: Fleet,
    parentFleet: Fleet | null,
    _previousParentFleet: Fleet | null
  ): Promise<void> {
    if (!childFleet.teamId) {
      return;
    }

    if (parentFleet?.teamId) {
      // Nest child's team under parent's team
      await this.teamService.moveTeam(organizationId, childFleet.teamId, parentFleet.teamId);

      this.auditLogger.log({
        action: FleetAuditAction.FLEET_TEAM_REPARENTED,
        fleetId: childFleet.id,
        fleetName: childFleet.name,
        organizationId,
        details: {
          teamId: childFleet.teamId,
          newParentTeamId: parentFleet.teamId,
          newParentFleetId: parentFleet.id,
          newParentFleetName: parentFleet.name,
        },
      });

      logger.info('Fleet team reparented under parent fleet team', {
        childFleetId: childFleet.id,
        parentFleetId: parentFleet.id,
        childTeamId: childFleet.teamId,
        parentTeamId: parentFleet.teamId,
      });
    } else {
      // Unnested — move team back to division-level parent (or root)
      const divisionName = FLEET_TYPE_DIVISION_MAP[childFleet.type] ?? 'Specialist';
      const divisionTeam = await this.findDivisionTeam(organizationId, divisionName);

      await this.teamService.moveTeam(organizationId, childFleet.teamId, divisionTeam?.id ?? null);

      logger.info('Fleet team moved back to division', {
        childFleetId: childFleet.id,
        childTeamId: childFleet.teamId,
        divisionTeamId: divisionTeam?.id,
      });
    }
  }

  // ── Handle Team Member Status Changes (Cross-Domain) ─────────

  /**
   * When a team member's status changes to a non-active state,
   * find affected fleets and log audit events.
   */
  private async handleMemberStatusChanged(payload: TeamMemberStatusChangedPayload): Promise<void> {
    const { teamId, organizationId, userId, previousStatus, newStatus, memberName } = payload;

    // Only react to transitions away from active crew statuses
    const wasActive = previousStatus === 'active' || previousStatus === 'deployed';
    const isActive = newStatus === 'active' || newStatus === 'deployed';

    if (!wasActive && !isActive) {
      return; // No change relevant to crew readiness
    }

    // Find fleets linked to this team
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const affectedFleets = await fleetRepo.find({
      where: { teamId, organizationId },
    });

    for (const fleet of affectedFleets) {
      this.auditLogger.logCrewMemberUnavailable({
        organizationId,
        fleetId: fleet.id,
        fleetName: fleet.name,
        memberId: userId,
        memberName: memberName || 'Unknown',
        previousStatus,
        newStatus,
      });
    }
  }

  // ── Crew Position Self-Selection ─────────────────────────────

  /**
   * Allow a user to select a ship and crew role within a fleet.
   *
   * Join policy behaviour:
   * - **open** team: if the user is not a member, auto-add them as active and assign the position.
   * - **closed** team: if the user is not a member, create a pending membership (needs approval).
   *   The position is recorded but the member stays 'pending' until a leader/officer approves.
   * - Existing active/deployed members can always select a new position directly.
   */
  async selectCrewPosition(
    organizationId: string,
    fleetId: string,
    userId: string,
    shipId: string,
    role: string
  ): Promise<{ shipId: string; shipName: string; role: string; pending?: boolean }> {
    // 1. Load fleet with team
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }
    if (!fleet.teamId) {
      throw new ValidationError('Fleet has no linked team');
    }

    // 2. Load the team to check joinPolicy
    const teamRepo = AppDataSource.getRepository(Team);
    const team = await teamRepo.findOne({ where: { id: fleet.teamId, organizationId } });
    if (!team) {
      throw new NotFoundError('Team');
    }

    // 3. Look up user's membership
    const memberRepo = AppDataSource.getRepository(TeamMember);
    let membership = await memberRepo.findOne({
      where: { teamId: fleet.teamId, userId, organizationId },
    });

    const isActiveMember =
      membership && (membership.status === 'active' || membership.status === 'deployed');

    if (!isActiveMember) {
      if (team.joinPolicy === 'open') {
        // Auto-join the team as an active member
        membership = await this.teamService.addMember(
          organizationId,
          fleet.teamId,
          userId,
          'member'
        );
      } else {
        // Closed team — create or update membership as 'pending'
        if (membership?.status === 'pending') {
          // Already pending — update the requested position
          membership.assignedShipId = shipId;
          membership.crewRole = role;
          await memberRepo.save(membership);
          return { shipId, shipName: '', role, pending: true };
        }
        if (!membership || membership.status === 'removed' || membership.status === 'inactive') {
          // Create pending membership with requested position
          membership = await this.teamService.addMember(
            organizationId,
            fleet.teamId,
            userId,
            'member'
          );
          // Set to pending status
          membership.status = 'pending';
          membership.assignedShipId = shipId;
          membership.crewRole = role;
          await memberRepo.save(membership);

          logger.info('Crew position request pending approval', {
            fleetId,
            userId,
            shipId,
            role,
          });

          return {
            shipId,
            shipName: '',
            role,
            pending: true,
          };
        }
        throw new ForbiddenError("You must be an active member of this fleet's team");
      }
    }

    // At this point membership is guaranteed to be non-null
    // (either was active, or was auto-joined in the open branch above)
    if (!membership) {
      throw new ForbiddenError("You must be an active member of this fleet's team");
    }

    // 3. Verify ship belongs to the fleet
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const fleetShip = await fleetShipRepo.findOne({
      where: { fleetId, shipId, organizationId },
      relations: ['ship'],
    });
    if (!fleetShip?.ship) {
      throw new NotFoundError('Ship is not assigned to this fleet');
    }

    // 4. Check ship capacity — count existing crew on this ship
    let existingCrew = 0;
    try {
      existingCrew = await memberRepo.count({
        where: {
          teamId: fleet.teamId,
          organizationId,
          assignedShipId: shipId,
          status: In(['active', 'deployed'] as string[]),
        },
      });
    } catch {
      // Column may not exist yet if migration hasn't run — skip capacity check
      logger.warn('assignedShipId column query failed — skipping capacity check');
    }
    const shipMaxCrew = fleetShip.ship.maxCrew || 1;
    if (existingCrew >= shipMaxCrew && membership.assignedShipId !== shipId) {
      throw new ValidationError(`Ship "${fleetShip.ship.name}" has no available crew positions`);
    }

    // 5. Update the team member's assignment
    membership.assignedShipId = shipId;
    membership.crewRole = role;
    await memberRepo.save(membership);

    this.auditLogger.log({
      action: FleetAuditAction.CREW_POSITION_SELECTED,
      fleetId,
      fleetName: fleet.name,
      organizationId,
      details: {
        userId,
        shipId,
        shipName: fleetShip.ship.name,
        role,
      },
    });

    logger.info('Crew position selected', {
      fleetId,
      userId,
      shipId,
      role,
    });

    return {
      shipId,
      shipName: fleetShip.ship.name,
      role,
    };
  }

  /**
   * Allow a team member to vacate their crew position.
   */
  async unselectCrewPosition(
    organizationId: string,
    fleetId: string,
    userId: string
  ): Promise<void> {
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
    if (!fleet?.teamId) {
      throw new NotFoundError('Fleet not found or has no linked team');
    }

    const memberRepo = AppDataSource.getRepository(TeamMember);
    const membership = await memberRepo.findOne({
      where: { teamId: fleet.teamId, userId, organizationId },
    });
    if (!membership) {
      throw new ForbiddenError("You are not a member of this fleet's team");
    }

    const previousShipId = membership.assignedShipId;
    const previousRole = membership.crewRole;

    membership.assignedShipId = undefined;
    membership.crewRole = undefined;
    await memberRepo.save(membership);

    this.auditLogger.log({
      action: FleetAuditAction.CREW_POSITION_VACATED,
      fleetId,
      fleetName: fleet.name,
      organizationId,
      details: {
        userId,
        previousShipId,
        previousRole,
      },
    });

    logger.info('Crew position vacated', { fleetId, userId });
  }

  /**
   * Get crew positions for all ships in a fleet.
   * Returns each ship with its assigned crew members, plus team metadata.
   */
  async getCrewPositions(
    organizationId: string,
    fleetId: string
  ): Promise<{
    joinPolicy: string;
    pendingCount: number;
    ships: Array<{
      shipId: string;
      shipName: string;
      maxCrew: number;
      crew: Array<{
        userId: string;
        username: string;
        avatar: string | null;
        role: string;
        assignedAt: Date;
      }>;
    }>;
  }> {
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    // Get all ships in the fleet
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const fleetShips = await fleetShipRepo.find({
      where: { fleetId, organizationId },
      relations: ['ship'],
    });

    if (!fleet.teamId) {
      return {
        joinPolicy: 'closed',
        pendingCount: 0,
        ships: fleetShips
          .filter(fs => fs.ship)
          .map(fs => ({
            shipId: fs.shipId,
            shipName: fs.ship.name,
            maxCrew: fs.ship.maxCrew || 1,
            crew: [],
          })),
      };
    }

    // Load team for joinPolicy
    const teamRepo = AppDataSource.getRepository(Team);
    const team = await teamRepo.findOne({ where: { id: fleet.teamId, organizationId } });

    // Get all team members with ship assignments
    const memberRepo = AppDataSource.getRepository(TeamMember);
    const members = await memberRepo.find({
      where: {
        teamId: fleet.teamId,
        organizationId,
        status: In(['active', 'deployed'] as string[]),
      },
      relations: ['user'],
    });

    // Count pending requests
    let pendingCount = 0;
    try {
      pendingCount = await memberRepo.count({
        where: {
          teamId: fleet.teamId,
          organizationId,
          status: 'pending' as TeamMemberStatus,
        },
      });
    } catch {
      // Column may not exist yet
    }

    // Build per-ship positions
    const ships = fleetShips
      .filter(fs => fs.ship)
      .map(fs => {
        const shipMembers = members
          .filter(m => m.assignedShipId === fs.shipId)
          .map(m => ({
            userId: m.userId,
            username: m.user?.username || 'Unknown',
            avatar: m.user?.avatar || null,
            role: m.crewRole || 'crew',
            assignedAt: m.updatedAt,
          }));

        return {
          shipId: fs.shipId,
          shipName: fs.ship.name,
          maxCrew: fs.ship.maxCrew || 1,
          crew: shipMembers,
        };
      });

    return {
      joinPolicy: team?.joinPolicy ?? 'closed',
      pendingCount,
      ships,
    };
  }

  // ── Fleet Crew Members List ─────────────────────────────────

  /**
   * Get all crew members for a fleet with their ship assignments.
   * Returns a flat list of every team member (active, deployed, pending)
   * along with their assigned ship name and role.
   */
  async getFleetCrewMembers(
    organizationId: string,
    fleetId: string
  ): Promise<{
    members: Array<{
      userId: string;
      username: string;
      displayName?: string;
      avatar: string | null;
      role: string;
      status: string;
      crewRole: string | null;
      assignedShipId: string | null;
      assignedShipName: string | null;
      joinedAt: string | null;
    }>;
  }> {
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }
    if (!fleet.teamId) {
      return { members: [] };
    }

    const memberRepo = AppDataSource.getRepository(TeamMember);
    const teamMembers = await memberRepo.find({
      where: {
        teamId: fleet.teamId,
        organizationId,
        status: In(['active', 'deployed', 'pending'] as string[]),
      },
      relations: ['user'],
    });

    // Build a map of shipId → shipName from fleet's ships
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const fleetShips = await fleetShipRepo.find({
      where: { fleetId, organizationId },
      relations: ['ship'],
    });
    const shipNameMap = new Map<string, string>();
    for (const fs of fleetShips) {
      if (fs.ship) {
        shipNameMap.set(fs.shipId, fs.ship.name);
      }
    }

    const members = teamMembers.map(m => ({
      userId: m.userId,
      username: m.user?.username || 'Unknown',
      displayName: m.user?.displayName,
      avatar: m.user?.avatar || null,
      role: m.role,
      status: m.status,
      crewRole: m.crewRole || null,
      assignedShipId: m.assignedShipId || null,
      assignedShipName: m.assignedShipId ? shipNameMap.get(m.assignedShipId) || null : null,
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    }));

    return { members };
  }

  // ── Sync Team Emblem to Linked Fleets ────────────────────────

  /**
   * When a team's emblem is updated, propagate it to all fleets
   * linked to that team (fleet.teamId === teamId).
   */
  private async handleTeamEmblemUpdated(payload: TeamEmblemUpdatedPayload): Promise<void> {
    const { teamId, organizationId, emblemUrl } = payload;

    const fleetRepo = AppDataSource.getRepository(Fleet);
    const linkedFleets = await fleetRepo.find({
      where: { teamId, organizationId },
    });

    if (linkedFleets.length === 0) {
      return;
    }

    for (const fleet of linkedFleets) {
      fleet.emblem = emblemUrl || undefined;
      await fleetRepo.save(fleet);

      this.auditLogger.log({
        action: FleetAuditAction.FLEET_UPDATED,
        fleetId: fleet.id,
        fleetName: fleet.name,
        organizationId,
        details: { emblemSyncedFromTeam: teamId, emblemUrl },
      });
    }

    logger.info('Synced team emblem to linked fleets', {
      teamId,
      organizationId,
      fleetCount: linkedFleets.length,
      emblemUrl,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Get a team by ID (delegates to TeamService).
   */
  async getTeamById(organizationId: string, teamId: string): Promise<Team | null> {
    return this.teamService.getTeamById(organizationId, teamId);
  }

  /**
   * Find a division-type team by name (case-insensitive).
   * Returns null if no matching division exists.
   */
  private async findDivisionTeam(
    organizationId: string,
    divisionName: string
  ): Promise<Team | null> {
    const teamRepo = AppDataSource.getRepository(Team);
    return teamRepo
      .createQueryBuilder('t')
      .where('t.organizationId = :organizationId', { organizationId })
      .andWhere('t.type = :type', { type: 'division' })
      .andWhere('LOWER(t.name) LIKE LOWER(:name)', { name: `%${divisionName}%` })
      .getOne();
  }
}

