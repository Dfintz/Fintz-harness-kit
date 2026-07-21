/**
 * EmbedBuilderService Tests
 *
 * Tests for Embed Builder Service:
 * - Creating embeds
 * - Listing embeds
 * - Deleting embeds
 * - Getting embeds by ID
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

import { EmbedBuilderService } from '../../../services/discord/EmbedBuilderService';

function getService(): EmbedBuilderService {
  (EmbedBuilderService as any).instance = undefined;
  return EmbedBuilderService.getInstance();
}

describe('EmbedBuilderService', () => {
  let service: EmbedBuilderService;

  beforeEach(() => {
    service = getService();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = EmbedBuilderService.getInstance();
      const b = EmbedBuilderService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('createEmbed', () => {
    it('should create an embed template', () => {
      const result = service.createEmbed(
        'guild-1',
        'Welcome',
        {
          title: 'Welcome!',
          description: 'Hello {user.name}',
          color: 0x5865f2,
        },
        'user-1'
      );

      expect(typeof result).not.toBe('string'); // not an error string
      const embed = result as Exclude<typeof result, string>;
      expect(embed.guildId).toBe('guild-1');
      expect(embed.name).toBe('welcome');
      expect(embed.title).toBe('Welcome!');
      expect(embed.description).toBe('Hello {user.name}');
    });

    it('should prevent duplicate names in same guild', () => {
      service.createEmbed('guild-1', 'Welcome', { title: 'Welcome!' }, 'user-1');
      const result = service.createEmbed('guild-1', 'Welcome', { title: 'Another' }, 'user-1');
      expect(typeof result).toBe('string'); // error string
    });
  });

  describe('listEmbeds', () => {
    it('should list embeds for a guild', () => {
      service.createEmbed('guild-1', 'Welcome', { title: 'Welcome!' }, 'user-1');
      service.createEmbed('guild-1', 'Rules', { title: 'Rules' }, 'user-1');
      service.createEmbed('guild-2', 'Other', { title: 'Other' }, 'user-2');

      const guild1 = service.listEmbeds('guild-1');
      expect(guild1).toHaveLength(2);

      const guild2 = service.listEmbeds('guild-2');
      expect(guild2).toHaveLength(1);
    });
  });

  describe('deleteEmbed', () => {
    it('should delete an embed', () => {
      const result = service.createEmbed('guild-1', 'ToDelete', { title: 'Del' }, 'user-1');
      const embed = result as Exclude<typeof result, string>;
      expect(service.deleteEmbed(embed.id)).toBe(true);
    });

    it('should return false for non-existent embed', () => {
      expect(service.deleteEmbed('non-existent')).toBe(false);
    });
  });

  describe('getEmbed', () => {
    it('should retrieve an embed by id', () => {
      const result = service.createEmbed('guild-1', 'Test', { title: 'Test' }, 'user-1');
      const embed = result as Exclude<typeof result, string>;
      const found = service.getEmbed(embed.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('test');
    });

    it('should return undefined for non-existent embed', () => {
      expect(service.getEmbed('non-existent')).toBeUndefined();
    });
  });
});
