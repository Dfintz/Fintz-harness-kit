import { FleetStatus } from '../../../models/Fleet';

import { computeOperationalScore, computeShipMetrics } from '../fleetController.metrics';

describe('fleetController.metrics', () => {
  describe('computeShipMetrics', () => {
    it('counts readiness, capability, and crew totals across ships', () => {
      const metrics = computeShipMetrics([
        { status: 'flight_ready', role: 'combat fighter', maxCrew: 4 } as never,
        { status: 'in_concept', role: 'cargo freighter', maxCrew: 2 } as never,
        { status: 'in_production', role: 'transport', maxCrew: undefined } as never,
      ]);

      expect(metrics).toEqual({
        flightReadyCount: 1,
        combatCapable: 1,
        cargoCapable: 2,
        totalCrew: 6,
      });
    });

    it('treats missing roles and crew as empty values', () => {
      const metrics = computeShipMetrics([{ status: 'flight_ready' } as never]);

      expect(metrics).toEqual({
        flightReadyCount: 1,
        combatCapable: 0,
        cargoCapable: 0,
        totalCrew: 0,
      });
    });
  });

  describe('computeOperationalScore', () => {
    it('prefers average uptime when present', () => {
      expect(
        computeOperationalScore({
          status: FleetStatus.DEPLOYED,
          operationalStats: { averageUptime: 87 },
        })
      ).toBe(87);
    });

    it('caps uptime at 100', () => {
      expect(
        computeOperationalScore({
          status: FleetStatus.DEPLOYED,
          operationalStats: { averageUptime: 140 },
        })
      ).toBe(100);
    });

    it('returns deployed fleet score when no uptime exists', () => {
      expect(
        computeOperationalScore({
          status: FleetStatus.DEPLOYED,
          operationalStats: undefined,
        })
      ).toBe(100);
    });

    it('returns zero for non-deployed fleets without uptime', () => {
      expect(
        computeOperationalScore({
          status: FleetStatus.ACTIVE,
          operationalStats: undefined,
        })
      ).toBe(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
