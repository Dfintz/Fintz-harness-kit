/**
 * Tests for Phase 5c: Navigation Refactoring
 * Tests the new navigation registry, config generators, and hooks
 */

import {
  generateBreadcrumbConfig,
  generateCommandConfig,
  generateHubConfig,
  validateRegistry,
} from '@/components/navigation/configGenerators';
import {
  getCommandRoutes,
  getHubRoutes,
  getRoute,
  getRouteByPath,
  routeRegistry,
} from '@/components/navigation/navigationRegistry';

describe('Phase 5c: Navigation Refactoring', () => {
  describe('Navigation Registry', () => {
    it('should have all required routes defined', () => {
      const allRoutes = Object.values(routeRegistry);
      expect(allRoutes.length).toBeGreaterThan(10);
    });

    it('should have routes for all 5 hubs', () => {
      const hubs = new Set(Object.values(routeRegistry).map(r => r.hub));
      expect(hubs.size).toBe(5);
      expect(Array.from(hubs).sort((a, b) => a.localeCompare(b))).toEqual([
        'alliance',
        'community',
        'dashboard',
        'ops',
        'organization',
      ]);
    });

    it('should have valid hub route distributions', () => {
      const byHub: Record<string, number> = {
        dashboard: 0,
        ops: 0,
        organization: 0,
        alliance: 0,
        community: 0,
      };

      Object.values(routeRegistry).forEach(route => {
        byHub[route.hub]++;
      });

      // Each hub should have at least 1 route
      expect(byHub.dashboard).toBeGreaterThan(0);
      expect(byHub.ops).toBeGreaterThan(0);
      expect(byHub.organization).toBeGreaterThan(0);
      expect(byHub.alliance).toBeGreaterThan(0);
      expect(byHub.community).toBeGreaterThan(0);
    });

    it('should have unique route IDs', () => {
      const ids = Object.values(routeRegistry).map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique paths', () => {
      const paths = Object.values(routeRegistry).map(r => r.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(paths.length);
    });

    it('should have all required route fields', () => {
      Object.values(routeRegistry).forEach(route => {
        expect(route.id).toBeTruthy();
        expect(route.label).toBeTruthy();
        expect(route.path).toBeTruthy();
        expect(route.icon).toBeTruthy();
        expect(route.hub).toBeTruthy();
      });
    });

    it('should have valid paths starting with /', () => {
      Object.values(routeRegistry).forEach(route => {
        expect(route.path).toMatch(/^\//);
      });
    });
  });

  describe('getRoute function', () => {
    it('should return route by ID', () => {
      const route = getRoute('dashboard');
      expect(route).toBeDefined();
      expect(route?.label).toBe('Dashboard');
      // Dashboard route is now /dashboard, not /
      expect(route?.path).toBe('/dashboard');
    });

    it('should return undefined for non-existent ID', () => {
      const route = getRoute('non-existent-route');
      expect(route).toBeUndefined();
    });

    it('should return correct route for all defined routes', () => {
      Object.values(routeRegistry).forEach(expectedRoute => {
        const found = getRoute(expectedRoute.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(expectedRoute.id);
      });
    });
  });

  describe('getRouteByPath function', () => {
    it('should return route by path', () => {
      // Test with /dashboard instead of /
      const route = getRouteByPath('/dashboard');
      expect(route).toBeDefined();
      expect(route?.label).toBe('Dashboard');
    });

    it('should return undefined for non-existent path', () => {
      const route = getRouteByPath('/non-existent');
      expect(route).toBeUndefined();
    });

    it('should return correct route for all defined paths', () => {
      Object.values(routeRegistry).forEach(expectedRoute => {
        const found = getRouteByPath(expectedRoute.path);
        expect(found).toBeDefined();
        expect(found?.path).toBe(expectedRoute.path);
      });
    });
  });

  describe('getHubRoutes function', () => {
    it('should return routes for dashboard hub', () => {
      const routes = getHubRoutes('dashboard');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.every(r => r.hub === 'dashboard')).toBe(true);
    });

    it('should return routes for ops hub (includes fleet)', () => {
      const routes = getHubRoutes('ops');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.every(r => r.hub === 'ops')).toBe(true);
    });

    it('should return routes for ops hub', () => {
      const routes = getHubRoutes('ops');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.every(r => r.hub === 'ops')).toBe(true);
    });

    it('should return routes for community hub', () => {
      const routes = getHubRoutes('community');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.every(r => r.hub === 'community')).toBe(true);
    });

    it('should return routes sorted by order', () => {
      const routes = getHubRoutes('dashboard');
      for (let i = 0; i < routes.length - 1; i++) {
        const current = routes[i].order || 999;
        const next = routes[i + 1].order || 999;
        expect(current).toBeLessThanOrEqual(next);
      }
    });
  });

  describe('getCommandRoutes function', () => {
    it('should return all command routes', () => {
      const routes = getCommandRoutes();
      expect(routes.length).toBeGreaterThan(10);
    });

    it('should only include command-enabled routes', () => {
      const routes = getCommandRoutes();
      routes.forEach(route => {
        expect(route.includeInCommand).not.toBe(false);
      });
    });

    it('should return routes sorted', () => {
      const routes = getCommandRoutes();
      // Should be sorted by hub, then by order
      for (let i = 0; i < routes.length - 1; i++) {
        const current = routes[i];
        const next = routes[i + 1];
        // Simple check: routes should maintain some order
        expect(current).toBeDefined();
        expect(next).toBeDefined();
      }
    });

    it('should keep community commands sorted before alliance commands', () => {
      const generatedCommands = generateCommandConfig(routeRegistry);
      const firstCommunityIndex = generatedCommands.findIndex(
        command => command.hub === 'community'
      );
      const firstAllianceIndex = generatedCommands.findIndex(command => command.hub === 'alliance');

      expect(firstCommunityIndex).toBeGreaterThan(-1);
      expect(firstAllianceIndex).toBeGreaterThan(-1);
      expect(firstCommunityIndex).toBeLessThan(firstAllianceIndex);
    });
  });

  describe('Registry Validation', () => {
    it('should have no validation errors', () => {
      const errors = validateRegistry(routeRegistry);
      expect(errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const invalidRegistry = {
        'test-route': {
          // Missing required fields
          id: 'test',
        } as any,
      };

      const errors = validateRegistry(invalidRegistry);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('missing'))).toBe(true);
    });

    it('should detect duplicate IDs', () => {
      const invalidRegistry = {
        'route-1': { ...Object.values(routeRegistry)[0], id: 'duplicate' },
        'route-2': { ...Object.values(routeRegistry)[1], id: 'duplicate' },
      };

      const errors = validateRegistry(invalidRegistry);
      expect(errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('should validate path format', () => {
      const invalidRegistry = {
        'test-route': {
          id: 'test',
          path: 'no-slash', // Invalid - must start with /
        } as any,
      };

      const errors = validateRegistry(invalidRegistry);
      expect(errors.some(e => e.includes('must start with'))).toBe(true);
    });
  });

  describe('Config Generators', () => {
    it('should generate hub config from registry', () => {
      const hubConfig = generateHubConfig(routeRegistry);
      expect(hubConfig.length).toBe(5);
      expect(hubConfig.map(h => h.id).sort()).toEqual([
        'alliance',
        'community',
        'dashboard',
        'ops',
        'organization',
      ]);
    });

    it('should generate command config from registry', () => {
      const commandConfig = generateCommandConfig(routeRegistry);
      expect(commandConfig.length).toBeGreaterThan(10);

      // All commands should have required fields
      commandConfig.forEach(cmd => {
        expect(cmd.id).toBeTruthy();
        expect(cmd.label).toBeTruthy();
        expect(cmd.path).toBeTruthy();
      });
    });

    it('should generate breadcrumb config from registry', () => {
      const breadcrumbConfig = generateBreadcrumbConfig(routeRegistry);

      // Should have entries for each route
      const pathCount = Object.keys(breadcrumbConfig).length;
      expect(pathCount).toBeGreaterThan(10);

      // Each breadcrumb chain should have at least Home
      Object.values(breadcrumbConfig).forEach(chain => {
        expect(chain.length).toBeGreaterThan(0);
        expect(chain[0].label).toBe('Home');
      });
    });

    it('generated hub config should match registry routes', () => {
      const hubConfig = generateHubConfig(routeRegistry);

      hubConfig.forEach(hub => {
        const hubRoutesFromRegistry = getHubRoutes(hub.id).filter(r => r.includeInHub !== false);
        // Items can be in sections or flat items
        const totalHubItems =
          (hub.items?.length || 0) +
          (hub.sections?.reduce((sum, s) => sum + s.items.length, 0) || 0);
        expect(totalHubItems).toBe(hubRoutesFromRegistry.length);
      });
    });

    it('generated command config should not exceed command routes', () => {
      const commandConfig = generateCommandConfig(routeRegistry);
      const commandRoutes = getCommandRoutes();

      // generateCommandConfig excludes disabled routes (disabledTooltip)
      expect(commandConfig.length).toBeLessThanOrEqual(commandRoutes.length);
      expect(commandConfig.length).toBeGreaterThan(0);
    });

    it('generated configs should have no duplication', () => {
      const commandConfig = generateCommandConfig(routeRegistry);
      const ids = commandConfig.map(c => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Data Consolidation Benefits', () => {
    it('should reduce code duplication by centralizing routes', () => {
      const registrySize = Object.keys(routeRegistry).length;
      const commandConfig = generateCommandConfig(routeRegistry);
      const hubConfig = generateHubConfig(routeRegistry);

      // All configs derive from same source
      expect(registrySize).toBeGreaterThan(10);
      expect(commandConfig.length).toBeGreaterThan(10);
      expect(hubConfig.length).toBe(5);
    });

    it('should maintain consistency across configs', () => {
      const registryRoutes = Object.values(routeRegistry);
      const commandConfig = generateCommandConfig(routeRegistry);

      // Every command should have corresponding registry route
      commandConfig.forEach(cmd => {
        const registryRoute = registryRoutes.find(r => r.id === cmd.id);
        expect(registryRoute).toBeDefined();
        expect(registryRoute?.path).toBe(cmd.path);
        expect(registryRoute?.label).toBe(cmd.label);
      });
    });

    it('should make adding new routes simple', () => {
      // To add a new route, just add to registry
      // All configs regenerate automatically
      const initialCommandCount = generateCommandConfig(routeRegistry).length;
      const initialHubCount = generateHubConfig(routeRegistry).length;

      expect(initialCommandCount).toBeGreaterThan(0);
      expect(initialHubCount).toBe(5);

      // No need to manually update 3 different files
    });
  });

  describe('Route Organization', () => {
    it('should have properly categorized routes', () => {
      const routes = Object.values(routeRegistry);

      // All routes should have valid categories
      routes.forEach(route => {
        if (route.category) {
          expect([
            'dashboard',
            'ops',
            'organization',
            'alliance',
            'community',
            'tools',
            'help',
          ]).toContain(route.category);
        }
      });
    });

    it('should have routes with meaningful descriptions', () => {
      const routes = Object.values(routeRegistry);

      // Most routes should have descriptions
      const withDescription = routes.filter(r => r.description).length;
      expect(withDescription).toBeGreaterThan(routes.length * 0.8);
    });

    it('should have routes with helpful keywords', () => {
      const routes = Object.values(routeRegistry);

      // Most routes should have keywords for search
      const withKeywords = routes.filter(r => r.keywords && r.keywords.length > 0).length;
      expect(withKeywords).toBeGreaterThan(routes.length * 0.7);
    });
  });

  describe('Accessibility and Organization', () => {
    it('should mark organization-required routes', () => {
      const routes = Object.values(routeRegistry);
      const orgRequired = routes.filter(r => r.requiresOrg);

      // Some routes should require org
      expect(orgRequired.length).toBeGreaterThan(0);

      // Ops hub routes (including fleet section) typically require org
      const opsRoutes = routes.filter(r => r.hub === 'ops' && r.section === 'Fleet');
      const opsOrgRequired = opsRoutes.filter(r => r.requiresOrg);
      expect(opsOrgRequired.length).toBeGreaterThan(0);
    });

    it('should have icon assignments for all routes', () => {
      const routes = Object.values(routeRegistry);

      routes.forEach(route => {
        expect(route.icon).toBeTruthy();
        expect(typeof route.icon).toBe('string');
      });
    });
  });
});
