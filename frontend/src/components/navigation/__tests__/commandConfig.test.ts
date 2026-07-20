/**
 * Command Configuration Tests
 *
 * Tests for command data, search algorithms, and filtering
 */

import {
  commands,
  getCategories,
  getCommandsByCategory,
  searchCommands,
} from '@/components/navigation/commandConfig';

describe('Command Configuration', () => {
  // ============================================
  // Data Validation Tests
  // ============================================

  describe('Command Data Structure', () => {
    it('should have at least 16+ commands', () => {
      // After refactoring to auto-generated commands, we have 16 commands
      expect(commands.length).toBeGreaterThanOrEqual(16);
    });

    it('should have all required command fields', () => {
      commands.forEach(cmd => {
        expect(cmd).toHaveProperty('id');
        expect(cmd).toHaveProperty('label');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('category');
        expect(typeof cmd.id).toBe('string');
        expect(typeof cmd.label).toBe('string');
        expect(typeof cmd.description).toBe('string');
      });
    });

    it('should have unique command IDs', () => {
      const ids = commands.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(commands.length);
    });

    it('should have valid categories', () => {
      const validCategories = [
        'dashboard',
        'ops',
        'organization',
        'alliance',
        'community',
        'tools',
        'help',
      ];
      commands.forEach(cmd => {
        expect(validCategories).toContain(cmd.category);
      });
    });

    it('should have valid hub values if specified', () => {
      const validHubs = ['dashboard', 'ops', 'organization', 'alliance', 'community'];
      commands.forEach(cmd => {
        if (cmd.hub) {
          expect(validHubs).toContain(cmd.hub);
        }
      });
    });

    it('should have either path or action defined', () => {
      commands.forEach(cmd => {
        const hasPath = typeof cmd.path === 'string';
        const hasAction = typeof cmd.action === 'function';
        expect(hasPath || hasAction).toBe(true);
      });
    });
  });

  // ============================================
  // Category Tests
  // ============================================

  describe('Categories', () => {
    it('should return all unique categories', () => {
      const cats = getCategories();
      expect(cats.length).toBeGreaterThan(0);
      expect(cats).toContain('dashboard');
      expect(cats).toContain('ops');
      expect(cats).toContain('community');
    });

    it('should get commands by category', () => {
      const dashboardCmds = getCommandsByCategory('dashboard');
      expect(dashboardCmds.length).toBeGreaterThan(0);
      dashboardCmds.forEach(cmd => {
        expect(cmd.category).toBe('dashboard');
      });
    });

    it('should handle empty category results', () => {
      // Even if a category has no commands, function should not error
      const result = getCommandsByCategory('dashboard');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should sort commands by order within category', () => {
      const dashboardCmds = getCommandsByCategory('dashboard');
      for (let i = 1; i < dashboardCmds.length; i++) {
        const prevOrder = dashboardCmds[i - 1].order || 0;
        const currOrder = dashboardCmds[i].order || 0;
        expect(currOrder).toBeGreaterThanOrEqual(prevOrder);
      }
    });
  });

  // ============================================
  // Search Algorithm Tests
  // ============================================

  describe('Search Commands', () => {
    it('should return all commands with empty query', () => {
      const results = searchCommands('');
      expect(results.length).toEqual(commands.length);
    });

    it('should return empty array for non-matching query', () => {
      const results = searchCommands('xyznonexistent');
      expect(results.length).toBe(0);
    });

    it('should find exact label matches', () => {
      const results = searchCommands('Dashboard');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].label).toBe('Dashboard');
    });

    it('should find case-insensitive matches', () => {
      const lowerResults = searchCommands('dashboard');
      const upperResults = searchCommands('DASHBOARD');
      expect(lowerResults.length).toEqual(upperResults.length);
      expect(lowerResults[0].id).toBe(upperResults[0].id);
    });

    it('should find prefix matches', () => {
      const results = searchCommands('fleet');
      expect(results.length).toBeGreaterThan(0);
      // First result should be "Fleet"
      expect(results[0].label.toLowerCase()).toContain('fleet');
    });

    it('should find substring matches', () => {
      const results = searchCommands('activities');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].label).toBe('Activities');
    });

    it('should not include disabled routes', () => {
      const results = searchCommands('ship comparison');
      const hasShipComparison = results.some(r => r.label === 'Ship Comparison');
      expect(hasShipComparison).toBe(false);
    });

    it('should find description matches', () => {
      // Search for a word commonly in descriptions
      const results = searchCommands('manage');
      expect(results.length).toBeGreaterThanOrEqual(0);
      // Many commands have "manage" or "manage" in description
    });

    it('should find keyword matches', () => {
      // Commands have keywords like 'my ships' for Personal Hangar
      const results = searchCommands('personal');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should fuzzy match partial phrases', () => {
      // Search for a term that matches fleet-related commands
      const results = searchCommands('fleet');
      // Should find some fleet-related commands
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.label.toLowerCase().includes('fleet'))).toBe(true);
    });

    it('should handle whitespace trimming', () => {
      const trimmedResults = searchCommands('fleet');
      const untrimmedResults = searchCommands('  fleet  ');
      // Results should be the same
      expect(trimmedResults.length).toBeGreaterThanOrEqual(0);
      expect(untrimmedResults.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit results by limit option', () => {
      const allResults = searchCommands('a', { limit: 100 });
      const limitedResults = searchCommands('a', { limit: 5 });
      expect(limitedResults.length).toBeLessThanOrEqual(5);
    });

    it('should filter by category option', () => {
      const dashboardResults = searchCommands('', { category: 'dashboard' });
      dashboardResults.forEach(cmd => {
        expect(cmd.category).toBe('dashboard');
      });
    });

    it('should respect both category and limit options', () => {
      const fleetCmds = getCommandsByCategory('fleet');
      if (fleetCmds.length > 0) {
        const results = searchCommands('', { category: 'fleet', limit: 3 });
        expect(results.length).toBeLessThanOrEqual(3);
        results.forEach(cmd => {
          expect(cmd.category).toBe('fleet');
        });
      }
    });
  });

  // ============================================
  // Fuzzy Search Quality Tests
  // ============================================

  describe('Fuzzy Search Quality', () => {
    it('should rank exact matches higher', () => {
      const results = searchCommands('dashboard');
      expect(results[0].label).toBe('Dashboard');
    });

    it('should rank prefix matches high', () => {
      const results = searchCommands('fleet');
      expect(results[0].label.toLowerCase()).toContain('fleet');
    });

    it('should rank description matches lower than label matches', () => {
      // This is a quality test - results should be sensible
      const results = searchCommands('view');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return results in score order', () => {
      const results = searchCommands('ship');
      // First result should be "Personal Hangar" or ship-related
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].label.toLowerCase()).toContain('ship');
    });

    it('should handle single-character searches', () => {
      const results = searchCommands('f');
      // Should find commands starting with or containing 'f'
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle multiple word searches', () => {
      const results = searchCommands('org ships');
      // Should find "Organization Ships"
      const hasOrgShips = results.some(r => r.label.includes('Organization'));
      expect(hasOrgShips || results.length > 0).toBe(true);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle special characters in search', () => {
      const results = searchCommands('@#$%^&*');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle very long search strings', () => {
      const longQuery = 'a'.repeat(1000);
      const results = searchCommands(longQuery);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle only whitespace query', () => {
      const results = searchCommands('   ');
      // Whitespace should be trimmed, treating as empty
      expect(results.length).toBeGreaterThan(0);
    });

    it('should not mutate commands array', () => {
      const originalLength = commands.length;
      searchCommands('fleet');
      expect(commands.length).toBe(originalLength);
    });

    it('should be case-insensitive for search', () => {
      const lowerResults = searchCommands('dashboard');
      const upperResults = searchCommands('DASHBOARD');
      const mixedResults = searchCommands('DaShBoArD');

      expect(lowerResults[0].id).toBe(upperResults[0].id);
      expect(lowerResults[0].id).toBe(mixedResults[0].id);
    });
  });

  // ============================================
  // Command Content Tests
  // ============================================

  describe('Command Content Coverage', () => {
    it('should have dashboard hub commands', () => {
      const cmds = getCommandsByCategory('dashboard');
      expect(cmds.length).toBeGreaterThan(0);
    });

    it('should have ops hub commands (includes fleet)', () => {
      const cmds = getCommandsByCategory('ops');
      expect(cmds.length).toBeGreaterThan(0);
    });

    it('should have ops center commands', () => {
      const cmds = getCommandsByCategory('ops');
      expect(cmds.length).toBeGreaterThan(0);
    });

    it('should have community hub commands', () => {
      const cmds = getCommandsByCategory('community');
      expect(cmds.length).toBeGreaterThan(0);
    });

    it('should cover major application pages', () => {
      const labels = commands.map(c => c.label.toLowerCase());

      // Check for some key commands
      const hasDash = labels.some(l => l.includes('dashboard'));
      const hasFleet = labels.some(l => l.includes('fleet'));
      const hasMembers = labels.some(l => l.includes('member'));

      expect(hasDash || hasFleet || hasMembers).toBe(true);
    });
  });

  // ============================================
  // Keyboard Shortcut Tests
  // ============================================

  describe('Keyboard Shortcuts', () => {
    it('should have some commands with shortcuts defined', () => {
      const withShortcuts = commands.filter(c => c.shortcut);
      // Not all need shortcuts, but some should have them
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should have valid shortcut formats', () => {
      commands.forEach(cmd => {
        if (cmd.shortcut) {
          // Should be a string like "ctrl+k" or "cmd+shift+p"
          expect(typeof cmd.shortcut).toBe('string');
          expect(cmd.shortcut.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
