"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetAggregatorService = void 0;
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const FleetInventory_1 = require("../../models/FleetInventory");
const Team_1 = require("../../models/Team");
const TeamMember_1 = require("../../models/TeamMember");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const communication_1 = require("../communication");
const DiscordService_1 = require("../discord/DiscordService");
const FleetInventoryService_1 = require("../fleet/FleetInventoryService");
const FleetService_1 = require("../fleet/FleetService");
const FleetTeamService_1 = require("../fleet/FleetTeamService");
const ShipService_1 = require("../ship/ShipService");
const TeamService_1 = require("../team/TeamService");
const SagaOrchestrator_1 = require("./SagaOrchestrator");
const COMBAT_POWER_PER_COMBAT_SHIP = Number(process.env.FLEET_COMBAT_POWER_PER_SHIP) || 100;
const MINING_CAPACITY_PER_MINING_SHIP = Number(process.env.FLEET_MINING_CAPACITY_PER_SHIP) || 50;
const DEFAULT_CARGO_CAPACITY_FOR_CARGO_ROLE = Number(process.env.FLEET_DEFAULT_CARGO_CAPACITY) || 100;
class FleetAggregatorService {
    fleetService;
    shipService;
    teamService;
    inventoryService;
    notificationService;
    discordService;
    constructor() {
        this.fleetService = new FleetService_1.FleetService();
        this.shipService = new ShipService_1.ShipService();
        this.teamService = new TeamService_1.TeamService();
        this.inventoryService = new FleetInventoryService_1.FleetInventoryService();
        this.notificationService = new communication_1.NotificationService(undefined, undefined);
        this.discordService = (0, DiscordService_1.getDiscordService)();
    }
    async createFleetWithAssets(params) {
        const saga = new SagaOrchestrator_1.SagaOrchestrator({
            name: 'CreateFleetWithAssets',
            maxRetries: 2,
            retryDelayMs: 500,
        });
        const context = { ...params, results: {} };
        saga.addStep({
            name: 'createFleet',
            execute: async (ctx) => {
                const fleet = await this.fleetService.createFleet(ctx.organizationId, {
                    name: ctx.fleetData.name,
                    description: ctx.fleetData.description,
                    leaderId: ctx.fleetData.leaderId,
                });
                const fleetWithTeam = await this.fleetService.postCreateFleet(ctx.organizationId, fleet);
                ctx.results.fleet = fleetWithTeam;
                return fleetWithTeam;
            },
            compensate: async (ctx, fleet) => {
                if (fleet && typeof fleet === 'object' && 'id' in fleet) {
                    await this.fleetService.delete(ctx.organizationId, fleet.id);
                    logger_1.logger.info('Compensated: Deleted fleet', { fleetId: fleet.id });
                }
            },
        });
        saga.addStep({
            name: 'assignShips',
            execute: async (ctx) => {
                if (!ctx.shipIds || ctx.shipIds.length === 0) {
                    return { assignedCount: 0, shipIds: [] };
                }
                const fleet = ctx.results.fleet;
                const assignedShips = [];
                try {
                    await this.fleetService.addShipIdsToFleet(ctx.organizationId, fleet.id, ctx.shipIds);
                    assignedShips.push(...ctx.shipIds);
                }
                catch (error) {
                    logger_1.logger.warn('Failed to assign ships to fleet', { fleetId: fleet.id, error });
                }
                ctx.results.assignedShips = assignedShips;
                if (assignedShips.length > 0) {
                    const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
                    await fleetTeamService.syncTeamCapacity(ctx.organizationId, fleet.id);
                }
                return { assignedCount: assignedShips.length, shipIds: assignedShips };
            },
            compensate: async (ctx, result) => {
                if (result && typeof result === 'object' && 'shipIds' in result) {
                    const fleet = ctx.results.fleet;
                    const assigned = result.shipIds;
                    try {
                        await this.fleetService.removeShipIdsFromFleet(ctx.organizationId, fleet.id, assigned);
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to unassign ships during compensation', { error });
                    }
                    logger_1.logger.info('Compensated: Unassigned ships', {
                        count: assigned.length,
                    });
                }
            },
        });
        saga.addStep({
            name: 'addTeamMembers',
            execute: async (ctx) => {
                if (!ctx.squadronData) {
                    return null;
                }
                const fleet = ctx.results.fleet;
                if (!fleet.teamId) {
                    logger_1.logger.warn('Fleet has no teamId, skipping team member assignment', {
                        fleetId: fleet.id,
                    });
                    return null;
                }
                const memberIds = ctx.squadronData.memberIds || [];
                if (memberIds.length === 0) {
                    return { addedCount: 0, memberIds: [] };
                }
                const members = memberIds.map((userId) => ({
                    userId,
                    role: 'member',
                }));
                await this.teamService.bulkAddMembers(ctx.organizationId, fleet.teamId, members);
                ctx.results.addedMemberIds = memberIds;
                return { addedCount: memberIds.length, memberIds, teamId: fleet.teamId };
            },
            compensate: async (ctx, result) => {
                if (result && typeof result === 'object' && 'memberIds' in result) {
                    const { memberIds, teamId } = result;
                    for (const userId of memberIds) {
                        try {
                            const membership = await this.teamService.getMembership(ctx.organizationId, teamId, userId);
                            if (membership) {
                                await this.teamService.removeMember(ctx.organizationId, teamId, membership.id);
                            }
                        }
                        catch (error) {
                            logger_1.logger.warn('Failed to remove team member during compensation', { userId, error });
                        }
                    }
                    logger_1.logger.info('Compensated: Removed team members', { count: memberIds.length });
                }
            },
        });
        saga.addStep({
            name: 'createInventory',
            execute: async (ctx) => {
                if (!ctx.inventoryItems || ctx.inventoryItems.length === 0) {
                    return { createdCount: 0, itemIds: [] };
                }
                const fleet = ctx.results.fleet;
                const createdItems = [];
                for (const item of ctx.inventoryItems) {
                    try {
                        const inventoryItem = await this.inventoryService.createInventoryItem(ctx.organizationId, {
                            fleetId: fleet.id,
                            itemName: item.itemName,
                            quantity: item.quantity,
                            category: item.category || FleetInventory_1.InventoryCategory.OTHER,
                            unit: FleetInventory_1.InventoryUnit.UNITS,
                            thresholds: {
                                criticalLevel: Math.floor(item.quantity * 0.1),
                                lowLevel: Math.floor(item.quantity * 0.25),
                                targetLevel: item.quantity,
                                maxLevel: item.quantity * 2,
                            },
                            managerId: item.managerId || ctx.fleetData.leaderId || 'system',
                        });
                        createdItems.push(inventoryItem.id);
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to create inventory item', { itemName: item.itemName, error });
                    }
                }
                ctx.results.inventoryItems = createdItems;
                return { createdCount: createdItems.length, itemIds: createdItems };
            },
            compensate: async (ctx, result) => {
                if (result && typeof result === 'object' && 'itemIds' in result) {
                    const { itemIds } = result;
                    for (const itemId of itemIds) {
                        try {
                            await this.inventoryService.deleteInventoryItem(ctx.organizationId, itemId);
                        }
                        catch (error) {
                            logger_1.logger.warn('Failed to delete inventory item during compensation', { itemId, error });
                        }
                    }
                    logger_1.logger.info('Compensated: Deleted inventory items', { count: itemIds.length });
                }
            },
        });
        saga.addStep({
            name: 'sendNotifications',
            execute: async (ctx) => {
                const notifications = [];
                if (ctx.notifyMembers && ctx.squadronData?.memberIds) {
                    const fleet = ctx.results.fleet;
                    const recipientIds = ctx.squadronData.memberIds;
                    const notificationPromises = recipientIds.map(userId => this.notificationService.create({
                        userId,
                        type: 'fleet_created',
                        title: 'Fleet Created',
                        message: `You've been added to fleet: ${fleet.name}`,
                        data: {
                            fleetId: fleet.id,
                            organizationId: ctx.organizationId,
                        },
                    }));
                    const results = await Promise.allSettled(notificationPromises);
                    notifications.push(...(0, communication_1.collectDeliveredNotifications)(results, recipientIds, 'fleet creation'));
                }
                if (ctx.postToDiscord && ctx.discordChannelId) {
                    const fleet = ctx.results.fleet;
                    try {
                        await this.discordService.sendMessage(ctx.discordChannelId, `🚀 New Fleet Created: **${fleet.name}**\n${fleet.description || 'No description'}`);
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to post fleet creation to Discord', { error });
                    }
                }
                return { notificationsSent: notifications.length };
            },
            compensate: async () => {
                logger_1.logger.info('Notifications cannot be compensated');
            },
        });
        const result = await saga.execute(context);
        if (result.success) {
            logger_1.logger.info('Fleet created with assets successfully', {
                fleetId: context.results.fleet?.id,
                organizationId: params.organizationId,
            });
        }
        else {
            logger_1.logger.error('Failed to create fleet with assets', {
                error: result.error?.message,
                completedSteps: result.completed,
                compensatedSteps: result.compensated,
            });
        }
        return result;
    }
    async deployFleet(params) {
        return data_source_1.AppDataSource.transaction(async () => {
            try {
                const fleet = await this.fleetService.getFleetById(params.organizationId, params.fleetId);
                if (!fleet) {
                    throw new apiErrors_1.NotFoundError('Fleet');
                }
                const updatedFleet = await this.fleetService.update(params.organizationId, params.fleetId, {
                    status: Fleet_1.FleetStatus.DEPLOYED,
                    deploymentLocation: params.deploymentData.location,
                    deployedAt: new Date(),
                    primaryActivity: params.deploymentData.mission,
                });
                logger_1.logger.info('Fleet deployed', {
                    fleetId: params.fleetId,
                    location: params.deploymentData.location,
                });
                const notifications = [];
                if (params.notifyMembers) {
                    try {
                        const memberIds = new Set();
                        if (fleet.teamId) {
                            const teamMembers = await this.teamService.getTeamMembers(params.organizationId, fleet.teamId);
                            for (const tm of teamMembers) {
                                if (tm.userId) {
                                    memberIds.add(tm.userId);
                                }
                            }
                        }
                        const recipientIds = Array.from(memberIds);
                        const notificationPromises = recipientIds.map(userId => this.notificationService.create({
                            userId,
                            type: 'fleet_deployed',
                            title: 'Fleet Deployed',
                            message: `Fleet "${fleet.name}" has been deployed to ${params.deploymentData.location}`,
                            data: {
                                fleetId: params.fleetId,
                                location: params.deploymentData.location,
                                mission: params.deploymentData.mission,
                            },
                        }));
                        const results = await Promise.allSettled(notificationPromises);
                        notifications.push(...(0, communication_1.collectDeliveredNotifications)(results, recipientIds, 'fleet deployment'));
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to send deployment notifications', { error });
                    }
                }
                return {
                    fleet: updatedFleet,
                    deployment: {
                        location: params.deploymentData.location,
                        mission: params.deploymentData.mission,
                        deployedAt: new Date(),
                    },
                    notifications,
                };
            }
            catch (error) {
                logger_1.logger.error('Failed to deploy fleet', { error });
                throw error;
            }
        });
    }
    async dissolveFleet(params) {
        const saga = new SagaOrchestrator_1.SagaOrchestrator({
            name: 'DissolveFleet',
            maxRetries: 2,
            retryDelayMs: 500,
        });
        const context = { ...params, results: {} };
        saga.addStep({
            name: 'validateFleet',
            execute: async (ctx) => {
                const fleet = await this.fleetService.getFleetById(ctx.organizationId, ctx.fleetId);
                if (!fleet) {
                    throw new apiErrors_1.NotFoundError('Fleet');
                }
                ctx.results.originalFleet = fleet;
                return fleet;
            },
            compensate: async () => {
            },
        });
        saga.addStep({
            name: 'reassignShips',
            execute: async (ctx) => {
                const originalFleet = ctx.results.originalFleet;
                const shipIds = originalFleet.shipIds || [];
                if (shipIds.length === 0) {
                    return { count: 0, ships: [] };
                }
                const reassignedShips = [];
                if (ctx.reassignShipsToFleetId) {
                    try {
                        const targetFleet = await this.fleetService.getFleetById(ctx.organizationId, ctx.reassignShipsToFleetId);
                        if (targetFleet) {
                            await this.fleetService.addShipIdsToFleet(ctx.organizationId, ctx.reassignShipsToFleetId, shipIds);
                            shipIds.forEach(id => reassignedShips.push({ id, previousFleetId: ctx.fleetId }));
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to reassign ships to target fleet', { error });
                    }
                }
                else {
                    shipIds.forEach(id => reassignedShips.push({ id, previousFleetId: ctx.fleetId }));
                }
                ctx.results.reassignedShips = reassignedShips;
                return { count: reassignedShips.length, ships: reassignedShips };
            },
            compensate: async (ctx, result) => {
                if (result && typeof result === 'object' && 'ships' in result) {
                    const { ships } = result;
                    if (ctx.reassignShipsToFleetId && ships.length > 0) {
                        try {
                            await this.fleetService.removeShipIdsFromFleet(ctx.organizationId, ctx.reassignShipsToFleetId, ships.map(s => s.id));
                        }
                        catch (error) {
                            logger_1.logger.warn('Failed to restore ship assignments during compensation', { error });
                        }
                    }
                }
            },
        });
        saga.addStep({
            name: 'removeTeamMembers',
            execute: async (ctx) => {
                const originalFleet = ctx.results.originalFleet;
                if (!originalFleet.teamId) {
                    return { count: 0, members: [] };
                }
                const teamMembers = await this.teamService.getTeamMembers(ctx.organizationId, originalFleet.teamId);
                const removedMembers = [];
                for (const member of teamMembers) {
                    try {
                        removedMembers.push({ userId: member.userId, role: member.role });
                        await this.teamService.removeMember(ctx.organizationId, originalFleet.teamId, member.id);
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to remove team member', {
                            memberId: member.id,
                            error,
                        });
                    }
                }
                ctx.results.removedMembers = removedMembers;
                return { count: removedMembers.length, members: removedMembers };
            },
            compensate: async (ctx, result) => {
                if (result && typeof result === 'object' && 'members' in result) {
                    const { members } = result;
                    const originalFleet = ctx.results.originalFleet;
                    if (originalFleet.teamId) {
                        for (const memberData of members) {
                            try {
                                await this.teamService.addMember(ctx.organizationId, originalFleet.teamId, memberData.userId, memberData.role);
                            }
                            catch (error) {
                                logger_1.logger.warn('Failed to restore team member', { error });
                            }
                        }
                    }
                }
            },
        });
        saga.addStep({
            name: 'deleteInventory',
            execute: async (ctx) => {
                const inventory = await this.inventoryService.getInventory(ctx.organizationId, {
                    fleetId: ctx.fleetId,
                });
                const deletedItems = [];
                for (const item of inventory.items) {
                    try {
                        deletedItems.push({ ...item });
                        await this.inventoryService.deleteInventoryItem(ctx.organizationId, item.id);
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to delete inventory item', { itemId: item.id, error });
                    }
                }
                ctx.results.deletedInventory = deletedItems;
                return { count: deletedItems.length, items: deletedItems };
            },
            compensate: async (ctx, result) => {
                if (result && typeof result === 'object' && 'items' in result) {
                    const { items } = result;
                    for (const itemData of items) {
                        try {
                            await this.inventoryService.createInventoryItem(ctx.organizationId, itemData);
                        }
                        catch (error) {
                            logger_1.logger.warn('Failed to restore inventory item', { error });
                        }
                    }
                }
            },
        });
        saga.addStep({
            name: 'deleteFleet',
            execute: async (ctx) => {
                await this.fleetService.delete(ctx.organizationId, ctx.fleetId);
                return { deleted: true, fleetId: ctx.fleetId };
            },
            compensate: async (ctx) => {
                const originalFleet = ctx.results.originalFleet;
                if (originalFleet) {
                    try {
                        await this.fleetService.createFleet(ctx.organizationId, {
                            id: originalFleet.id,
                            name: originalFleet.name,
                            description: originalFleet.description,
                        });
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to restore fleet during compensation', { error });
                    }
                }
            },
        });
        saga.addStep({
            name: 'sendDissolutionNotifications',
            execute: async (ctx) => {
                if (!ctx.notifyMembers) {
                    return { notificationsSent: 0 };
                }
                const originalFleet = ctx.results.originalFleet;
                const notifications = [];
                const memberIds = new Set();
                const removedMembers = ctx.results.removedMembers || [];
                for (const member of removedMembers) {
                    if (member.userId) {
                        memberIds.add(member.userId);
                    }
                }
                const recipientIds = Array.from(memberIds);
                const notificationPromises = recipientIds.map(userId => this.notificationService.create({
                    userId,
                    type: 'fleet_dissolved',
                    title: 'Fleet Dissolved',
                    message: `Fleet "${originalFleet.name}" has been dissolved${ctx.reason ? `: ${ctx.reason}` : ''}`,
                    data: {
                        fleetId: ctx.fleetId,
                        reason: ctx.reason,
                        dissolvedById: ctx.dissolvedById,
                    },
                }));
                const results = await Promise.allSettled(notificationPromises);
                notifications.push(...(0, communication_1.collectDeliveredNotifications)(results, recipientIds, 'fleet dissolution'));
                return { notificationsSent: notifications.length };
            },
            compensate: async () => {
            },
        });
        const result = await saga.execute(context);
        if (result.success) {
            logger_1.logger.info('Fleet dissolved successfully', {
                fleetId: params.fleetId,
                organizationId: params.organizationId,
            });
        }
        else {
            logger_1.logger.error('Failed to dissolve fleet', {
                error: result.error?.message,
                completedSteps: result.completed,
                compensatedSteps: result.compensated,
            });
        }
        return result;
    }
    async getFleetComposition(organizationId, fleetId) {
        const fleet = await this.fleetService.getFleetById(organizationId, fleetId);
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Fleet');
        }
        const shipIds = fleet.shipIds || [];
        const ships = await this.shipService.findByIds(organizationId, shipIds);
        const { byManufacturer, byRole, bySize, totalCargo, totalCrew, combatShips, miningShips } = this.classifyShips(ships);
        const recommendations = this.generateFleetRecommendations(ships, combatShips, totalCargo);
        let teamBreakdown;
        try {
            if (fleet.teamId) {
                const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
                const assignedTeam = await teamRepo.findOne({ where: { id: fleet.teamId } });
                if (assignedTeam) {
                    const teamMemberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
                    const memberCount = await teamMemberRepo.count({
                        where: { organizationId, teamId: fleet.teamId, status: 'active' },
                    });
                    teamBreakdown = [
                        {
                            teamId: assignedTeam.id,
                            teamName: assignedTeam.name,
                            teamType: assignedTeam.type,
                            memberCount,
                        },
                    ];
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to load team breakdown for fleet composition', {
                fleetId,
                organizationId,
                error: err,
            });
        }
        return {
            fleet,
            ships,
            composition: {
                totalShips: ships.length,
                byManufacturer,
                byRole,
                bySize,
            },
            capabilities: {
                combatPower: combatShips * COMBAT_POWER_PER_COMBAT_SHIP,
                cargoCapacity: totalCargo,
                crewCapacity: totalCrew,
                miningCapacity: miningShips * MINING_CAPACITY_PER_MINING_SHIP,
            },
            teamBreakdown,
            recommendations,
        };
    }
    classifyShips(ships) {
        const byManufacturer = {};
        const byRole = {};
        const bySize = {};
        let totalCargo = 0;
        let totalCrew = 0;
        let combatShips = 0;
        let miningShips = 0;
        for (const ship of ships) {
            const manufacturer = ship.manufacturer || 'Unknown';
            byManufacturer[manufacturer] = (byManufacturer[manufacturer] || 0) + 1;
            const role = ship.role || 'Unknown';
            byRole[role] = (byRole[role] || 0) + 1;
            const size = ship.size || 'Unknown';
            bySize[size] = (bySize[size] || 0) + 1;
            totalCrew += ship.maxCrew || 0;
            const roleLower = role.toLowerCase();
            if (roleLower.includes('combat') || roleLower.includes('fighter')) {
                combatShips++;
            }
            if (roleLower.includes('mining')) {
                miningShips++;
            }
            if (roleLower.includes('cargo') || roleLower.includes('freight')) {
                totalCargo += DEFAULT_CARGO_CAPACITY_FOR_CARGO_ROLE;
            }
        }
        return { byManufacturer, byRole, bySize, totalCargo, totalCrew, combatShips, miningShips };
    }
    generateFleetRecommendations(ships, combatShips, totalCargo) {
        const recommendations = [];
        if (ships.length < 3) {
            recommendations.push('Consider adding more ships to increase fleet capability');
        }
        if (combatShips === 0 && ships.length > 0) {
            recommendations.push('No combat ships in fleet - consider adding escort capability');
        }
        if (totalCargo === 0 && ships.length > 0) {
            recommendations.push('No cargo capacity - fleet cannot transport goods');
        }
        const combatRatio = ships.length > 0 ? combatShips / ships.length : 0;
        if (combatRatio > 0.8) {
            recommendations.push('Fleet is heavily combat-focused - consider diversifying');
        }
        return recommendations;
    }
}
exports.FleetAggregatorService = FleetAggregatorService;
//# sourceMappingURL=FleetAggregatorService.js.map