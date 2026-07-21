/**
 * ShortcodeEngine Tests
 *
 * Tests for Shortcode Engine:
 * - Variable resolution
 * - Nested variable support
 * - Unknown variable handling
 * - Built-in resolvers
 * - Edge cases
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { ShortcodeEngine } from '../../../services/discord/ShortcodeEngine';

function getEngine(): ShortcodeEngine {
  (ShortcodeEngine as any).instance = undefined;
  return ShortcodeEngine.getInstance();
}

describe('ShortcodeEngine', () => {
  let engine: ShortcodeEngine;

  beforeEach(() => {
    engine = getEngine();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = ShortcodeEngine.getInstance();
      const b = ShortcodeEngine.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('resolve', () => {
    it('should resolve simple variables', () => {
      const context = {
        user: { username: 'TestUser', id: '123' },
      };
      const result = engine.resolve('Hello {user.name}!', context);
      expect(result).toBe('Hello TestUser!');
    });

    it('should handle multiple variables in one string', () => {
      const context = {
        user: { username: 'Alice', id: '456' },
        guild: { id: 'g1', name: 'My Server', memberCount: 100 },
      };
      const result = engine.resolve('Welcome {user.name} to {guild.name}!', context);
      expect(result).toBe('Welcome Alice to My Server!');
    });

    it('should leave unknown variables as-is', () => {
      const result = engine.resolve('Hello {unknown.var}!', {});
      expect(result).toBe('Hello {unknown.var}!');
    });

    it('should handle text with no variables', () => {
      const result = engine.resolve('No variables here', {});
      expect(result).toBe('No variables here');
    });

    it('should handle empty string', () => {
      const result = engine.resolve('', {});
      expect(result).toBe('');
    });
  });

  describe('getAvailableShortcodes', () => {
    it('should return a list of available shortcodes', () => {
      const shortcodes = engine.getAvailableShortcodes();
      expect(Array.isArray(shortcodes)).toBe(true);
      expect(shortcodes.length).toBeGreaterThan(0);
    });
  });
});
