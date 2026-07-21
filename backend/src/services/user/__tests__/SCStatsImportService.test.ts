import { AppDataSource } from '../../../data-source';
import { UserGameplayPreferences } from '../../../models/UserGameplayPreferences';
import { SCStatsImportService } from '../SCStatsImportService';

import type { SCStatsData } from '../SCStatsImportService';

// Mock dependencies
jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/encryptionTransformer', () => ({
  encryptionTransformer: {
    to: jest.fn((v: string) => v),
    from: jest.fn((v: string) => v),
  },
}));

describe('SCStatsImportService', () => {
  let service: SCStatsImportService;
  let mockPreferencesRepo: Record<string, jest.Mock>;

  const validSCStatsJSON: SCStatsData = {
    metadata: { version: '0.3', exportDate: '2026-02-12' },
    playtime: { totalHours: 100, sessionCount: 50, averageSessionLength: 120 },
    combat: {
      kills: { total: 200, player: 20, npc: 180 },
      deaths: { total: 100 },
      kd: 2.0,
      killsPerHour: 2.0,
    },
    missions: { totalCompleted: 75, byType: { Bounty: 30, Mining: 20, Cargo: 25 } },
    vehicles: { favoriteByFlightTime: { name: 'Gladius', hours: 50 } },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPreferencesRepo = {
      findOne: jest.fn(),
      create: jest.fn((data: Partial<UserGameplayPreferences>) => ({
        ...data,
        scstatsImportCount: 0,
        combatSkill: 50,
        pilotingSkill: 50,
        tradingSkill: 50,
        miningSkill: 50,
      })),
      save: jest.fn((entity: UserGameplayPreferences) => Promise.resolve(entity)),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockPreferencesRepo);

    service = new SCStatsImportService();
  });

  describe('parseJSON', () => {
    it('should parse valid SCStats JSON', () => {
      const json = JSON.stringify(validSCStatsJSON);
      const result = service.parseJSON(json);

      expect(result.playtime.totalHours).toBe(100);
      expect(result.combat.kd).toBe(2.0);
      expect(result.missions.totalCompleted).toBe(75);
      expect(result.vehicles.favoriteByFlightTime.name).toBe('Gladius');
    });

    it('should reject invalid JSON syntax', () => {
      expect(() => service.parseJSON('not valid json')).toThrow('Invalid JSON format');
    });

    it('should reject JSON missing required sections', () => {
      const json = JSON.stringify({ metadata: { version: '0.3' } });
      expect(() => service.parseJSON(json)).toThrow(
        'Invalid SCStats JSON format: missing required sections'
      );
    });

    it('should warn on suspicious K/D ratio but still parse', () => {
      const { logger } = jest.requireMock('../../../utils/logger');
      const data = {
        ...validSCStatsJSON,
        combat: { ...validSCStatsJSON.combat, kd: 15.0 },
      };
      const result = service.parseJSON(JSON.stringify(data));

      expect(result.combat.kd).toBe(15.0);
      expect(logger.warn).toHaveBeenCalledWith('Suspicious K/D ratio detected', { kd: 15.0 });
    });

    it('should warn on suspicious total hours but still parse', () => {
      const { logger } = jest.requireMock('../../../utils/logger');
      const data = {
        ...validSCStatsJSON,
        playtime: { ...validSCStatsJSON.playtime, totalHours: 15000 },
      };
      const result = service.parseJSON(JSON.stringify(data));

      expect(result.playtime.totalHours).toBe(15000);
      expect(logger.warn).toHaveBeenCalledWith('Suspicious total hours detected', {
        hours: 15000,
      });
    });
  });

  describe('importData', () => {
    it('should import data for user with consent', async () => {
      mockPreferencesRepo.findOne.mockResolvedValue(null);

      const result = await service.importData('user-123', JSON.stringify(validSCStatsJSON), true);

      expect(mockPreferencesRepo.create).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(mockPreferencesRepo.save).toHaveBeenCalled();
      expect(result.scstatsVerified).toBe(true);
      expect(result.scstatsTotalHours).toBe(100);
      expect(result.scstatsKdRatio).toBe(2.0);
      expect(result.scstatsMissionsCompleted).toBe(75);
      expect(result.scstatsFavoriteVehicle).toBe('Gladius');
      expect(result.scstatsConsentGranted).toBe(true);
    });

    it('should reject import without consent', async () => {
      await expect(
        service.importData('user-123', JSON.stringify(validSCStatsJSON), false)
      ).rejects.toThrow('User consent required to import SCStats data');
    });

    it('should update existing preferences', async () => {
      const existing = {
        userId: 'user-123',
        scstatsImportCount: 1,
        combatSkill: 50,
        pilotingSkill: 50,
        tradingSkill: 60,
        miningSkill: 50,
      } as UserGameplayPreferences;

      mockPreferencesRepo.findOne.mockResolvedValue(existing);

      const result = await service.importData('user-123', JSON.stringify(validSCStatsJSON), true);

      expect(mockPreferencesRepo.create).not.toHaveBeenCalled();
      expect(result.scstatsImportCount).toBe(2);
      expect(result.tradingSkill).toBe(60); // Preserved existing
    });

    it('should auto-calibrate skills from SCStats data', async () => {
      mockPreferencesRepo.findOne.mockResolvedValue(null);

      const result = await service.importData('user-123', JSON.stringify(validSCStatsJSON), true);

      // K/D 2.0 → combat skill 75-90 range
      expect(result.combatSkill).toBeGreaterThanOrEqual(75);
      expect(result.combatSkill).toBeLessThan(90);

      // 50 flight hours → piloting skill 65-80 range
      expect(result.pilotingSkill).toBeGreaterThanOrEqual(65);
      expect(result.pilotingSkill).toBeLessThanOrEqual(80);

      // 20 mining missions → mining skill 45-65 range
      expect(result.miningSkill).toBeGreaterThanOrEqual(45);
      expect(result.miningSkill).toBeLessThanOrEqual(65);
    });
  });

  describe('getData', () => {
    it('should return no data when user has no preferences', async () => {
      mockPreferencesRepo.findOne.mockResolvedValue(null);

      const result = await service.getData('user-123');

      expect(result.hasData).toBe(false);
      expect(result.metrics).toBeNull();
    });

    it('should return no data when user is not verified', async () => {
      mockPreferencesRepo.findOne.mockResolvedValue({
        userId: 'user-123',
        scstatsVerified: false,
      });

      const result = await service.getData('user-123');

      expect(result.hasData).toBe(false);
    });

    it('should return data for verified user', async () => {
      mockPreferencesRepo.findOne.mockResolvedValue({
        userId: 'user-123',
        scstatsVerified: true,
        scstatsLastImport: new Date(),
        scstatsImportCount: 1,
        scstatsConsentGranted: true,
        scstatsTotalHours: 100,
        scstatsKdRatio: 2.0,
        scstatsMissionsCompleted: 75,
        scstatsFavoriteVehicle: 'Gladius',
      });

      const result = await service.getData('user-123');

      expect(result.hasData).toBe(true);
      expect(result.metrics?.totalHours).toBe(100);
      expect(result.metrics?.kdRatio).toBe(2.0);
      expect(result.isStale).toBe(false);
    });

    it('should flag stale data (>30 days old)', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 31);

      mockPreferencesRepo.findOne.mockResolvedValue({
        userId: 'user-123',
        scstatsVerified: true,
        scstatsLastImport: staleDate,
        scstatsImportCount: 1,
        scstatsConsentGranted: true,
        scstatsTotalHours: 100,
        scstatsKdRatio: 2.0,
        scstatsMissionsCompleted: 75,
        scstatsFavoriteVehicle: 'Gladius',
      });

      const result = await service.getData('user-123');

      expect(result.isStale).toBe(true);
    });
  });

  describe('deleteData', () => {
    it('should clear SCStats data for user', async () => {
      const existing = {
        userId: 'user-123',
        scstatsVerified: true,
        scstatsRawData: '{}',
        scstatsTotalHours: 100,
      } as UserGameplayPreferences;

      mockPreferencesRepo.findOne.mockResolvedValue(existing);

      await service.deleteData('user-123');

      expect(mockPreferencesRepo.save).toHaveBeenCalled();
      const saved = mockPreferencesRepo.save.mock.calls[0][0];
      expect(saved.scstatsRawData).toBeNull();
      expect(saved.scstatsVerified).toBe(false);
      expect(saved.scstatsTotalHours).toBeNull();
      expect(saved.scstatsKdRatio).toBeNull();
      expect(saved.scstatsConsentGranted).toBe(false);
    });

    it('should handle user with no preferences gracefully', async () => {
      mockPreferencesRepo.findOne.mockResolvedValue(null);

      await service.deleteData('user-123');

      expect(mockPreferencesRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('calibrateCombatSkill', () => {
    it('should calibrate K/D 3.0+ to 90-100', () => {
      expect(service.calibrateCombatSkill(3.0)).toBeGreaterThanOrEqual(90);
      expect(service.calibrateCombatSkill(5.0)).toBeLessThanOrEqual(100);
    });

    it('should calibrate K/D 2.0-3.0 to 75-90', () => {
      const skill = service.calibrateCombatSkill(2.5);
      expect(skill).toBeGreaterThanOrEqual(75);
      expect(skill).toBeLessThan(90);
    });

    it('should calibrate K/D 1.5-2.0 to 60-75', () => {
      const skill = service.calibrateCombatSkill(1.75);
      expect(skill).toBeGreaterThanOrEqual(60);
      expect(skill).toBeLessThanOrEqual(75);
    });

    it('should calibrate K/D 1.0-1.5 to 45-60', () => {
      const skill = service.calibrateCombatSkill(1.25);
      expect(skill).toBeGreaterThanOrEqual(45);
      expect(skill).toBeLessThanOrEqual(60);
    });

    it('should calibrate K/D <1.0 to 30-45', () => {
      const skill = service.calibrateCombatSkill(0.8);
      expect(skill).toBeGreaterThanOrEqual(30);
      expect(skill).toBeLessThan(45);
    });

    it('should cap at 100 for very high K/D', () => {
      expect(service.calibrateCombatSkill(10.0)).toBe(100);
    });
  });

  describe('calibratePilotingSkill', () => {
    it('should return 95 for 200+ hours', () => {
      expect(service.calibratePilotingSkill(200)).toBe(95);
      expect(service.calibratePilotingSkill(500)).toBe(95);
    });

    it('should calibrate 100-200 hours to 80-95', () => {
      const skill = service.calibratePilotingSkill(150);
      expect(skill).toBeGreaterThanOrEqual(80);
      expect(skill).toBeLessThanOrEqual(95);
    });

    it('should calibrate <20 hours to 30-45 range', () => {
      const skill = service.calibratePilotingSkill(10);
      expect(skill).toBeGreaterThanOrEqual(30);
      expect(skill).toBeLessThanOrEqual(45);
    });
  });

  describe('calibrateMiningSkill', () => {
    it('should return 95 for 200+ missions', () => {
      expect(service.calibrateMiningSkill(200)).toBe(95);
    });

    it('should calibrate 100-200 missions to 80-95', () => {
      const skill = service.calibrateMiningSkill(150);
      expect(skill).toBeGreaterThanOrEqual(80);
      expect(skill).toBeLessThanOrEqual(95);
    });

    it('should calibrate 0 missions to 30', () => {
      expect(service.calibrateMiningSkill(0)).toBe(30);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

