/**
 * LfgNetworkService Tests
 *
 * Tests for LFG Network Service:
 * - Broadcasting LFG posts
 * - Returns 0 when no client initialized
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => {
  class MockDiscordSettingsService {
    getSettingsByGuildId = jest.fn().mockResolvedValue(null);
    static getInstance() {
      return new MockDiscordSettingsService();
    }
  }
  return { DiscordSettingsService: MockDiscordSettingsService };
});

jest.mock('../../../services/discord/TunnelService', () => ({
  TunnelService: {
    getInstance: () => ({
      getTunnelsForGuild: jest.fn().mockReturnValue([]),
    }),
  },
}));

import { LfgNetworkService } from '../../../services/discord/LfgNetworkService';

function getService(): LfgNetworkService {
  (LfgNetworkService as any).instance = undefined;
  return LfgNetworkService.getInstance();
}

describe('LfgNetworkService', () => {
  let service: LfgNetworkService;

  beforeEach(() => {
    service = getService();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = LfgNetworkService.getInstance();
      const b = LfgNetworkService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('broadcastLfgPost', () => {
    it('should return 0 when client is not initialized', async () => {
      const count = await service.broadcastLfgPost({
        sourceGuildId: 'guild-1',
        sourceGuildName: 'Test Guild',
        activity: 'Mining',
        description: 'Looking for miners',
        hostName: 'TestUser',
        maxPlayers: 4,
        currentPlayers: 1,
        duration: 60,
        createdAt: new Date(),
      });
      expect(count).toBe(0);
    });
  });
});
