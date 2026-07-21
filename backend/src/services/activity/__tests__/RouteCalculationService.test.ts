import { RouteCalculationService } from '../RouteCalculationService';
import { ShipAssignment, RouteWaypoint } from '../../../models/Activity';

describe('RouteCalculationService', () => {
  let service: RouteCalculationService;

  beforeEach(() => {
    service = new RouteCalculationService();
  });

  describe('calculateRoute', () => {
    it('should calculate total cargo capacity from ship assignments', async () => {
      const ships: ShipAssignment[] = [
        {
          shipType: 'Carrack',
          ownerId: 'user1',
          ownerName: 'Captain',
          crewCapacity: 6,
          crewAssigned: 0,
          crewMembers: [],
          capabilities: [],
          status: 'available',
          role: 'cargo',
          metadata: { cargoCapacity: 456 },
        },
        {
          shipType: 'Caterpillar',
          ownerId: 'user2',
          ownerName: 'Hauler',
          crewCapacity: 4,
          crewAssigned: 0,
          crewMembers: [],
          capabilities: [],
          status: 'available',
          role: 'cargo',
          metadata: { cargoCapacity: 576 },
        },
      ];

      const result = await service.calculateRoute(ships);

      expect(result.totalCargoCapacity).toBe(456 + 576);
    });

    it('should detect refuel ships', async () => {
      const ships: ShipAssignment[] = [
        {
          shipType: 'Starfarer',
          ownerId: 'user1',
          ownerName: 'Fuel Master',
          crewCapacity: 5,
          crewAssigned: 0,
          crewMembers: [],
          capabilities: ['refuel'],
          status: 'available',
          role: 'support',
        },
      ];

      const result = await service.calculateRoute(ships);

      expect(result.hasRefuelShip).toBe(true);
    });

    it('should calculate fuel requirements from route plan', async () => {
      const ships: ShipAssignment[] = [
        {
          shipType: 'Carrack',
          ownerId: 'user1',
          ownerName: 'Explorer',
          crewCapacity: 6,
          crewAssigned: 0,
          crewMembers: [],
          capabilities: [],
          status: 'available',
          role: 'scout',
        },
      ];

      const route: RouteWaypoint[] = [
        {
          order: 0,
          location: 'Port Olisar',
          system: 'Stanton',
          distance: 0,
        },
        {
          order: 1,
          location: 'Crusader',
          system: 'Stanton',
          distance: 50000,
          quantumFuelRequired: 5,
        },
        {
          order: 2,
          location: 'Microtech',
          system: 'Stanton',
          distance: 100000,
          quantumFuelRequired: 10,
          refuelAvailable: true,
        },
      ];

      const result = await service.calculateRoute(ships, route);

      expect(result.totalQuantumFuelRequired).toBe(15);
      expect(result.refuelStopsNeeded).toBe(1);
    });

    it('should handle empty ship assignments', async () => {
      const result = await service.calculateRoute([]);

      expect(result.totalCargoCapacity).toBe(0);
      expect(result.totalQuantumFuel).toBe(0);
      expect(result.hasRefuelShip).toBe(false);
      expect(result.maxJumpRange).toBe(0);
    });

    it('should detect insufficient fuel when no refuel ship', async () => {
      const ships: ShipAssignment[] = [
        {
          shipType: 'Gladius',
          ownerId: 'user1',
          ownerName: 'Fighter',
          crewCapacity: 1,
          crewAssigned: 0,
          crewMembers: [],
          capabilities: [],
          status: 'available',
          role: 'combat',
        },
      ];

      const route: RouteWaypoint[] = [
        {
          order: 0,
          location: 'Start',
          system: 'Stanton',
        },
        {
          order: 1,
          location: 'End',
          system: 'Pyro',
          quantumFuelRequired: 1000, // Excessive fuel requirement
        },
      ];

      const result = await service.calculateRoute(ships, route);

      expect(result.insufficientFuel).toBe(true);
    });

    it('should allow route with refuel ship even if fuel exceeds capacity', async () => {
      const ships: ShipAssignment[] = [
        {
          shipType: 'Starfarer',
          ownerId: 'user1',
          ownerName: 'Fuel Master',
          crewCapacity: 5,
          crewAssigned: 0,
          crewMembers: [],
          capabilities: ['refuel'],
          status: 'available',
          role: 'support',
        },
      ];

      const route: RouteWaypoint[] = [
        {
          order: 0,
          location: 'Start',
          system: 'Stanton',
        },
        {
          order: 1,
          location: 'End',
          system: 'Pyro',
          quantumFuelRequired: 1000,
        },
      ];

      const result = await service.calculateRoute(ships, route);

      expect(result.hasRefuelShip).toBe(true);
      expect(result.insufficientFuel).toBe(false); // Refuel ship can refuel
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

