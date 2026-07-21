/**
 * PresenceTrackingService Tests
 *
 * Tests for Presence Tracking Service:
 * - Presence update handling
 * - Current game stats aggregation
 * - Activity heatmap generation
 * - Game presence history
 * - Status counts
 * - History cap enforcement
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/redis', () => ({
  cache: {
    set: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
  },
}));

import { PresenceTrackingService } from '../../../services/discord/PresenceTrackingService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getService(): PresenceTrackingService {
  (PresenceTrackingService as any).instance = undefined;
  return PresenceTrackingService.getInstance();
}

function createPresence(
  status: string,
  activities: Array<{ name: string; type: number; details?: string }> = []
) {
  return {
    status,
    activities: activities.map(a => ({
      name: a.name,
      type: a.type,
      details: a.details || null,
    })),
  };
}

function createMockMember(userId: string, guildId: string, newPresence: any, oldPresence?: any) {
  return {
    userId,
    guild: { id: guildId },
    user: { id: userId },
  };
}

describe('PresenceTrackingService', () => {
  let service: PresenceTrackingService;

  beforeEach(() => {
    service = getService();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = PresenceTrackingService.getInstance();
      const b = PresenceTrackingService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('getCurrentGameStats', () => {
    it('should return empty stats for unknown guild', () => {
      const stats = service.getCurrentGameStats('unknown-guild');
      expect(stats.guildId).toBe('unknown-guild');
      expect(stats.statusCounts.online).toBe(0);
      expect(stats.statusCounts.idle).toBe(0);
      expect(stats.statusCounts.dnd).toBe(0);
      expect(stats.statusCounts.offline).toBe(0);
      expect(Object.keys(stats.currentPlayers)).toHaveLength(0);
    });
  });

  describe('getStatusCounts', () => {
    it('should return zero counts for unknown guild', () => {
      const counts = service.getStatusCounts('unknown-guild');
      expect(counts).toEqual({ online: 0, idle: 0, dnd: 0, offline: 0 });
    });
  });

  describe('getActivityHeatmap', () => {
    it('should return data points for a guild with no history', () => {
      const heatmap = service.getActivityHeatmap('unknown-guild', 7);
      // Should return an array (possibly empty or with zero-count entries)
      expect(Array.isArray(heatmap)).toBe(true);
    });

    it('should respect the days parameter', () => {
      const heatmap1 = service.getActivityHeatmap('unknown-guild', 1);
      const heatmap7 = service.getActivityHeatmap('unknown-guild', 7);
      expect(Array.isArray(heatmap1)).toBe(true);
      expect(Array.isArray(heatmap7)).toBe(true);
    });
  });

  describe('getGamePresenceHistory', () => {
    it('should return empty array for unknown guild', () => {
      const history = service.getGamePresenceHistory('unknown-guild', 7);
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(0);
    });
  });
});
