"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetTeamService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const FleetShip_1 = require("../../models/FleetShip");
const Team_1 = require("../../models/Team");
const TeamMember_1 = require("../../models/TeamMember");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const TeamService_1 = require("../team/TeamService");
const FleetAuditLogger_1 = require("./FleetAuditLogger");
const FleetHealthService_1 = require("./FleetHealthService");
const FLEET_TYPE_DIVISION_MAP = {
    [Fleet_1.FleetType.COMBAT]: 'Security',
    [Fleet_1.FleetType.ESCORT]: 'Security',
    [Fleet_1.FleetType.RECONNAISSANCE]: 'Security',
    [Fleet_1.FleetType.MINING]: 'Industry',
    [Fleet_1.FleetType.SALVAGE]: 'Industry',
    [Fleet_1.FleetType.TRADING]: 'Logistics',
    [Fleet_1.FleetType.EXPLORATION]: 'Exploration',
    [Fleet_1.FleetType.MEDICAL]: 'Medical',
    [Fleet_1.FleetType.MIXED]: 'Specialist',
};
class FleetTeamService {
    static instance;
    teamService;
    healthService;
    auditLogger;
    listenerRegistered = false;
    constructor() {
        this.teamService = new TeamService_1.TeamService();
        this.healthService = new FleetHealthService_1.FleetHealthService();
        this.auditLogger = FleetAuditLogger_1.fleetAuditLogger;
    }
    static getInstance() {
        if (!FleetTeamService.instance) {
            FleetTeamService.instance = new FleetTeamService();
        }
        return FleetTeamService.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            FleetTeamService.instance = undefined;
        }
    }
    registerListeners() {
        if (this.listenerRegistered) {
            return;
        }
        this.listenerRegistered = true;
        DomainEventBus_1.domainEvents.on('team:member_status_changed', async (payload) => {
            await this.handleMemberStatusChanged(payload);
        });
        DomainEventBus_1.domainEvents.on('team:emblem_updated', async (payload) => {
            await this.handleTeamEmblemUpdated(payload);
        });
        logger_1.logger.info('FleetTeamService: domain event listeners registered');
    }
    async autoCreateTeamForFleet(organizationId, fleet) {
        if (fleet.teamId) {
            logger_1.logger.debug('Fleet already has a team, skipping auto-create', {
                fleetId: fleet.id,
                teamId: fleet.teamId,
            });
            return fleet;
        }
        const divisionName = FLEET_TYPE_DIVISION_MAP[fleet.type] || 'Specialist';
        const divisionTeam = await this.findDivisionTeam(organizationId, divisionName);
        const teamName = `${fleet.name} Crew`;
        const team = await this.teamService.createTeam(organizationId, {
            name: teamName,
            description: `Auto-created crew team for fleet "${fleet.name}"`,
            type: 'crew',
            parentTeamId: divisionTeam?.id ?? null,
            maxMembers: 0,
            emblem: fleet.emblem || null,
        });
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        fleet.teamId = team.id;
        await fleetRepo.save(fleet);
        this.auditLogger.logTeamCreated(organizationId, fleet.id, fleet.name, team.id, teamName, 0);
        logger_1.logger.info('Auto-created team for fleet', {
            fleetId: fleet.id,
            teamId: team.id,
            divisionParent: divisionTeam?.name,
        });
        return fleet;
    }
    async syncTeamCapacity(organizationId, fleetId) {
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
        if (!fleet?.teamId) {
            return;
        }
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const fleetShips = await fleetShipRepo.find({
            where: { fleetId, organizationId },
            relations: ['ship'],
        });
        const ships = fleetShips.map(fs => fs.ship).filter(Boolean);
        const { totalCrewPositions, standbySlots, totalCapacity } = this.healthService.calculateTeamCapacity(ships);
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
            logger_1.logger.info('Fleet team capacity updated', {
                fleetId,
                teamId: fleet.teamId,
                previousCapacity,
                newCapacity: totalCapacity,
                totalCrewPositions,
                standbySlots,
            });
        }
    }
    async deleteTeamForFleet(organizationId, fleet) {
        if (!fleet.teamId) {
            return;
        }
        const teamId = fleet.teamId;
        try {
            await this.teamService.deleteTeam(organizationId, teamId);
            this.auditLogger.log({
                action: FleetAuditLogger_1.FleetAuditAction.FLEET_TEAM_DELETED,
                fleetId: fleet.id,
                fleetName: fleet.name,
                organizationId,
                details: { teamId },
            });
            logger_1.logger.info('Deleted team linked to fleet', {
                fleetId: fleet.id,
                teamId,
            });
        }
        catch (err) {
            logger_1.logger.warn('Failed to delete fleet-linked team (may already be removed)', {
                fleetId: fleet.id,
                teamId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async syncTeamHierarchy(organizationId, childFleet, parentFleet, _previousParentFleet) {
        if (!childFleet.teamId) {
            return;
        }
        if (parentFleet?.teamId) {
            await this.teamService.moveTeam(organizationId, childFleet.teamId, parentFleet.teamId);
            this.auditLogger.log({
                action: FleetAuditLogger_1.FleetAuditAction.FLEET_TEAM_REPARENTED,
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
            logger_1.logger.info('Fleet team reparented under parent fleet team', {
                childFleetId: childFleet.id,
                parentFleetId: parentFleet.id,
                childTeamId: childFleet.teamId,
                parentTeamId: parentFleet.teamId,
            });
        }
        else {
            const divisionName = FLEET_TYPE_DIVISION_MAP[childFleet.type] ?? 'Specialist';
            const divisionTeam = await this.findDivisionTeam(organizationId, divisionName);
            await this.teamService.moveTeam(organizationId, childFleet.teamId, divisionTeam?.id ?? null);
            logger_1.logger.info('Fleet team moved back to division', {
                childFleetId: childFleet.id,
                childTeamId: childFleet.teamId,
                divisionTeamId: divisionTeam?.id,
            });
        }
    }
    async handleMemberStatusChanged(payload) {
        const { teamId, organizationId, userId, previousStatus, newStatus, memberName } = payload;
        const wasActive = previousStatus === 'active' || previousStatus === 'deployed';
        const isActive = newStatus === 'active' || newStatus === 'deployed';
        if (!wasActive && !isActive) {
            return;
        }
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
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
    async selectCrewPosition(organizationId, fleetId, userId, shipId, role) {
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Fleet');
        }
        if (!fleet.teamId) {
            throw new apiErrors_1.ValidationError('Fleet has no linked team');
        }
        const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
        const team = await teamRepo.findOne({ where: { id: fleet.teamId, organizationId } });
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        const memberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
        let membership = await memberRepo.findOne({
            where: { teamId: fleet.teamId, userId, organizationId },
        });
        const isActiveMember = membership && (membership.status === 'active' || membership.status === 'deployed');
        if (!isActiveMember) {
            if (team.joinPolicy === 'open') {
                membership = await this.teamService.addMember(organizationId, fleet.teamId, userId, 'member');
            }
            else {
                if (membership?.status === 'pending') {
                    membership.assignedShipId = shipId;
                    membership.crewRole = role;
                    await memberRepo.save(membership);
                    return { shipId, shipName: '', role, pending: true };
                }
                if (!membership || membership.status === 'removed' || membership.status === 'inactive') {
                    membership = await this.teamService.addMember(organizationId, fleet.teamId, userId, 'member');
                    membership.status = 'pending';
                    membership.assignedShipId = shipId;
                    membership.crewRole = role;
                    await memberRepo.save(membership);
                    logger_1.logger.info('Crew position request pending approval', {
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
                throw new apiErrors_1.ForbiddenError("You must be an active member of this fleet's team");
            }
        }
        if (!membership) {
            throw new apiErrors_1.ForbiddenError("You must be an active member of this fleet's team");
        }
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const fleetShip = await fleetShipRepo.findOne({
            where: { fleetId, shipId, organizationId },
            relations: ['ship'],
        });
        if (!fleetShip?.ship) {
            throw new apiErrors_1.NotFoundError('Ship is not assigned to this fleet');
        }
        let existingCrew = 0;
        try {
            existingCrew = await memberRepo.count({
                where: {
                    teamId: fleet.teamId,
                    organizationId,
                    assignedShipId: shipId,
                    status: (0, typeorm_1.In)(['active', 'deployed']),
                },
            });
        }
        catch {
            logger_1.logger.warn('assignedShipId column query failed — skipping capacity check');
        }
        const shipMaxCrew = fleetShip.ship.maxCrew || 1;
        if (existingCrew >= shipMaxCrew && membership.assignedShipId !== shipId) {
            throw new apiErrors_1.ValidationError(`Ship "${fleetShip.ship.name}" has no available crew positions`);
        }
        membership.assignedShipId = shipId;
        membership.crewRole = role;
        await memberRepo.save(membership);
        this.auditLogger.log({
            action: FleetAuditLogger_1.FleetAuditAction.CREW_POSITION_SELECTED,
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
        logger_1.logger.info('Crew position selected', {
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
    async unselectCrewPosition(organizationId, fleetId, userId) {
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
        if (!fleet?.teamId) {
            throw new apiErrors_1.NotFoundError('Fleet not found or has no linked team');
        }
        const memberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
        const membership = await memberRepo.findOne({
            where: { teamId: fleet.teamId, userId, organizationId },
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError("You are not a member of this fleet's team");
        }
        const previousShipId = membership.assignedShipId;
        const previousRole = membership.crewRole;
        membership.assignedShipId = undefined;
        membership.crewRole = undefined;
        await memberRepo.save(membership);
        this.auditLogger.log({
            action: FleetAuditLogger_1.FleetAuditAction.CREW_POSITION_VACATED,
            fleetId,
            fleetName: fleet.name,
            organizationId,
            details: {
                userId,
                previousShipId,
                previousRole,
            },
        });
        logger_1.logger.info('Crew position vacated', { fleetId, userId });
    }
    async getCrewPositions(organizationId, fleetId) {
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Fleet');
        }
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
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
        const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
        const team = await teamRepo.findOne({ where: { id: fleet.teamId, organizationId } });
        const memberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
        const members = await memberRepo.find({
            where: {
                teamId: fleet.teamId,
                organizationId,
                status: (0, typeorm_1.In)(['active', 'deployed']),
            },
            relations: ['user'],
        });
        let pendingCount = 0;
        try {
            pendingCount = await memberRepo.count({
                where: {
                    teamId: fleet.teamId,
                    organizationId,
                    status: 'pending',
                },
            });
        }
        catch {
        }
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
    async getFleetCrewMembers(organizationId, fleetId) {
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Fleet');
        }
        if (!fleet.teamId) {
            return { members: [] };
        }
        const memberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
        const teamMembers = await memberRepo.find({
            where: {
                teamId: fleet.teamId,
                organizationId,
                status: (0, typeorm_1.In)(['active', 'deployed', 'pending']),
            },
            relations: ['user'],
        });
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const fleetShips = await fleetShipRepo.find({
            where: { fleetId, organizationId },
            relations: ['ship'],
        });
        const shipNameMap = new Map();
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
    async handleTeamEmblemUpdated(payload) {
        const { teamId, organizationId, emblemUrl } = payload;
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
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
                action: FleetAuditLogger_1.FleetAuditAction.FLEET_UPDATED,
                fleetId: fleet.id,
                fleetName: fleet.name,
                organizationId,
                details: { emblemSyncedFromTeam: teamId, emblemUrl },
            });
        }
        logger_1.logger.info('Synced team emblem to linked fleets', {
            teamId,
            organizationId,
            fleetCount: linkedFleets.length,
            emblemUrl,
        });
    }
    async getTeamById(organizationId, teamId) {
        return this.teamService.getTeamById(organizationId, teamId);
    }
    async findDivisionTeam(organizationId, divisionName) {
        const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
        return teamRepo
            .createQueryBuilder('t')
            .where('t.organizationId = :organizationId', { organizationId })
            .andWhere('t.type = :type', { type: 'division' })
            .andWhere('LOWER(t.name) LIKE LOWER(:name)', { name: `%${divisionName}%` })
            .getOne();
    }
}
exports.FleetTeamService = FleetTeamService;
//# sourceMappingURL=FleetTeamService.js.map