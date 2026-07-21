import { Ship } from '../../../models/Ship';

import { aggregateShipCapabilities, matchesCapability } from '../fleetController.capabilities';

describe('fleetController.capabilities', () => {
  describe('matchesCapability', () => {
    it('returns true when a capability fragment exists in ship name', () => {
      expect(matchesCapability('starfarer gemini', ['starfarer'])).toBe(true);
    });

    it('returns false when no capability fragment is present', () => {
      expect(matchesCapability('aurora mr', ['polaris', 'hammerhead'])).toBe(false);
    });
  });

  describe('aggregateShipCapabilities', () => {
    it('aggregates cargo, fuel, and role flags from ships', () => {
      const ships = [
        {
          name: 'MISC Starfarer',
          cargo: 291,
          quantumFuelCapacity: 11,
        },
        {
          name: 'Aegis Vulcan',
          cargo: 12,
          quantumFuelCapacity: 2,
        },
        {
          name: 'RSI Apollo Triage',
          cargo: 28,
          quantumFuelCapacity: 3,
        },
      ] as Ship[];

      const result = aggregateShipCapabilities(ships);

      expect(result.totalCargoCapacity).toBe(331);
      expect(result.avgQuantumFuel).toBeCloseTo(16 / 3, 5);
      expect(result.hasRefuelShip).toBe(true);
      expect(result.hasRearmShip).toBe(true);
      expect(result.hasRepairShip).toBe(true);
      expect(result.hasMedicalShip).toBe(true);
      expect(result.refuelShipNames).toContain('MISC Starfarer');
      expect(result.rearmShipNames).toContain('Aegis Vulcan');
      expect(result.repairShipNames).toContain('Aegis Vulcan');
      expect(result.medicalShipNames).toContain('RSI Apollo Triage');
    });

    it('returns zero/default metrics for empty ship arrays', () => {
      const result = aggregateShipCapabilities([]);

      expect(result.totalCargoCapacity).toBe(0);
      expect(result.avgQuantumFuel).toBeNull();
      expect(result.hasRefuelShip).toBe(false);
      expect(result.hasRearmShip).toBe(false);
      expect(result.hasRepairShip).toBe(false);
      expect(result.hasMedicalShip).toBe(false);
      expect(result.refuelShipNames).toEqual([]);
      expect(result.rearmShipNames).toEqual([]);
      expect(result.repairShipNames).toEqual([]);
      expect(result.medicalShipNames).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
