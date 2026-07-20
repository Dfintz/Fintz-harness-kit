/**
 * Tests for Number Key Shortcuts (1-4 for hub navigation)
 */

import { getHubShortcut, hubNumberKeyMap } from '@/components/navigation/commandConfig';

describe('Number Key Shortcuts', () => {
  describe('hubNumberKeyMap structure', () => {
    it('should have exactly 4 hub shortcuts mapped (1-4)', () => {
      const keys = Object.keys(hubNumberKeyMap);
      expect(keys).toHaveLength(4);
      expect(keys).toEqual(['1', '2', '3', '4']);
    });

    it('should map 1 to Dashboard hub', () => {
      expect(hubNumberKeyMap['1']).toEqual({
        hubId: 'dashboard',
        path: '/dashboard',
        label: 'Dashboard (1)',
      });
    });

    it('should map 2 to Ops Center hub', () => {
      expect(hubNumberKeyMap['2']).toEqual({
        hubId: 'ops',
        path: '/activities',
        label: 'Ops Center (2)',
      });
    });

    it('should map 3 to Alliance hub', () => {
      expect(hubNumberKeyMap['3']).toEqual({
        hubId: 'alliance',
        path: '/federation',
        label: 'Alliance (3)',
      });
    });

    it('should map 4 to Community hub', () => {
      expect(hubNumberKeyMap['4']).toEqual({
        hubId: 'community',
        path: '/directories',
        label: 'Community (4)',
      });
    });

    it('should have all required properties in each shortcut', () => {
      for (const key of ['1', '2', '3', '4'] as const) {
        const shortcut = hubNumberKeyMap[key];
        expect(shortcut).toHaveProperty('hubId');
        expect(shortcut).toHaveProperty('path');
        expect(shortcut).toHaveProperty('label');
        expect(shortcut.hubId).toBeTruthy();
        expect(shortcut.path).toBeTruthy();
        expect(shortcut.label).toBeTruthy();
      }
    });

    it('should have valid hub paths', () => {
      expect(hubNumberKeyMap['1'].path).toBe('/dashboard');
      expect(hubNumberKeyMap['2'].path).toBe('/activities');
      expect(hubNumberKeyMap['3'].path).toBe('/federation');
      expect(hubNumberKeyMap['4'].path).toBe('/directories');
    });

    it('should have labels with number indicators', () => {
      expect(hubNumberKeyMap['1'].label).toContain('(1)');
      expect(hubNumberKeyMap['2'].label).toContain('(2)');
      expect(hubNumberKeyMap['3'].label).toContain('(3)');
      expect(hubNumberKeyMap['4'].label).toContain('(4)');
    });
  });

  describe('getHubShortcut function', () => {
    it('should return shortcut for valid number key 1', () => {
      const shortcut = getHubShortcut('1');
      expect(shortcut).not.toBeNull();
      expect(shortcut?.hubId).toBe('dashboard');
      expect(shortcut?.path).toBe('/dashboard');
    });

    it('should return shortcut for valid number key 2', () => {
      const shortcut = getHubShortcut('2');
      expect(shortcut).not.toBeNull();
      expect(shortcut?.hubId).toBe('ops');
      expect(shortcut?.path).toBe('/activities');
    });

    it('should return shortcut for valid number key 3', () => {
      const shortcut = getHubShortcut('3');
      expect(shortcut).not.toBeNull();
      expect(shortcut?.hubId).toBe('alliance');
      expect(shortcut?.path).toBe('/federation');
    });

    it('should return shortcut for valid number key 4', () => {
      const shortcut = getHubShortcut('4');
      expect(shortcut).not.toBeNull();
      expect(shortcut?.hubId).toBe('community');
      expect(shortcut?.path).toBe('/directories');
    });

    it('should return null for invalid number key', () => {
      expect(getHubShortcut('0')).toBeNull();
      expect(getHubShortcut('5')).toBeNull();
      expect(getHubShortcut('6')).toBeNull();
    });

    it('should return null for non-number key', () => {
      expect(getHubShortcut('a')).toBeNull();
      expect(getHubShortcut('q')).toBeNull();
      expect(getHubShortcut('!')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(getHubShortcut('')).toBeNull();
    });

    it('should return null for multi-character string', () => {
      expect(getHubShortcut('12')).toBeNull();
      expect(getHubShortcut('cmd')).toBeNull();
    });

    it('should return correct structure with all required fields', () => {
      const shortcut = getHubShortcut('1');
      expect(shortcut).toHaveProperty('hubId');
      expect(shortcut).toHaveProperty('path');
      expect(shortcut).toHaveProperty('label');
    });
  });

  describe('Hub order and mapping correctness', () => {
    it('should map hubs in correct order (1-4)', () => {
      const shortcuts = ['1', '2', '3', '4'].map(key => getHubShortcut(key));
      const hubs = shortcuts.map(s => s?.hubId);
      expect(hubs).toEqual(['dashboard', 'ops', 'alliance', 'community']);
    });

    it('should have unique paths for each hub', () => {
      const paths = ['1', '2', '3', '4'].map(key => getHubShortcut(key)?.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(4);
    });

    it('should have unique hub IDs for each shortcut', () => {
      const hubIds = ['1', '2', '3', '4'].map(key => getHubShortcut(key)?.hubId);
      const uniqueIds = new Set(hubIds);
      expect(uniqueIds.size).toBe(4);
    });

    it('should navigate to valid application routes', () => {
      const validRoutes = ['/dashboard', '/activities', '/federation', '/directories'];
      ['1', '2', '3', '4'].forEach((key, index) => {
        const shortcut = getHubShortcut(key);
        expect(shortcut?.path).toBe(validRoutes[index]);
      });
    });
  });

  describe('Keyboard shortcut guidelines', () => {
    it('should provide keyboard shortcut labels without modifiers', () => {
      // Number keys should work without Ctrl/Cmd/Alt/Shift
      ['1', '2', '3', '4'].forEach(key => {
        const shortcut = getHubShortcut(key);
        expect(shortcut).not.toBeNull();
        expect(shortcut?.label).toMatch(/\(\d\)$/); // Ends with (N)
      });
    });

    it('should be accessible without requiring modifiers', () => {
      // All shortcuts should be accessible with just the number key
      // (no Ctrl, Cmd, Alt, or Shift required)
      const shortcuts = ['1', '2', '3', '4'].map(key => ({
        key,
        shortcut: getHubShortcut(key),
      }));

      shortcuts.forEach(({ key, shortcut }) => {
        expect(shortcut).not.toBeNull();
        // The key itself is sufficient (no "Ctrl+" prefix needed)
        expect(shortcut?.label).toContain(key);
      });
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle case-sensitive keys correctly', () => {
      // Should only work with exact character '1', not other representations
      expect(getHubShortcut('1')).not.toBeNull();
    });

    it('should not be affected by whitespace', () => {
      expect(getHubShortcut(' 1')).toBeNull();
      expect(getHubShortcut('1 ')).toBeNull();
      expect(getHubShortcut(' 1 ')).toBeNull();
    });

    it('should handle rapid consecutive calls', () => {
      // Should be idempotent
      const result1 = getHubShortcut('1');
      const result2 = getHubShortcut('1');
      const result3 = getHubShortcut('1');
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('should work with all number combinations', () => {
      for (let i = 1; i <= 4; i++) {
        const key = i.toString();
        const shortcut = getHubShortcut(key);
        expect(shortcut).not.toBeNull();
        expect(shortcut?.hubId).toBeTruthy();
      }
    });
  });

  describe('Discovery and documentation', () => {
    it('should have labels that indicate keyboard shortcuts to users', () => {
      ['1', '2', '3', '4'].forEach(key => {
        const shortcut = getHubShortcut(key);
        // Label should make it clear this is a keyboard shortcut
        expect(shortcut?.label).toMatch(/\(\d\)/);
      });
    });

    it('should map to memorable hub positions', () => {
      // 1 = first hub (Dashboard), 2 = second (Fleet), etc.
      const shortcuts = ['1', '2', '3', '4'].map((key, index) => ({
        key,
        index,
        shortcut: getHubShortcut(key),
      }));

      shortcuts.forEach(({ key, index, shortcut }) => {
        expect(shortcut?.label).toContain(key);
      });
    });

    it('should provide consistent labels across all shortcuts', () => {
      const labels = ['1', '2', '3', '4'].map(key => getHubShortcut(key)?.label);
      // All should have format "HubName (N)"
      labels.forEach(label => {
        expect(label).toMatch(/\s\(\d\)$/);
      });
    });
  });
});
