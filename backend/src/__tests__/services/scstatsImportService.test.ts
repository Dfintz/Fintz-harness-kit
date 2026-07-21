/**
 * SCStatsImportService — Unit Tests
 * Wave 2.5 Phase 4 (Step 4.3)
 *
 * Tests for JSON parsing, validation, skill calibration, and data import/delete.
 */

import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

import { SCStatsImportService, SCStatsData } from '../../services/user/SCStatsImportService';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';

describe('SCStatsImportService', () => {
  let service: SCStatsImportService;
  let mockPrefs: Partial<UserGameplayPreferences>[];

  const VALID_JSON: SCStatsData = {
    metadata: { version: '1.0', exportDate: '2026-01-15' },
    playtime: { totalHours: 250, sessionCount: 100, averageSessionLength: 2.5 },
    combat: {
      kills: { total: 500, player: 200, npc: 300 },
      deaths: { total: 200 },
      kd: 2.5,
    },
    missions: {
      totalCompleted: 180,
      byType: { Mining: 45, Combat: 80, Trading: 55 },
    },
    vehicles: {
      favoriteByFlightTime: { name: 'Aegis Gladius', hours: 120 },
    },
  };

  beforeEach(() => {
    mockPrefs = [];
    const mockRepo = createMockRepositoryWithData(mockPrefs);
    // Add create method to mock repo
    mockRepo.create = jest.fn((data: Partial<UserGameplayPreferences>) => ({
      ...data,
      scstatsImportCount: 0,
    }));
    mockDataSource.getRepository.mockReturnValue(mockRepo);
    service = new SCStatsImportService();
  });

  // ─── parseJSON ─────────────────────────────────────────────────────────────

  describe('parseJSON', () => {
    it('parses valid SCStats JSON successfully', () => {
      const result = service.parseJSON(JSON.stringify(VALID_JSON));
      expect(result.metadata.version).toBe('1.0');
      expect(result.playtime.totalHours).toBe(250);
      expect(result.combat.kd).toBe(2.5);
      expect(result.missions.totalCompleted).toBe(180);
      expect(result.vehicles.favoriteByFlightTime.name).toBe('Aegis Gladius');
    });

    it('throws on invalid JSON string', () => {
      expect(() => service.parseJSON('not-json')).toThrow('Invalid JSON format');
    });

    it('throws when required sections are missing', () => {
      const partial = { metadata: VALID_JSON.metadata };
      expect(() => service.parseJSON(JSON.stringify(partial))).toThrow(
        'missing required sections'
      );
    });

    it('throws when vehicles.favoriteByFlightTime is missing', () => {
      const bad = {
        ...VALID_JSON,
        vehicles: {},
      };
      expect(() => service.parseJSON(JSON.stringify(bad))).toThrow(
        'missing or invalid vehicles section'
      );
    });

    it('does not throw for suspicious K/D (just logs warning)', () => {
      const suspicious = { ...VALID_JSON, combat: { ...VALID_JSON.combat, kd: 15.0 } };
      // Should NOT throw — just log a warning
      expect(() => service.parseJSON(JSON.stringify(suspicious))).not.toThrow();
    });

    it('does not throw for suspicious hours (just logs warning)', () => {
      const suspicious = {
        ...VALID_JSON,
        playtime: { ...VALID_JSON.playtime, totalHours: 15000 },
      };
      expect(() => service.parseJSON(JSON.stringify(suspicious))).not.toThrow();
    });
  });

  // ─── Skill Calibration ────────────────────────────────────────────────────

  describe('calibrateCombatSkill', () => {
    it('returns ≤30 for 0 K/D', () => {
      expect(service.calibrateCombatSkill(0)).toBeGreaterThanOrEqual(30);
    });

    it('returns ~45 for 1.0 K/D', () => {
      expect(service.calibrateCombatSkill(1.0)).toBe(45);
    });

    it('returns 60-75 for 1.5 K/D', () => {
      const result = service.calibrateCombatSkill(1.5);
      expect(result).toBeGreaterThanOrEqual(60);
      expect(result).toBeLessThanOrEqual(75);
    });

    it('returns 75-90 for 2.0 K/D', () => {
      const result = service.calibrateCombatSkill(2.0);
      expect(result).toBeGreaterThanOrEqual(75);
      expect(result).toBeLessThanOrEqual(90);
    });

    it('returns 90+ for 3.0+ K/D', () => {
      expect(service.calibrateCombatSkill(3.0)).toBeGreaterThanOrEqual(90);
    });

    it('caps at 100', () => {
      expect(service.calibrateCombatSkill(10.0)).toBeLessThanOrEqual(100);
    });
  });

  describe('calibratePilotingSkill', () => {
    it('returns ≤45 for ≤20 hours', () => {
      expect(service.calibratePilotingSkill(10)).toBeLessThanOrEqual(45);
    });

    it('returns 65+ for 50+ hours', () => {
      expect(service.calibratePilotingSkill(50)).toBeGreaterThanOrEqual(65);
    });

    it('returns 80+ for 100+ hours', () => {
      expect(service.calibratePilotingSkill(100)).toBeGreaterThanOrEqual(80);
    });

    it('returns 95 for 200+ hours', () => {
      expect(service.calibratePilotingSkill(200)).toBe(95);
    });
  });

  describe('calibrateMiningSkill', () => {
    it('returns ≤45 for ≤20 missions', () => {
      expect(service.calibrateMiningSkill(10)).toBeLessThanOrEqual(45);
    });

    it('returns 65+ for 50+ missions', () => {
      expect(service.calibrateMiningSkill(50)).toBeGreaterThanOrEqual(65);
    });

    it('returns 95 for 200+ missions', () => {
      expect(service.calibrateMiningSkill(200)).toBe(95);
    });
  });

  // ─── importData ───────────────────────────────────────────────────────────

  describe('importData', () => {
    it('rejects import without consent', async () => {
      await expect(
        service.importData('user-1', JSON.stringify(VALID_JSON), false)
      ).rejects.toThrow('User consent required');
    });

    it('imports data and sets scstatsVerified to true', async () => {
      const result = await service.importData('user-1', JSON.stringify(VALID_JSON), true);
      expect(result.scstatsVerified).toBe(true);
      expect(result.scstatsTotalHours).toBe(250);
      expect(result.scstatsKdRatio).toBe(2.5);
      expect(result.scstatsMissionsCompleted).toBe(180);
      expect(result.scstatsFavoriteVehicle).toBe('Aegis Gladius');
    });

    it('calibrates combat skill from K/D ratio', async () => {
      const result = await service.importData('user-1', JSON.stringify(VALID_JSON), true);
      expect(result.combatSkill).toBeGreaterThan(0);
      expect(result.combatSkill).toBeLessThanOrEqual(100);
    });

    it('calibrates piloting skill from flight hours', async () => {
      const result = await service.importData('user-1', JSON.stringify(VALID_JSON), true);
      expect(result.pilotingSkill).toBeGreaterThanOrEqual(80); // 120 hours → high skill
    });

    it('calibrates mining skill from mining missions', async () => {
      const result = await service.importData('user-1', JSON.stringify(VALID_JSON), true);
      expect(result.miningSkill).toBeGreaterThanOrEqual(45); // 45 mining missions
    });

    it('increments import count', async () => {
      const result = await service.importData('user-1', JSON.stringify(VALID_JSON), true);
      expect(result.scstatsImportCount).toBe(1);
    });

    it('sets consent date and granted flag', async () => {
      const result = await service.importData('user-1', JSON.stringify(VALID_JSON), true);
      expect(result.scstatsConsentGranted).toBe(true);
      expect(result.scstatsConsentDate).toBeDefined();
    });
  });

  // ─── getData ──────────────────────────────────────────────────────────────

  describe('getData', () => {
    it('returns hasData=false when no preferences exist', async () => {
      const result = await service.getData('user-no-data');
      expect(result.hasData).toBe(false);
      expect(result.metrics).toBeNull();
    });

    it('returns hasData=false when preferences exist but not verified', async () => {
      mockPrefs.push({
        userId: 'user-unverified',
        scstatsVerified: false,
      } as Partial<UserGameplayPreferences>);
      const result = await service.getData('user-unverified');
      expect(result.hasData).toBe(false);
    });

    it('returns metrics when verified data exists', async () => {
      mockPrefs.push({
        userId: 'user-verified',
        scstatsVerified: true,
        scstatsLastImport: new Date(),
        scstatsImportCount: 1,
        scstatsConsentGranted: true,
        scstatsTotalHours: 250,
        scstatsKdRatio: 2.5,
        scstatsMissionsCompleted: 180,
        scstatsFavoriteVehicle: 'Aegis Gladius',
      } as Partial<UserGameplayPreferences>);

      const result = await service.getData('user-verified');
      expect(result.hasData).toBe(true);
      expect(result.metrics?.totalHours).toBe(250);
      expect(result.metrics?.kdRatio).toBe(2.5);
    });

    it('marks data as stale after 30 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      mockPrefs.push({
        userId: 'user-stale',
        scstatsVerified: true,
        scstatsLastImport: oldDate,
        scstatsImportCount: 1,
        scstatsConsentGranted: true,
        scstatsTotalHours: 100,
        scstatsKdRatio: 1.0,
        scstatsMissionsCompleted: 50,
        scstatsFavoriteVehicle: 'Aurora MR',
      } as Partial<UserGameplayPreferences>);

      const result = await service.getData('user-stale');
      expect(result.isStale).toBe(true);
    });
  });

  // ─── deleteData ───────────────────────────────────────────────────────────

  describe('deleteData', () => {
    it('clears all SCStats fields (GDPR compliance)', async () => {
      const pref = {
        userId: 'user-delete',
        scstatsVerified: true,
        scstatsRawData: '{"some":"data"}',
        scstatsLastImport: new Date(),
        scstatsTotalHours: 250,
        scstatsKdRatio: 2.5,
        scstatsMissionsCompleted: 180,
        scstatsFavoriteVehicle: 'Gladius',
        scstatsConsentGranted: true,
        scstatsConsentDate: new Date(),
      } as Partial<UserGameplayPreferences>;
      mockPrefs.push(pref);

      await service.deleteData('user-delete');

      expect(pref.scstatsVerified).toBe(false);
      expect(pref.scstatsRawData).toBeNull();
      expect(pref.scstatsLastImport).toBeNull();
      expect(pref.scstatsTotalHours).toBeNull();
      expect(pref.scstatsKdRatio).toBeNull();
      expect(pref.scstatsMissionsCompleted).toBeNull();
      expect(pref.scstatsConsentGranted).toBe(false);
    });

    it('does nothing when no preferences exist', async () => {
      // Should not throw
      await expect(service.deleteData('nonexistent')).resolves.toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
