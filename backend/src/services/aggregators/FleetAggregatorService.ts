import { AppDataSource } from '../../data-source';
import { Fleet, FleetStatus } from '../../models/Fleet';
import {
  CreateInventoryItemDto,
  InventoryCategory,
  InventoryUnit,
} from '../../models/FleetInventory';
import { Ship } from '../../models/Ship';
import { Team } from '../../models/Team';
import { TeamMember } from '../../models/TeamMember';
import { NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import type { NotificationResult } from '../communication';
import { collectDeliveredNotifications, NotificationService } from '../communication';
import { DiscordService, getDiscordService } from '../discord/DiscordService';
import { FleetInventoryService } from '../fleet/FleetInventoryService';
import { FleetService } from '../fleet/FleetService';
import { FleetTeamService } from '../fleet/FleetTeamService';
import { ShipService } from '../ship/ShipService';
import { TeamService } from '../team/TeamService';

import { SagaOrchestrator, SagaResult } from './SagaOrchestrator';

/**
 * Fleet capability estimation constants.
 * Default values for simple fleet analysis metrics.
 * These can be overridden via environment variables for production tuning.
 */
const COMBAT_POWER_PER_COMBAT_SHIP = Number(process.env.FLEET_COMBAT_POWER_PER_SHIP) || 100;
const MINING_CAPACITY_PER_MINING_SHIP = Number(process.env.FLEET_MINING_CAPACITY_PER_SHIP) || 50;
const DEFAULT_CARGO_CAPACITY_FOR_CARGO_ROLE =
  Number(process.env.FLEET_DEFAULT_CARGO_CAPACITY) || 100;

/**
 * Parameters for creating a complete fleet setup
 */
export interface CreateFleetWithAssetsParams {
  organizationId: string;
  fleetData: {
    name: string;
    description?: string;
    leaderId?: string;
    [key: string]: unknown;
  };
  shipIds?: string[];
  squadronData?: {
    name: string;
    memberIds: string[];
    leaderId?: string;
  };
  inventoryItems?: Array<{
    itemName: string;
    quantity: number;
    category?: string;
    managerId?: string;
  }>;
  notifyMembers?: boolean;
  postToDiscord?: boolean;
  discordChannelId?: string;
}

/**
 * Parameters for fleet deployment
 */
export interface DeployFleetParams {
  organizationId: string;
  fleetId: string;
  deploymentData: {
    location: string;
    mission?: string;
    objectives?: string[];
    estimatedDuration?: number;
    deployedById: string;
  };
  notifyMembers?: boolean;
}

/**
 * Parameters for fleet dissolution
 */
export interface DissolveFleetParams {
  organizationId: string;
  fleetId: string;
  dissolvedById: string;
  reason?: string;
  reassignShipsToFleetId?: string;
  notifyMembers?: boolean;
}

/**
 * Fleet composition analysis result
 */
export interface FleetTeamBreakdown {
  teamId: string;
  teamName: string;
  teamType: string;
  memberCount: number;
}

export interface FleetCompositionAnalysis {
  fleet: Fleet;
  ships: Ship[];
  composition: {
    totalShips: number;
    byManufacturer: Record<string, number>;
    byRole: Record<string, number>;
    bySize: Record<string, number>;
  };
  capabilities: {
    combatPower: number;
    cargoCapacity: number;
    crewCapacity: number;
    miningCapacity: number;
  };
  teamBreakdown?: FleetTeamBreakdown[];
  recommendations: string[];
}

/**
 * Fleet Aggregator Service
 *
 * Handles complex multi-service operations for fleets using the Saga pattern:
 * - Creating fleets with ships, squadrons, and inventory
 * - Deploying fleets with notifications and logging
 * - Dissolving fleets with asset reassignment
 * - Fleet composition analysis
 *
 * Uses SagaOrchestrator for automatic compensation (rollback) on failure.
 */
export class FleetAggregatorService {
  private readonly fleetService: FleetService;
  private readonly shipService: ShipService;
  private readonly teamService: TeamService;
  private readonly inventoryService: FleetInventoryService;
  private readonly notificationService: NotificationService;
  private readonly discordService: DiscordService;

  constructor() {
    this.fleetService = new FleetService();
    this.shipService = new ShipService();
    this.teamService = new TeamService();
    this.inventoryService = new FleetInventoryService();
    this.notificationService = new NotificationService(undefined, undefined);
    this.discordService = getDiscordService();
  }

  /**
   * Create a complete fleet setup with ships, squadron, and inventory using Saga pattern
   * Automatically rolls back on failure
   */
  async createFleetWithAssets(
    params: CreateFleetWithAssetsParams
  ): Promise<SagaResult<Record<string, unknown>>> {
    const saga = new SagaOrchestrator<
      CreateFleetWithAssetsParams & { results: Record<string, unknown> }
    >({
      name: 'CreateFleetWithAssets',
      maxRetries: 2,
      retryDelayMs: 500,
    });

    // Initialize context with empty results
    const context = { ...params, results: {} as Record<string, unknown> };

    // Step 1: Create the fleet (with auto-created team)
    saga.addStep({
      name: 'createFleet',
      execute: async ctx => {
        const fleet = await this.fleetService.createFleet(ctx.organizationId, {
          name: ctx.fleetData.name,
          description: ctx.fleetData.description,
          leaderId: ctx.fleetData.leaderId,
        });
        // Auto-create team for the fleet
        const fleetWithTeam = await this.fleetService.postCreateFleet(ctx.organizationId, fleet);
        ctx.results.fleet = fleetWithTeam;
        return fleetWithTeam;
      },
      compensate: async (ctx, fleet) => {
        if (fleet && typeof fleet === 'object' && 'id' in fleet) {
          await this.fleetService.delete(ctx.organizationId, fleet.id);
          logger.info('Compensated: Deleted fleet', { fleetId: fleet.id });
        }
      },
    });

    // Step 2: Assign ships to fleet (if provided)
    // Note: Ships are linked via shipIds array on fleet, not via fleetId on ship
    saga.addStep({
      name: 'assignShips',
      execute: async ctx => {
        if (!ctx.shipIds || ctx.shipIds.length === 0) {
          return { assignedCount: 0, shipIds: [] };
        }

        const fleet = ctx.results.fleet as Fleet;
        const assignedShips: string[] = [];

        // Atomically merge ship IDs into the fleet under a row lock (PERF-01).
        try {
          await this.fleetService.addShipIdsToFleet(ctx.organizationId, fleet.id, ctx.shipIds);
          assignedShips.push(...ctx.shipIds);
        } catch (error: unknown) {
          logger.warn('Failed to assign ships to fleet', { fleetId: fleet.id, error });
        }

        ctx.results.assignedShips = assignedShips;

        // Sync team capacity after ships are assigned
        if (assignedShips.length > 0) {
          const fleetTeamService = FleetTeamService.getInstance();
          await fleetTeamService.syncTeamCapacity(ctx.organizationId, fleet.id);
        }

        return { assignedCount: assignedShips.length, shipIds: assignedShips };
      },
      compensate: async (ctx, result) => {
        if (result && typeof result === 'object' && 'shipIds' in result) {
          const fleet = ctx.results.fleet as Fleet;
          const assigned = (result as { shipIds: string[] }).shipIds;
          try {
            // Atomically remove exactly the ships we assigned (PERF-01).
            await this.fleetService.removeShipIdsFromFleet(ctx.organizationId, fleet.id, assigned);
          } catch (error: unknown) {
            logger.warn('Failed to unassign ships during compensation', { error });
          }
          logger.info('Compensated: Unassigned ships', {
            count: assigned.length,
          });
        }
      },
    });

    // Step 3: Add team members (if provided)
    saga.addStep({
      name: 'addTeamMembers',
      execute: async ctx => {
        if (!ctx.squadronData) {
          return null;
        }

        const fleet = ctx.results.fleet as Fleet;
        if (!fleet.teamId) {
          logger.warn('Fleet has no teamId, skipping team member assignment', {
            fleetId: fleet.id,
          });
          return null;
        }

        const memberIds = ctx.squadronData.memberIds || [];
        if (memberIds.length === 0) {
          return { addedCount: 0, memberIds: [] };
        }

        const members = memberIds.map((userId: string) => ({
          userId,
          role: 'member' as const,
        }));
        await this.teamService.bulkAddMembers(ctx.organizationId, fleet.teamId, members);

        ctx.results.addedMemberIds = memberIds;
        return { addedCount: memberIds.length, memberIds, teamId: fleet.teamId };
      },
      compensate: async (ctx, result) => {
        if (result && typeof result === 'object' && 'memberIds' in result) {
          const { memberIds, teamId } = result as { memberIds: string[]; teamId: string };
          for (const userId of memberIds) {
            try {
              const membership = await this.teamService.getMembership(
                ctx.organizationId,
                teamId,
                userId
              );
              if (membership) {
                await this.teamService.removeMember(ctx.organizationId, teamId, membership.id);
              }
            } catch (error: unknown) {
              logger.warn('Failed to remove team member during compensation', { userId, error });
            }
          }
          logger.info('Compensated: Removed team members', { count: memberIds.length });
        }
      },
    });

    // Step 4: Create inventory items (if provided)
    saga.addStep({
      name: 'createInventory',
      execute: async ctx => {
        if (!ctx.inventoryItems || ctx.inventoryItems.length === 0) {
          return { createdCount: 0, itemIds: [] };
        }

        const fleet = ctx.results.fleet as Fleet;
        const createdItems: string[] = [];

        for (const item of ctx.inventoryItems) {
          try {
            const inventoryItem = await this.inventoryService.createInventoryItem(
              ctx.organizationId,
              {
                fleetId: fleet.id,
                itemName: item.itemName,
                quantity: item.quantity,
                category: (item.category as InventoryCategory) || InventoryCategory.OTHER,
                unit: InventoryUnit.UNITS,
                thresholds: {
                  criticalLevel: Math.floor(item.quantity * 0.1),
                  lowLevel: Math.floor(item.quantity * 0.25),
                  targetLevel: item.quantity,
                  maxLevel: item.quantity * 2,
                },
                managerId: item.managerId || ctx.fleetData.leaderId || 'system',
              }
            );
            createdItems.push(inventoryItem.id);
          } catch (error: unknown) {
            logger.warn('Failed to create inventory item', { itemName: item.itemName, error });
          }
        }

        ctx.results.inventoryItems = createdItems;
        return { createdCount: createdItems.length, itemIds: createdItems };
      },
      compensate: async (ctx, result) => {
        if (result && typeof result === 'object' && 'itemIds' in result) {
          const { itemIds } = result as { itemIds: string[] };
          for (const itemId of itemIds) {
            try {
              await this.inventoryService.deleteInventoryItem(ctx.organizationId, itemId);
            } catch (error: unknown) {
              logger.warn('Failed to delete inventory item during compensation', { itemId, error });
            }
          }
          logger.info('Compensated: Deleted inventory items', { count: itemIds.length });
        }
      },
    });

    // Step 5: Send notifications (non-compensatable, optional)
    saga.addStep({
      name: 'sendNotifications',
      execute: async ctx => {
        const notifications: NotificationResult[] = [];

        // Send in-app notifications
        if (ctx.notifyMembers && ctx.squadronData?.memberIds) {
          const fleet = ctx.results.fleet as Fleet;
          const recipientIds = ctx.squadronData.memberIds;
          const notificationPromises = recipientIds.map(userId =>
            this.notificationService.create({
              userId,
              type: 'fleet_created',
              title: 'Fleet Created',
              message: `You've been added to fleet: ${fleet.name}`,
              data: {
                fleetId: fleet.id,
                organizationId: ctx.organizationId,
              },
            })
          );

          const results = await Promise.allSettled(notificationPromises);
          // PERF-02: only count notifications that actually delivered
          // (success === true), not every settled promise.
          notifications.push(
            ...collectDeliveredNotifications(results, recipientIds, 'fleet creation')
          );
        }

        // Post to Discord
        if (ctx.postToDiscord && ctx.discordChannelId) {
          const fleet = ctx.results.fleet as Fleet;
          try {
            await this.discordService.sendMessage(
              ctx.discordChannelId,
              `🚀 New Fleet Created: **${fleet.name}**\n${fleet.description || 'No description'}`
            );
          } catch (error: unknown) {
            logger.warn('Failed to post fleet creation to Discord', { error });
          }
        }

        return { notificationsSent: notifications.length };
      },
      compensate: async () => {
        // Notifications are not compensatable
        logger.info('Notifications cannot be compensated');
      },
    });

    // Execute the saga
    const result = await saga.execute(context);

    if (result.success) {
      logger.info('Fleet created with assets successfully', {
        fleetId: (context.results.fleet as Fleet)?.id,
        organizationId: params.organizationId,
      });
    } else {
      logger.error('Failed to create fleet with assets', {
        error: result.error?.message,
        completedSteps: result.completed,
        compensatedSteps: result.compensated,
      });
    }

    return result;
  }

  /**
   * Deploy a fleet with notifications and logging
   */
  async deployFleet(params: DeployFleetParams): Promise<{
    fleet: Fleet | null;
    deployment: {
      location: string;
      mission?: string;
      deployedAt: Date;
    };
    notifications: unknown[];
  }> {
    return AppDataSource.transaction(async () => {
      try {
        // 1. Get and update fleet
        const fleet = await this.fleetService.getFleetById(params.organizationId, params.fleetId);

        if (!fleet) {
          throw new NotFoundError('Fleet');
        }

        // Update fleet status
        const updatedFleet = await this.fleetService.update(params.organizationId, params.fleetId, {
          status: FleetStatus.DEPLOYED,
          deploymentLocation: params.deploymentData.location,
          deployedAt: new Date(),
          primaryActivity: params.deploymentData.mission,
        });

        logger.info('Fleet deployed', {
          fleetId: params.fleetId,
          location: params.deploymentData.location,
        });

        // 2. Get team members for notifications
        const notifications: NotificationResult[] = [];
        if (params.notifyMembers) {
          try {
            const memberIds = new Set<string>();
            if (fleet.teamId) {
              const teamMembers = await this.teamService.getTeamMembers(
                params.organizationId,
                fleet.teamId
              );
              for (const tm of teamMembers) {
                if (tm.userId) {
                  memberIds.add(tm.userId);
                }
              }
            }

            const recipientIds = Array.from(memberIds);
            const notificationPromises = recipientIds.map(userId =>
              this.notificationService.create({
                userId,
                type: 'fleet_deployed',
                title: 'Fleet Deployed',
                message: `Fleet "${fleet.name}" has been deployed to ${params.deploymentData.location}`,
                data: {
                  fleetId: params.fleetId,
                  location: params.deploymentData.location,
                  mission: params.deploymentData.mission,
                },
              })
            );

            const results = await Promise.allSettled(notificationPromises);
            // PERF-02: only count notifications that actually delivered
            // (success === true), not every settled promise.
            notifications.push(
              ...collectDeliveredNotifications(results, recipientIds, 'fleet deployment')
            );
          } catch (error: unknown) {
            logger.warn('Failed to send deployment notifications', { error });
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
      } catch (error: unknown) {
        logger.error('Failed to deploy fleet', { error });
        throw error;
      }
    });
  }

  /**
   * Dissolve a fleet with optional asset reassignment using Saga pattern
   */
  async dissolveFleet(params: DissolveFleetParams): Promise<SagaResult<Record<string, unknown>>> {
    const saga = new SagaOrchestrator<DissolveFleetParams & { results: Record<string, unknown> }>({
      name: 'DissolveFleet',
      maxRetries: 2,
      retryDelayMs: 500,
    });

    const context = { ...params, results: {} as Record<string, unknown> };

    // Step 1: Get fleet and validate
    saga.addStep({
      name: 'validateFleet',
      execute: async ctx => {
        const fleet = await this.fleetService.getFleetById(ctx.organizationId, ctx.fleetId);
        if (!fleet) {
          throw new NotFoundError('Fleet');
        }
        ctx.results.originalFleet = fleet;
        return fleet;
      },
      compensate: async () => {
        // No compensation needed for validation
      },
    });

    // Step 2: Get shipIds from fleet and handle reassignment
    saga.addStep({
      name: 'reassignShips',
      execute: async ctx => {
        const originalFleet = ctx.results.originalFleet as Fleet;
        const shipIds = originalFleet.shipIds || [];

        if (shipIds.length === 0) {
          return { count: 0, ships: [] };
        }

        const reassignedShips: Array<{ id: string; previousFleetId: string }> = [];

        // If reassigning to another fleet, update that fleet's shipIds
        if (ctx.reassignShipsToFleetId) {
          try {
            const targetFleet = await this.fleetService.getFleetById(
              ctx.organizationId,
              ctx.reassignShipsToFleetId
            );
            if (targetFleet) {
              // Atomically merge into the target fleet under a row lock (PERF-01).
              await this.fleetService.addShipIdsToFleet(
                ctx.organizationId,
                ctx.reassignShipsToFleetId,
                shipIds
              );
              shipIds.forEach(id => reassignedShips.push({ id, previousFleetId: ctx.fleetId }));
            }
          } catch (error: unknown) {
            logger.warn('Failed to reassign ships to target fleet', { error });
          }
        } else {
          // Just track that ships were in this fleet
          shipIds.forEach(id => reassignedShips.push({ id, previousFleetId: ctx.fleetId }));
        }

        ctx.results.reassignedShips = reassignedShips;
        return { count: reassignedShips.length, ships: reassignedShips };
      },
      compensate: async (ctx, result) => {
        if (result && typeof result === 'object' && 'ships' in result) {
          const { ships } = result as { ships: Array<{ id: string; previousFleetId: string }> };
          // If we reassigned to another fleet, remove them from that fleet
          if (ctx.reassignShipsToFleetId && ships.length > 0) {
            try {
              // Atomically remove the reassigned ships from the target fleet (PERF-01).
              await this.fleetService.removeShipIdsFromFleet(
                ctx.organizationId,
                ctx.reassignShipsToFleetId,
                ships.map(s => s.id)
              );
            } catch (error: unknown) {
              logger.warn('Failed to restore ship assignments during compensation', { error });
            }
          }
        }
      },
    });

    // Step 3: Remove team members
    saga.addStep({
      name: 'removeTeamMembers',
      execute: async ctx => {
        const originalFleet = ctx.results.originalFleet as Fleet;
        if (!originalFleet.teamId) {
          return { count: 0, members: [] };
        }

        const teamMembers = await this.teamService.getTeamMembers(
          ctx.organizationId,
          originalFleet.teamId
        );

        const removedMembers: Array<{ userId: string; role: string }> = [];
        for (const member of teamMembers) {
          try {
            removedMembers.push({ userId: member.userId, role: member.role });
            await this.teamService.removeMember(
              ctx.organizationId,
              originalFleet.teamId,
              member.id
            );
          } catch (error: unknown) {
            logger.warn('Failed to remove team member', {
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
          const { members } = result as { members: Array<{ userId: string; role: string }> };
          const originalFleet = ctx.results.originalFleet as Fleet;
          if (originalFleet.teamId) {
            for (const memberData of members) {
              try {
                await this.teamService.addMember(
                  ctx.organizationId,
                  originalFleet.teamId,
                  memberData.userId,
                  memberData.role as 'leader' | 'officer' | 'member'
                );
              } catch (error: unknown) {
                logger.warn('Failed to restore team member', { error });
              }
            }
          }
        }
      },
    });

    // Step 4: Delete inventory
    saga.addStep({
      name: 'deleteInventory',
      execute: async ctx => {
        const inventory = await this.inventoryService.getInventory(ctx.organizationId, {
          fleetId: ctx.fleetId,
        });

        const deletedItems: unknown[] = [];
        for (const item of inventory.items) {
          try {
            deletedItems.push({ ...item });
            await this.inventoryService.deleteInventoryItem(ctx.organizationId, item.id);
          } catch (error: unknown) {
            logger.warn('Failed to delete inventory item', { itemId: item.id, error });
          }
        }

        ctx.results.deletedInventory = deletedItems;
        return { count: deletedItems.length, items: deletedItems };
      },
      compensate: async (ctx, result) => {
        if (result && typeof result === 'object' && 'items' in result) {
          const { items } = result as { items: unknown[] };
          for (const itemData of items) {
            try {
              await this.inventoryService.createInventoryItem(
                ctx.organizationId,
                itemData as CreateInventoryItemDto
              );
            } catch (error: unknown) {
              logger.warn('Failed to restore inventory item', { error });
            }
          }
        }
      },
    });

    // Step 5: Delete fleet
    saga.addStep({
      name: 'deleteFleet',
      execute: async ctx => {
        await this.fleetService.delete(ctx.organizationId, ctx.fleetId);
        return { deleted: true, fleetId: ctx.fleetId };
      },
      compensate: async ctx => {
        // Restore fleet
        const originalFleet = ctx.results.originalFleet as Fleet;
        if (originalFleet) {
          try {
            await this.fleetService.createFleet(ctx.organizationId, {
              id: originalFleet.id,
              name: originalFleet.name,
              description: originalFleet.description,
            });
          } catch (error: unknown) {
            logger.error('Failed to restore fleet during compensation', { error });
          }
        }
      },
    });

    // Step 6: Send notifications (non-compensatable)
    saga.addStep({
      name: 'sendDissolutionNotifications',
      execute: async ctx => {
        if (!ctx.notifyMembers) {
          return { notificationsSent: 0 };
        }

        const originalFleet = ctx.results.originalFleet as Fleet;
        const notifications: NotificationResult[] = [];

        // Get member IDs from removed team members
        const memberIds = new Set<string>();
        const removedMembers = (ctx.results.removedMembers as Array<{ userId: string }>) || [];
        for (const member of removedMembers) {
          if (member.userId) {
            memberIds.add(member.userId);
          }
        }

        const recipientIds = Array.from(memberIds);
        const notificationPromises = recipientIds.map(userId =>
          this.notificationService.create({
            userId,
            type: 'fleet_dissolved',
            title: 'Fleet Dissolved',
            message: `Fleet "${originalFleet.name}" has been dissolved${ctx.reason ? `: ${ctx.reason}` : ''}`,
            data: {
              fleetId: ctx.fleetId,
              reason: ctx.reason,
              dissolvedById: ctx.dissolvedById,
            },
          })
        );

        const results = await Promise.allSettled(notificationPromises);
        // PERF-02: only count notifications that actually delivered
        // (success === true), not every settled promise.
        notifications.push(
          ...collectDeliveredNotifications(results, recipientIds, 'fleet dissolution')
        );

        return { notificationsSent: notifications.length };
      },
      compensate: async () => {
        // Notifications cannot be compensated
      },
    });

    const result = await saga.execute(context);

    if (result.success) {
      logger.info('Fleet dissolved successfully', {
        fleetId: params.fleetId,
        organizationId: params.organizationId,
      });
    } else {
      logger.error('Failed to dissolve fleet', {
        error: result.error?.message,
        completedSteps: result.completed,
        compensatedSteps: result.compensated,
      });
    }

    return result;
  }

  /**
   * Get fleet with comprehensive details and composition analysis
   */
  async getFleetComposition(
    organizationId: string,
    fleetId: string
  ): Promise<FleetCompositionAnalysis> {
    const fleet = await this.fleetService.getFleetById(organizationId, fleetId);

    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    // Get ships from fleet's shipIds (batch fetch to avoid N+1)
    const shipIds = fleet.shipIds || [];
    const ships = await this.shipService.findByIds(organizationId, shipIds);

    // Calculate composition
    const { byManufacturer, byRole, bySize, totalCargo, totalCrew, combatShips, miningShips } =
      this.classifyShips(ships);

    // Generate recommendations
    const recommendations = this.generateFleetRecommendations(ships, combatShips, totalCargo);

    // Cross-reference fleet members with teams
    // Phase 1.4: Use direct teamId FK when available, fall back to member inference
    let teamBreakdown: FleetTeamBreakdown[] | undefined;
    try {
      if (fleet.teamId) {
        // Direct FK lookup — fleet is explicitly assigned to a team
        // Use TeamMember as canonical source (Sprint 12-C3)
        const teamRepo = AppDataSource.getRepository(Team);
        const assignedTeam = await teamRepo.findOne({ where: { id: fleet.teamId } });
        if (assignedTeam) {
          const teamMemberRepo = AppDataSource.getRepository(TeamMember);
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
    } catch (err: unknown) {
      logger.warn('Failed to load team breakdown for fleet composition', {
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

  /**
   * Classify ships by manufacturer, role, size, and capabilities
   */
  private classifyShips(ships: Ship[]): {
    byManufacturer: Record<string, number>;
    byRole: Record<string, number>;
    bySize: Record<string, number>;
    totalCargo: number;
    totalCrew: number;
    combatShips: number;
    miningShips: number;
  } {
    const byManufacturer: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    const bySize: Record<string, number> = {};
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

  /**
   * Generate fleet composition recommendations
   */
  private generateFleetRecommendations(
    ships: Ship[],
    combatShips: number,
    totalCargo: number
  ): string[] {
    const recommendations: string[] = [];
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

