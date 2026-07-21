import { Fleet, FleetStatus } from '../../models/Fleet';
import {
  CreateFleetWithAssetsParams,
  DeployFleetParams,
  DissolveFleetParams,
  FleetAggregatorService,
} from '../aggregators/FleetAggregatorService';
import { NotificationService } from '../communication';
import { FleetInventoryService } from '../fleet/FleetInventoryService';
import { FleetService } from '../fleet/FleetService';
import { ShipService } from '../ship/ShipService';
import { TeamService } from '../team/TeamService';

// Mock all dependencies
jest.mock('../fleet/FleetService');
jest.mock('../fleet/FleetInventoryService');
jest.mock('../fleet/FleetTeamService', () => ({
  FleetTeamService: {
    getInstance: () => ({
      autoCreateTeamForFleet: jest
        .fn()
        .mockImplementation((_orgId: string, fleet: unknown) => Promise.resolve(fleet)),
      syncTeamCapacity: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));
jest.mock('../team/TeamService', () => ({
  TeamService: jest.fn().mockImplementation(() => ({
    bulkAddMembers: jest.fn(),
  })),
}));
jest.mock('../ship/ShipService');
jest.mock('../communication', () => ({
  NotificationService: jest.fn(),
  // The saga spreads this helper's result, so it must return an array.
  collectDeliveredNotifications: jest.fn(() => []),
}));

// Mock Discord service
const mockDiscordServiceInstance = {
  sendMessage: jest.fn().mockResolvedValue(undefined),
} as any;

jest.mock('../discord/DiscordService', () => ({
  DiscordService: jest.fn(),
  getDiscordService: jest.fn(() => mockDiscordServiceInstance),
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    transaction: jest.fn(callback => callback({})),
  },
}));

describe('FleetAggregatorService', () => {
  let service: FleetAggregatorService;
  let mockFleetService: jest.Mocked<FleetService>;
  let mockShipService: jest.Mocked<ShipService>;
  let mockTeamService: jest.Mocked<TeamService>;
  let mockInventoryService: jest.Mocked<FleetInventoryService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  const mockFleet: Partial<Fleet> = {
    id: 'fleet-123',
    name: 'Alpha Squadron Fleet',
    description: 'Primary combat fleet',
    organizationId: 'org-456',
    status: FleetStatus.ACTIVE,
    shipIds: [],
    members: [],
    teamId: 'team-789',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new FleetAggregatorService();

    // Access internal services
    mockFleetService = (service as any).fleetService;
    mockShipService = (service as any).shipService;
    mockTeamService = (service as any).teamService;
    mockInventoryService = (service as any).inventoryService;
    mockNotificationService = (service as any).notificationService;

    // Default mock: postCreateFleet returns the fleet unchanged
    mockFleetService.postCreateFleet = jest
      .fn()
      .mockImplementation((_orgId: string, fleet: unknown) => Promise.resolve(fleet));
  });

  describe('createFleetWithAssets', () => {
    const baseParams: CreateFleetWithAssetsParams = {
      organizationId: 'org-456',
      fleetData: {
        name: 'Alpha Squadron Fleet',
        description: 'Primary combat fleet',
        leaderId: 'user-leader',
      },
      shipIds: ['ship-1', 'ship-2'],
      squadronData: {
        name: 'Alpha Squadron',
        memberIds: ['user-1', 'user-2'],
        leaderId: 'user-leader',
      },
      inventoryItems: [
        { itemName: 'Fuel', quantity: 100 },
        { itemName: 'Ammunition', quantity: 500 },
      ],
      notifyMembers: true,
      postToDiscord: true,
      discordChannelId: 'channel-123',
    };

    it('should create fleet with all assets successfully', async () => {
      // Arrange
      mockFleetService.createFleet = jest.fn().mockResolvedValue(mockFleet);
      mockFleetService.update = jest
        .fn()
        .mockResolvedValue({ ...mockFleet, shipIds: ['ship-1', 'ship-2'] });
      mockTeamService.bulkAddMembers = jest.fn().mockResolvedValue(undefined);
      mockInventoryService.createInventoryItem = jest
        .fn()
        .mockResolvedValueOnce({ id: 'inv-1', itemName: 'Fuel' })
        .mockResolvedValueOnce({ id: 'inv-2', itemName: 'Ammunition' });
      (mockNotificationService as any).create = jest.fn().mockResolvedValue({ id: 'notif-1' });

      // Act
      const result = await service.createFleetWithAssets(baseParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.completed).toContain('createFleet');
      expect(result.completed).toContain('assignShips');
      expect(result.completed).toContain('addTeamMembers');
      expect(result.completed).toContain('createInventory');
      expect(mockFleetService.createFleet).toHaveBeenCalledWith(
        'org-456',
        expect.objectContaining({
          name: 'Alpha Squadron Fleet',
        })
      );
    });

    it('should create fleet without optional assets', async () => {
      // Arrange
      const minimalParams: CreateFleetWithAssetsParams = {
        organizationId: 'org-456',
        fleetData: {
          name: 'Simple Fleet',
        },
      };

      mockFleetService.createFleet = jest.fn().mockResolvedValue(mockFleet);

      // Act
      const result = await service.createFleetWithAssets(minimalParams);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTeamService.bulkAddMembers).not.toHaveBeenCalled();
      expect(mockInventoryService.createInventoryItem).not.toHaveBeenCalled();
    });

    it('should compensate on failure', async () => {
      // Arrange
      mockFleetService.createFleet = jest.fn().mockResolvedValue(mockFleet);
      mockFleetService.update = jest.fn().mockResolvedValue({ ...mockFleet, shipIds: ['ship-1'] });
      mockFleetService.delete = jest.fn().mockResolvedValue(undefined);
      mockTeamService.bulkAddMembers = jest
        .fn()
        .mockRejectedValue(new Error('Team member addition failed'));

      // Act
      const result = await service.createFleetWithAssets(baseParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.failed).toBe('addTeamMembers');
      expect(result.compensated).toBeDefined();
    });

    it('should post to Discord when requested', async () => {
      // Arrange
      mockFleetService.createFleet = jest.fn().mockResolvedValue(mockFleet);

      const paramsWithDiscord: CreateFleetWithAssetsParams = {
        organizationId: 'org-456',
        fleetData: { name: 'Discord Fleet' },
        postToDiscord: true,
        discordChannelId: 'channel-123',
      };

      // Act
      await service.createFleetWithAssets(paramsWithDiscord);

      // Assert
      expect(mockDiscordServiceInstance.sendMessage).toHaveBeenCalledWith(
        'channel-123',
        expect.stringContaining('Alpha Squadron Fleet') // Uses mockFleet.name
      );
    });
  });

  describe('deployFleet', () => {
    const deployParams: DeployFleetParams = {
      organizationId: 'org-456',
      fleetId: 'fleet-123',
      deploymentData: {
        location: 'Stanton System',
        mission: 'Mining Operation',
        deployedById: 'user-leader',
      },
      notifyMembers: true,
    };

    it('should deploy fleet successfully', async () => {
      // Arrange
      mockFleetService.getFleetById = jest.fn().mockResolvedValue(mockFleet);
      mockFleetService.update = jest.fn().mockResolvedValue({
        ...mockFleet,
        status: FleetStatus.DEPLOYED,
        deploymentLocation: 'Stanton System',
      });
      mockTeamService.getTeamMembers = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.deployFleet(deployParams);

      // Assert
      expect(result.fleet).toBeDefined();
      expect(result.deployment.location).toBe('Stanton System');
      expect(mockFleetService.update).toHaveBeenCalledWith(
        'org-456',
        'fleet-123',
        expect.objectContaining({
          status: FleetStatus.DEPLOYED,
          deploymentLocation: 'Stanton System',
        })
      );
    });

    it('should throw error when fleet not found', async () => {
      // Arrange
      mockFleetService.getFleetById = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.deployFleet(deployParams)).rejects.toThrow('Fleet not found');
    });
  });

  describe('dissolveFleet', () => {
    const dissolveParams: DissolveFleetParams = {
      organizationId: 'org-456',
      fleetId: 'fleet-123',
      dissolvedById: 'user-admin',
      reason: 'Reorganization',
      notifyMembers: true,
    };

    it('should dissolve fleet successfully', async () => {
      // Arrange
      const fleetWithAssets = {
        ...mockFleet,
        shipIds: ['ship-1', 'ship-2'],
      };

      mockFleetService.getFleetById = jest.fn().mockResolvedValue(fleetWithAssets);
      mockFleetService.delete = jest.fn().mockResolvedValue(undefined);
      mockTeamService.getTeamMembers = jest.fn().mockResolvedValue([
        { id: 'tm-1', userId: 'user-1', role: 'member' },
        { id: 'tm-2', userId: 'user-2', role: 'member' },
      ]);
      mockTeamService.removeMember = jest.fn().mockResolvedValue(undefined);
      mockInventoryService.getInventory = jest
        .fn()
        .mockResolvedValue({ items: [], pagination: {} });
      (mockNotificationService as any).create = jest.fn().mockResolvedValue({ id: 'notif-1' });

      // Act
      const result = await service.dissolveFleet(dissolveParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.completed).toContain('deleteFleet');
      expect(mockFleetService.delete).toHaveBeenCalledWith('org-456', 'fleet-123');
    });

    it('should reassign ships to another fleet', async () => {
      // Arrange
      const paramsWithReassign: DissolveFleetParams = {
        ...dissolveParams,
        reassignShipsToFleetId: 'fleet-target',
      };

      const sourceFleet = { ...mockFleet, shipIds: ['ship-1'] };
      const targetFleet = { ...mockFleet, id: 'fleet-target', shipIds: [] };

      mockFleetService.getFleetById = jest
        .fn()
        .mockResolvedValueOnce(sourceFleet) // Source fleet
        .mockResolvedValueOnce(targetFleet); // Target fleet for reassignment
      mockFleetService.update = jest.fn().mockResolvedValue(targetFleet);
      mockFleetService.delete = jest.fn().mockResolvedValue(undefined);
      mockTeamService.getTeamMembers = jest.fn().mockResolvedValue([]);
      mockTeamService.removeMember = jest.fn().mockResolvedValue(undefined);
      mockInventoryService.getInventory = jest
        .fn()
        .mockResolvedValue({ items: [], pagination: {} });

      // Act
      const result = await service.dissolveFleet(paramsWithReassign);

      // Assert
      expect(result.success).toBe(true);
      // Ships are reassigned by atomically merging them into the target fleet (PERF-01).
      expect(mockFleetService.addShipIdsToFleet).toHaveBeenCalledWith('org-456', 'fleet-target', [
        'ship-1',
      ]);
    });

    it('should compensate on failure', async () => {
      // Arrange
      mockFleetService.getFleetById = jest.fn().mockResolvedValue(mockFleet);
      mockTeamService.getTeamMembers = jest.fn().mockResolvedValue([]);
      mockTeamService.removeMember = jest.fn().mockResolvedValue(undefined);
      mockInventoryService.getInventory = jest
        .fn()
        .mockResolvedValue({ items: [], pagination: {} });
      mockFleetService.delete = jest.fn().mockRejectedValue(new Error('Delete failed'));
      mockFleetService.createFleet = jest.fn().mockResolvedValue(mockFleet); // For compensation

      // Act
      const result = await service.dissolveFleet(dissolveParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.failed).toBe('deleteFleet');
    });
  });

  describe('getFleetComposition', () => {
    it('should return fleet composition analysis', async () => {
      // Arrange
      const fleetWithShips = {
        ...mockFleet,
        shipIds: ['ship-1', 'ship-2', 'ship-3'],
      };

      const mockShips = [
        { id: 'ship-1', manufacturer: 'Aegis', role: 'Combat Fighter', size: 'medium', maxCrew: 2 },
        { id: 'ship-2', manufacturer: 'RSI', role: 'Mining', size: 'large', maxCrew: 4 },
        { id: 'ship-3', manufacturer: 'Aegis', role: 'Combat Fighter', size: 'medium', maxCrew: 2 },
      ];

      mockFleetService.getFleetById = jest.fn().mockResolvedValue(fleetWithShips);
      mockShipService.findByIds = jest.fn().mockResolvedValue(mockShips);

      // Act
      const result = await service.getFleetComposition('org-456', 'fleet-123');

      // Assert
      expect(result.fleet).toEqual(fleetWithShips);
      expect(result.ships).toHaveLength(3);
      expect(result.composition.totalShips).toBe(3);
      expect(result.composition.byManufacturer['Aegis']).toBe(2);
      expect(result.composition.byManufacturer['RSI']).toBe(1);
      expect(result.composition.byRole['Combat Fighter']).toBe(2);
      expect(result.composition.byRole['Mining']).toBe(1);
      expect(result.capabilities.crewCapacity).toBe(8);
    });

    it('should throw error when fleet not found', async () => {
      // Arrange
      mockFleetService.getFleetById = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.getFleetComposition('org-456', 'nonexistent')).rejects.toThrow(
        'Fleet not found'
      );
    });

    it('should provide recommendations for small fleet', async () => {
      // Arrange
      const smallFleet = { ...mockFleet, shipIds: ['ship-1'] };

      mockFleetService.getFleetById = jest.fn().mockResolvedValue(smallFleet);
      mockShipService.findByIds = jest.fn().mockResolvedValue([
        {
          id: 'ship-1',
          manufacturer: 'Misc',
          role: 'Transport',
          size: 'large',
          maxCrew: 6,
        },
      ]);

      // Act
      const result = await service.getFleetComposition('org-456', 'fleet-123');

      // Assert
      expect(result.recommendations).toContain(
        'Consider adding more ships to increase fleet capability'
      );
      expect(result.recommendations).toContain(
        'No combat ships in fleet - consider adding escort capability'
      );
    });
  });

  describe('Saga Pattern Integration', () => {
    it('should use saga for createFleetWithAssets', async () => {
      // Arrange
      mockFleetService.createFleet = jest.fn().mockResolvedValue(mockFleet);

      const params: CreateFleetWithAssetsParams = {
        organizationId: 'org-456',
        fleetData: { name: 'Saga Test Fleet' },
      };

      // Act
      const result = await service.createFleetWithAssets(params);

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('data');
    });

    it('should use saga for dissolveFleet', async () => {
      // Arrange
      mockFleetService.getFleetById = jest.fn().mockResolvedValue({ ...mockFleet, shipIds: [] });
      mockFleetService.delete = jest.fn().mockResolvedValue(undefined);
      mockTeamService.getTeamMembers = jest.fn().mockResolvedValue([]);
      mockTeamService.removeMember = jest.fn().mockResolvedValue(undefined);
      mockInventoryService.getInventory = jest
        .fn()
        .mockResolvedValue({ items: [], pagination: {} });

      const params: DissolveFleetParams = {
        organizationId: 'org-456',
        fleetId: 'fleet-123',
        dissolvedById: 'user-admin',
      };

      // Act
      const result = await service.dissolveFleet(params);

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('completed');
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
