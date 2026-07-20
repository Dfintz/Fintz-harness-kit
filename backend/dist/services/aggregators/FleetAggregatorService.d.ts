import { Fleet } from '../../models/Fleet';
import { Ship } from '../../models/Ship';
import { SagaResult } from './SagaOrchestrator';
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
export interface DissolveFleetParams {
    organizationId: string;
    fleetId: string;
    dissolvedById: string;
    reason?: string;
    reassignShipsToFleetId?: string;
    notifyMembers?: boolean;
}
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
export declare class FleetAggregatorService {
    private readonly fleetService;
    private readonly shipService;
    private readonly teamService;
    private readonly inventoryService;
    private readonly notificationService;
    private readonly discordService;
    constructor();
    createFleetWithAssets(params: CreateFleetWithAssetsParams): Promise<SagaResult<Record<string, unknown>>>;
    deployFleet(params: DeployFleetParams): Promise<{
        fleet: Fleet | null;
        deployment: {
            location: string;
            mission?: string;
            deployedAt: Date;
        };
        notifications: unknown[];
    }>;
    dissolveFleet(params: DissolveFleetParams): Promise<SagaResult<Record<string, unknown>>>;
    getFleetComposition(organizationId: string, fleetId: string): Promise<FleetCompositionAnalysis>;
    private classifyShips;
    private generateFleetRecommendations;
}
//# sourceMappingURL=FleetAggregatorService.d.ts.map