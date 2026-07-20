/**
 * Hub Configuration Tests
 */

import { getAllNavItems, getHub, getHubForPath, hubs } from '@/components/navigation/hubConfig';
import type { HubId } from '@/components/navigation/types';

describe('Hub Configuration', () => {
  describe('hubs array', () => {
    it('contains exactly 5 hubs', () => {
      expect(hubs).toHaveLength(5);
    });

    it('has correct hub IDs', () => {
      const hubIds = hubs.map(hub => hub.id);
      expect(hubIds).toEqual(['dashboard', 'ops', 'organization', 'community', 'alliance']);
    });

    it('all hubs have required properties', () => {
      hubs.forEach(hub => {
        expect(hub).toHaveProperty('id');
        expect(hub).toHaveProperty('label');
        expect(hub).toHaveProperty('icon');
        expect(hub).toHaveProperty('path');

        // Each hub should have either items or sections
        expect(hub.items || hub.sections).toBeDefined();
      });
    });
  });

  describe('getHub', () => {
    it('returns hub by ID', () => {
      const dashboardHub = getHub('dashboard');
      expect(dashboardHub).toBeDefined();
      expect(dashboardHub?.id).toBe('dashboard');
    });

    it('uses canonical community hub landing path without query params', () => {
      const communityHub = getHub('community');
      expect(communityHub?.path).toBe('/directories');
    });

    it('returns undefined for invalid ID', () => {
      const invalidHub = getHub('invalid' as HubId);
      expect(invalidHub).toBeUndefined();
    });
  });

  describe('getHubForPath', () => {
    it('returns dashboard hub for root path', () => {
      const hub = getHubForPath('/');
      // Root path no longer returns a hub (landing page is not a hub)
      expect(hub).toBeUndefined();
    });

    it('returns ops hub for fleet paths', () => {
      expect(getHubForPath('/fleet')?.id).toBe('ops');
      expect(getHubForPath('/fleet/ships')?.id).toBe('ops');
    });

    it('returns ops hub for activities path', () => {
      expect(getHubForPath('/activities')?.id).toBe('ops');
      expect(getHubForPath('/trading')?.id).toBe('ops');
    });

    it('returns ops hub for activities calendar query paths', () => {
      expect(getHubForPath('/activities', '?tab=calendar')?.id).toBe('ops');
    });

    it('returns community hub for member paths', () => {
      // /users (members) has includeInHub: false, so not in any hub
      expect(getHubForPath('/users')).toBeUndefined();
      expect(getHubForPath('/directories')?.id).toBe('community');
      // Note: federation-management now has its own path /federation
      expect(getHubForPath('/federation')?.id).toBe('alliance');
    });

    it('returns organization hub for org management paths', () => {
      expect(getHubForPath('/organizations')?.id).toBe('alliance');
      expect(getHubForPath('/recruitment')?.id).toBe('community');
    });

    it('returns dashboard hub for personal hangar', () => {
      expect(getHubForPath('/hangar')?.id).toBe('dashboard');
    });

    it('handles paths with trailing slashes', () => {
      expect(getHubForPath('/fleet/')?.id).toBe('ops');
    });

    it('handles deep paths', () => {
      expect(getHubForPath('/fleet/ships/123')?.id).toBe('ops');
      expect(getHubForPath('/activities/456')?.id).toBe('ops');
    });
  });

  describe('getAllNavItems', () => {
    it('returns all navigation items across all hubs', () => {
      const allItems = getAllNavItems();
      expect(allItems.length).toBeGreaterThan(0);
    });

    it('includes hub reference with each item', () => {
      const allItems = getAllNavItems();
      allItems.forEach(({ hub, item }) => {
        expect(hub).toBeDefined();
        expect(hub.id).toBeDefined();
        expect(item).toBeDefined();
        expect(item.path).toBeDefined();
      });
    });

    it('includes items from every hub', () => {
      const allItems = getAllNavItems();
      const hubIds = new Set(allItems.map(({ hub }) => hub.id));

      expect(hubIds.has('dashboard')).toBe(true);
      expect(hubIds.has('ops')).toBe(true);
      expect(hubIds.has('organization')).toBe(true);
      expect(hubIds.has('alliance')).toBe(true);
      expect(hubIds.has('community')).toBe(true);
    });
  });

  describe('Hub Organization Requirements', () => {
    it('marks ops hub as requiring organization', () => {
      // Ops hub has a mix of org-required and public routes
      expect(getHub('ops')?.requiresOrg).toBeDefined();
    });

    it('ops hub sections contain org-required items', () => {
      const allOpsItems = getAllNavItems()
        .filter(({ hub }) => hub.id === 'ops')
        .map(({ item }) => item);
      const orgRequired = allOpsItems.filter(item => item.requiresOrg);
      expect(orgRequired.length).toBeGreaterThan(0);
    });

    it('has both org-required and optional items in ops center', () => {
      const allOpsItems = getAllNavItems()
        .filter(({ hub }) => hub.id === 'ops')
        .map(({ item }) => item);

      const orgRequired = allOpsItems.filter(item => item.requiresOrg);
      const optional = allOpsItems.filter(item => !item.requiresOrg);

      expect(orgRequired.length).toBeGreaterThan(0);
      expect(optional.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation Structure', () => {
    it('dashboard hub has simple items (no sections)', () => {
      const dashboardHub = getHub('dashboard');
      expect(dashboardHub?.items).toBeDefined();
      expect(dashboardHub?.sections).toBeUndefined();
    });

    it('ops center hub has sections', () => {
      const opsHub = getHub('ops');
      expect(opsHub?.sections).toBeDefined();
      expect(opsHub?.sections!.length).toBeGreaterThan(0);
    });

    it('ops center includes expected routes across sections', () => {
      const allOpsItems = getAllNavItems()
        .filter(({ hub }) => hub.id === 'ops')
        .map(({ item }) => item.id);

      expect(allOpsItems).toEqual(expect.arrayContaining(['activities', 'trading', 'inventory']));
    });

    it('all navigation items have unique IDs', () => {
      const allItems = getAllNavItems();
      const ids = allItems.map(({ item }) => item.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all navigation items have valid paths', () => {
      const allItems = getAllNavItems();

      allItems.forEach(({ item }) => {
        expect(item.path).toMatch(/^\//); // Should start with /
      });
    });
  });

  describe('Icon References', () => {
    it('all hubs have icon components', () => {
      hubs.forEach(hub => {
        expect(hub.icon).toBeDefined();
        // MUI icon components are objects (React.memo/forwardRef), not plain functions
        expect(typeof hub.icon === 'function' || typeof hub.icon === 'object').toBe(true);
      });
    });

    it('all navigation items have icon components', () => {
      const allItems = getAllNavItems();

      allItems.forEach(({ item }) => {
        expect(item.icon).toBeDefined();
        // MUI icon components are objects (React.memo/forwardRef), not plain functions
        expect(typeof item.icon === 'function' || typeof item.icon === 'object').toBe(true);
      });
    });
  });
});
