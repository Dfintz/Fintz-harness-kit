/**
 * DiscordSettingsService — per-guild feature-flag override accessors (ARCH-11).
 *
 * Covers the storage layer added for ARCH-11:
 * - getGuildFeatureFlagOverrides: sanitized read (empty when no row / no flags).
 * - setGuildFeatureFlagOverride: merge + stamp + persist (existing + create paths).
 */

jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { BotFeatureFlag } from '../../../bot/utils/guildFeatureFlags';
import { DiscordSettingsService } from '../../../services/discord/DiscordSettingsService';

function createMockSettingsRepo() {
  return {
    create: jest.fn().mockImplementation((d: Record<string, unknown>) => ({ ...d })),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    findOne: jest.fn().mockResolvedValue(null),
    metadata: { name: 'DiscordGuildSettings' },
  };
}

const FLAG = BotFeatureFlag.AI_BRIEFINGS;

describe('DiscordSettingsService — feature-flag overrides (ARCH-11)', () => {
  let service: DiscordSettingsService;
  let mockRepo: ReturnType<typeof createMockSettingsRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockSettingsRepo();
    const { AppDataSource } = require('../../../config/database');
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    service = new DiscordSettingsService();
  });

  describe('getGuildFeatureFlagOverrides', () => {
    it('returns {} when the guild has no settings row (never creates one)', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.getGuildFeatureFlagOverrides('org-1', 'guild-1');

      expect(result).toEqual({});
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', guildId: 'guild-1' },
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('returns the stored override for a known flag', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ featureFlags: { [FLAG]: false } });

      const result = await service.getGuildFeatureFlagOverrides('org-1', 'guild-1');

      expect(result).toEqual({ [FLAG]: false });
    });

    it('sanitizes on read — drops unknown flags and non-boolean values', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        featureFlags: { [FLAG]: true, unknownFlag: true, badValue: 'nope' },
      });

      const result = await service.getGuildFeatureFlagOverrides('org-1', 'guild-1');

      expect(result).toEqual({ [FLAG]: true });
    });

    it('returns {} when the row exists but has no featureFlags column value', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ featureFlags: null });

      const result = await service.getGuildFeatureFlagOverrides('org-1', 'guild-1');

      expect(result).toEqual({});
    });
  });

  describe('setGuildFeatureFlagOverride', () => {
    it('merges into existing overrides and stamps lastModifiedBy', async () => {
      // getOrCreateSettings → findOne by id returns the existing row.
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'org-1:guild-1',
        organizationId: 'org-1',
        guildId: 'guild-1',
        featureFlags: { [FLAG]: true },
      });

      await service.setGuildFeatureFlagOverride('org-1', 'guild-1', FLAG, false, 'admin-1');

      expect(mockRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          featureFlags: { [FLAG]: false }, // existing true overwritten by the new false
          lastModifiedBy: 'admin-1',
        })
      );
    });

    it('creates the settings row when none exists, then persists the override', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null); // getOrCreateSettings creates

      await service.setGuildFeatureFlagOverride('org-1', 'guild-1', FLAG, false, 'admin-1');

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          featureFlags: { [FLAG]: false },
          lastModifiedBy: 'admin-1',
        })
      );
    });
  });
});
