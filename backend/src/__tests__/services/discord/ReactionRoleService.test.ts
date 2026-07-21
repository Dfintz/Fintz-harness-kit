/**
 * ReactionRoleService Tests
 *
 * Tests for Reaction Role Service:
 * - Creating panels
 * - Listing panels
 * - Deleting panels
 * - Getting panels by ID
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

import { ReactionRoleService } from '../../../services/discord/ReactionRoleService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getService(): ReactionRoleService {
  (ReactionRoleService as any).instance = undefined;
  return ReactionRoleService.getInstance();
}

describe('ReactionRoleService', () => {
  let service: ReactionRoleService;

  beforeEach(() => {
    service = getService();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = ReactionRoleService.getInstance();
      const b = ReactionRoleService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('createPanel', () => {
    it('should create a panel with roles', () => {
      const roles = [
        { roleId: 'role-1', emoji: '🎮', label: 'Gamer' },
        { roleId: 'role-2', emoji: '🎨', label: 'Artist' },
      ];
      const panel = service.createPanel(
        'guild-1',
        'ch-1',
        'Role Menu',
        'Pick your roles',
        roles,
        false,
        'user-1'
      );
      expect(panel).toBeDefined();
      expect(panel.guildId).toBe('guild-1');
      expect(panel.title).toBe('Role Menu');
      expect(panel.roles).toHaveLength(2);
      expect(panel.exclusive).toBe(false);
    });

    it('should create an exclusive panel', () => {
      const roles = [{ roleId: 'role-1', emoji: '🔴', label: 'Red' }];
      const panel = service.createPanel(
        'guild-1',
        'ch-1',
        'Colors',
        'Pick one',
        roles,
        true,
        'user-1'
      );
      expect(panel.exclusive).toBe(true);
    });
  });

  describe('getPanel', () => {
    it('should retrieve a panel by id', () => {
      const panel = service.createPanel('guild-1', 'ch-1', 'Roles', 'Pick', [], false, 'user-1');
      const found = service.getPanel(panel.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Roles');
    });

    it('should return undefined for non-existent panel', () => {
      expect(service.getPanel('non-existent')).toBeUndefined();
    });
  });

  describe('listPanels', () => {
    it('should list panels for a guild', () => {
      service.createPanel('guild-1', 'ch-1', 'Panel A', 'Desc A', [], false, 'user-1');
      service.createPanel('guild-1', 'ch-1', 'Panel B', 'Desc B', [], false, 'user-1');
      service.createPanel('guild-2', 'ch-2', 'Panel C', 'Desc C', [], false, 'user-2');

      const guild1 = service.listPanels('guild-1');
      expect(guild1).toHaveLength(2);

      const guild2 = service.listPanels('guild-2');
      expect(guild2).toHaveLength(1);
    });
  });

  describe('deletePanel', () => {
    it('should delete a panel', async () => {
      const panel = service.createPanel('guild-1', 'ch-1', 'To Delete', 'Bye', [], false, 'user-1');
      const result = await service.deletePanel(panel.id);
      expect(result).toBe(true);

      const found = service.getPanel(panel.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent panel', async () => {
      const result = await service.deletePanel('non-existent');
      expect(result).toBe(false);
    });
  });
});
