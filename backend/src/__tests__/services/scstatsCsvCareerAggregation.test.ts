/**
 * SCStatsCsvImportService — Career Aggregation Tests
 *
 * Tests for matching SCStats ship names to the ship catalog
 * and aggregating flight hours by career classification.
 */

import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

import type { SCStatsCsvData, SCStatsShipRow } from '@sc-fleet-manager/shared-types';
import { SCStatsCsvImportService } from '../../services/user/SCStatsCsvImportService';

describe('SCStatsCsvImportService — Career Aggregation', () => {
  let service: SCStatsCsvImportService;

  beforeEach(() => {
    const mockRepo = createMockRepositoryWithData([]);
    mockRepo.create = jest.fn((data: Record<string, unknown>) => ({ ...data }));
    mockDataSource.getRepository.mockReturnValue(mockRepo);
    service = new SCStatsCsvImportService();
  });

  // ─── normalizeSCStatsShipName ────────────────────────────────────────────

  describe('normalizeSCStatsShipName', () => {
    it('strips manufacturer prefix and replaces underscores with spaces', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('MISC_Prospector')).toBe(
        'Prospector'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('RSI_Perseus')).toBe('Perseus');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ANVL_Paladin')).toBe('Paladin');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('DRAK_Corsair')).toBe('Corsair');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ORIG_400i')).toBe('400i');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('GRIN_ROC')).toBe('ROC');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('GRIN_PTV')).toBe('PTV');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ARGO_MOLE')).toBe('MOLE');
    });

    it('handles multi-word ship names after prefix', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('AEGS_Avenger_Stalker')).toBe(
        'Avenger Stalker'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('AEGS_Avenger_Titan')).toBe(
        'Avenger Titan'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('RSI_Constellation_Andromeda')).toBe(
        'Constellation Andromeda'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('RSI_Constellation_Taurus')).toBe(
        'Constellation Taurus'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ANVL_Carrack_Expedition')).toBe(
        'Carrack Expedition'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('RSI_Apollo_Medivac')).toBe(
        'Apollo Medivac'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ANVL_C8X_Pisces_Expedition')).toBe(
        'C8X Pisces Expedition'
      );
    });

    it('resolves Hercules variants via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Starlifter_C2')).toBe(
        'C2 Hercules'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Starlifter_M2')).toBe(
        'M2 Hercules'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Starlifter_A2')).toBe(
        'A2 Hercules'
      );
    });

    it('resolves Ares variants via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Starfighter_Inferno')).toBe(
        'Ares Inferno'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Starfighter_Ion')).toBe(
        'Ares Ion'
      );
    });

    it('resolves Mercury Star Runner via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Star_Runner')).toBe(
        'Mercury Star Runner'
      );
    });

    it('resolves Lightning/Hornet designation reordering via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ANVL_Lightning_F8C')).toBe(
        'F8C Lightning'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ANVL_Hornet_F7A_Mk2')).toBe(
        'F7A Hornet Mk II'
      );
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ANVL_Hornet_F7C_Mk2')).toBe(
        'F7C Hornet Mk II'
      );
    });

    it('resolves Zeus Mk II variants via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('RSI_Zeus_CL')).toBe('Zeus Mk II CL');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('RSI_Zeus_ES')).toBe('Zeus Mk II ES');
    });

    it('resolves Kruger variants via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('KRIG_L22_AlphaWolf')).toBe(
        'L-22 Alpha Wolf'
      );
    });

    it('resolves Idris hyphenated variants via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('AEGS_Idris_P')).toBe('Idris-P');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('AEGS_Idris_M')).toBe('Idris-M');
    });

    it('resolves Spirit reordering via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Spirit_A1')).toBe('A1 Spirit');
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('CRUS_Spirit_C1')).toBe('C1 Spirit');
    });

    it('resolves Pisces Rescue abbreviation via alias table', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('ANVL_C8R_Pisces')).toBe(
        'C8R Pisces Rescue'
      );
    });

    it('returns raw name when no prefix is present', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('Gladius')).toBe('Gladius');
    });

    it('returns empty string for empty input', () => {
      expect(SCStatsCsvImportService.normalizeSCStatsShipName('')).toBe('');
    });
  });

  // ─── aggregateHoursByCareer (via computeSummary) ─────────────────────────

  describe('computeSummary with career map', () => {
    const baseData: SCStatsCsvData = {
      playtime: [{ version: '4.0', hours: 100, builds: '1' }],
      loadoutTop: [],
      loadoutDetail: [],
      purchases: [],
      ships: [],
    };

    it('groups hours by career when career map is provided', () => {
      const ships: SCStatsShipRow[] = [
        {
          ship: 'Gladius',
          totalTime: '10.5h',
          sessions: 5,
          longestFlight: '3h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-03-01',
        },
        {
          ship: 'Arrow',
          totalTime: '5h',
          sessions: 3,
          longestFlight: '2h',
          firstFlown: '2026-01-10',
          lastFlown: '2026-03-10',
        },
        {
          ship: 'Prospector',
          totalTime: '8h',
          sessions: 4,
          longestFlight: '4h',
          firstFlown: '2026-02-01',
          lastFlown: '2026-03-15',
        },
        {
          ship: 'Caterpillar',
          totalTime: '3h',
          sessions: 2,
          longestFlight: '2h',
          firstFlown: '2026-02-15',
          lastFlown: '2026-03-20',
        },
      ];

      const careerMap = new Map<string, string>([
        ['gladius', 'Combat'],
        ['arrow', 'Combat'],
        ['prospector', 'Industrial'],
        ['caterpillar', 'Transporter'],
      ]);

      const summary = service.computeSummary({ ...baseData, ships }, careerMap);

      expect(summary.hoursByCareer).toHaveLength(3);
      // Sorted descending by hours: Combat (15.5), Industrial (8), Transporter (3)
      expect(summary.hoursByCareer[0]).toEqual({ career: 'Combat', hours: 15.5, shipCount: 2 });
      expect(summary.hoursByCareer[1]).toEqual({ career: 'Industrial', hours: 8, shipCount: 1 });
      expect(summary.hoursByCareer[2]).toEqual({ career: 'Transporter', hours: 3, shipCount: 1 });
    });

    it('assigns "Unknown" career for ships not in career map', () => {
      const ships: SCStatsShipRow[] = [
        {
          ship: 'Gladius',
          totalTime: '10h',
          sessions: 5,
          longestFlight: '3h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-03-01',
        },
        {
          ship: 'CustomShip',
          totalTime: '2h',
          sessions: 1,
          longestFlight: '2h',
          firstFlown: '2026-02-01',
          lastFlown: '2026-02-01',
        },
      ];

      const careerMap = new Map<string, string>([['gladius', 'Combat']]);

      const summary = service.computeSummary({ ...baseData, ships }, careerMap);

      expect(summary.hoursByCareer).toHaveLength(2);
      const unknownEntry = summary.hoursByCareer.find(e => e.career === 'Unknown');
      expect(unknownEntry).toEqual({ career: 'Unknown', hours: 2, shipCount: 1 });
    });

    it('returns empty hoursByCareer when no ships exist', () => {
      const summary = service.computeSummary(baseData);
      expect(summary.hoursByCareer).toEqual([]);
    });

    it('returns all ships as Unknown when no career map is provided', () => {
      const ships: SCStatsShipRow[] = [
        {
          ship: 'Gladius',
          totalTime: '10h',
          sessions: 5,
          longestFlight: '3h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-03-01',
        },
        {
          ship: 'Arrow',
          totalTime: '5h',
          sessions: 3,
          longestFlight: '2h',
          firstFlown: '2026-01-10',
          lastFlown: '2026-03-10',
        },
      ];

      const summary = service.computeSummary({ ...baseData, ships });
      expect(summary.hoursByCareer).toHaveLength(1);
      expect(summary.hoursByCareer[0]).toEqual({ career: 'Unknown', hours: 15, shipCount: 2 });
    });

    it('handles case-insensitive ship name matching', () => {
      const ships: SCStatsShipRow[] = [
        {
          ship: 'GLADIUS',
          totalTime: '10h',
          sessions: 5,
          longestFlight: '3h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-03-01',
        },
        {
          ship: 'Cutlass Black',
          totalTime: '6h',
          sessions: 3,
          longestFlight: '3h',
          firstFlown: '2026-01-10',
          lastFlown: '2026-03-10',
        },
      ];

      const careerMap = new Map<string, string>([
        ['gladius', 'Combat'],
        ['cutlass black', 'Combat'],
      ]);

      const summary = service.computeSummary({ ...baseData, ships }, careerMap);
      expect(summary.hoursByCareer).toHaveLength(1);
      expect(summary.hoursByCareer[0]).toEqual({ career: 'Combat', hours: 16, shipCount: 2 });
    });

    it('handles mixed time formats (hours, minutes, seconds)', () => {
      const ships: SCStatsShipRow[] = [
        {
          ship: 'Gladius',
          totalTime: '2h',
          sessions: 2,
          longestFlight: '1h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-03-01',
        },
        {
          ship: 'Arrow',
          totalTime: '30m',
          sessions: 1,
          longestFlight: '30m',
          firstFlown: '2026-01-10',
          lastFlown: '2026-03-10',
        },
        {
          ship: 'Prospector',
          totalTime: '3600s',
          sessions: 1,
          longestFlight: '3600s',
          firstFlown: '2026-02-01',
          lastFlown: '2026-02-01',
        },
      ];

      const careerMap = new Map<string, string>([
        ['gladius', 'Combat'],
        ['arrow', 'Combat'],
        ['prospector', 'Industrial'],
      ]);

      const summary = service.computeSummary({ ...baseData, ships }, careerMap);
      // Combat: 2h + 0.5h = 2.5h, Industrial: 1h
      expect(summary.hoursByCareer).toHaveLength(2);
      expect(summary.hoursByCareer[0]).toEqual({ career: 'Combat', hours: 2.5, shipCount: 2 });
      expect(summary.hoursByCareer[1]).toEqual({ career: 'Industrial', hours: 1, shipCount: 1 });
    });

    it('rounds hours to 2 decimal places', () => {
      const ships: SCStatsShipRow[] = [
        {
          ship: 'Gladius',
          totalTime: '1.333h',
          sessions: 1,
          longestFlight: '1.333h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-01-01',
        },
        {
          ship: 'Arrow',
          totalTime: '2.666h',
          sessions: 1,
          longestFlight: '2.666h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-01-01',
        },
      ];

      const careerMap = new Map<string, string>([
        ['gladius', 'Combat'],
        ['arrow', 'Combat'],
      ]);

      const summary = service.computeSummary({ ...baseData, ships }, careerMap);
      // 1.333 + 2.666 = 3.999 → rounded to 4.0
      expect(summary.hoursByCareer[0].hours).toBe(4);
    });

    it('still computes other summary fields correctly with career map', () => {
      const ships: SCStatsShipRow[] = [
        {
          ship: 'Gladius',
          totalTime: '10h',
          sessions: 5,
          longestFlight: '3h',
          firstFlown: '2026-01-01',
          lastFlown: '2026-03-01',
        },
      ];

      const careerMap = new Map<string, string>([['gladius', 'Combat']]);
      const summary = service.computeSummary({ ...baseData, ships }, careerMap);

      expect(summary.totalShipsFlown).toBe(1);
      expect(summary.totalFlightTimeHours).toBe(10);
      expect(summary.mostFlownShip).toBe('Gladius');
      expect(summary.totalPlaytimeHours).toBe(100);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
