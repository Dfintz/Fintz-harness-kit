/**
 * Navigation Registry Tests
 *
 * Verifies route definitions, disabled features, and federation
 * management configuration added in this sprint.
 */
import { matchBreadcrumbConfig } from '@/components/navigation/breadcrumbConfig';
import { searchCommands } from '@/components/navigation/commandConfig';
import { getHubForPath } from '@/components/navigation/hubConfig';
import {
  getHubRoutes,
  getRoute,
  getRouteByLocation,
  getRouteByPath,
} from '@/components/navigation/navigationRegistry';

describe('navigationRegistry', () => {
  describe('disabled features (Coming Soon™)', () => {
    const disabledRouteIds = [
      'ship-comparison',
      'cross-system-analytics',
      'bot-stats',
      'public-stats',
    ];

    it.each(disabledRouteIds)('should have disabledTooltip set for %s', (routeId: string) => {
      const route = getRoute(routeId);
      expect(route).toBeDefined();
      expect(route?.disabledTooltip).toBe('Coming Soon™');
    });
  });

  describe('operations rename', () => {
    it('should label missions route as Operations', () => {
      const route = getRoute('missions');
      expect(route).toBeDefined();
      expect(route?.label).toBe('Operations');
    });

    it('should keep path as /missions for backward compatibility', () => {
      const route = getRoute('missions');
      expect(route?.path).toBe('/missions');
    });
  });

  describe('federation-management route', () => {
    it('should be in the alliance hub', () => {
      const route = getRoute('federation-management');
      expect(route?.hub).toBe('alliance');
      expect(route?.category).toBe('alliance');
    });

    it('should require organization', () => {
      const route = getRoute('federation-management');
      expect(route?.requiresOrg).toBe(true);
    });
  });

  describe('org-members route', () => {
    it('should exist with correct path', () => {
      const route = getRoute('org-members');
      expect(route).toBeDefined();
      expect(route?.path).toBe('/org-settings/members');
    });

    it('should be labeled Members & Permissions', () => {
      const route = getRoute('org-members');
      expect(route?.label).toBe('Members & Permissions');
    });
  });

  describe('hub route counts', () => {
    it('should have routes in the ops hub (including fleet)', () => {
      const opsRoutes = getHubRoutes('ops');
      expect(opsRoutes.length).toBeGreaterThanOrEqual(3);
    });

    it('should have routes in the ops hub', () => {
      const opsRoutes = getHubRoutes('ops');
      expect(opsRoutes.length).toBeGreaterThanOrEqual(5);
    });

    it('should have routes in the organization hub', () => {
      const orgRoutes = getHubRoutes('organization');
      expect(orgRoutes.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('baseline navigation behavior matrix', () => {
    it('should resolve hub context for core navigation paths', () => {
      expect(getHubForPath('/activities')?.id).toBe('ops');
      expect(getHubForPath('/org-settings/members')?.id).toBe('organization');
      expect(getHubForPath('/directories')?.id).toBe('community');
    });

    it('should keep tab deep-link routes addressable by exact query paths', () => {
      const orgsTab = getRoute('directory-organizations');
      expect(orgsTab).toBeDefined();
      expect(getRouteByPath(orgsTab!.path)?.id).toBe('directory-organizations');
    });

    it('should keep canonical directory route addressable without query params', () => {
      expect(getRouteByPath('/directories')?.id).toBe('directories');
    });

    it('should resolve query-aware tab routes from pathname + search', () => {
      const route = getRouteByLocation('/directories', '?tab=organizations');
      expect(route?.id).toBe('directory-organizations');
    });

    it('should resolve activities calendar deep links to the canonical query route', () => {
      expect(getRouteByLocation('/activities', '?tab=calendar')?.id).toBe('activities-calendar');
      expect(getRouteByPath('/activities?tab=calendar')?.id).toBe('activities-calendar');
      expect(getRouteByLocation('/activities', '?view=month&tab=calendar')?.id).toBe(
        'activities-calendar'
      );
    });

    it('should resolve tab deep links when query params are reordered or extended', () => {
      expect(getRouteByLocation('/directories', '?view=grid&tab=organizations')?.id).toBe(
        'directory-organizations'
      );
      expect(getRouteByPath('/directories?view=grid&tab=organizations')?.id).toBe(
        'directory-organizations'
      );
    });

    it('should resolve tab deep links with hash fragments in string paths', () => {
      const route = getRouteByPath('/directories?tab=organizations#community');
      expect(route?.id).toBe('directory-organizations');
    });

    it('should resolve nested paths to the most specific parent route', () => {
      const route = getRouteByLocation('/org-settings/members/manage', '');
      expect(route?.id).toBe('org-members');
    });

    it('should generate breadcrumb config for members and directory tab routes', () => {
      const membersBreadcrumb = matchBreadcrumbConfig('/org-settings/members');
      expect(membersBreadcrumb?.items.some(item => item.label === 'Members & Permissions')).toBe(
        true
      );

      const orgDirectoryBreadcrumb = matchBreadcrumbConfig('/directories?tab=organizations');
      expect(orgDirectoryBreadcrumb?.items.some(item => item.label === 'Organizations')).toBe(true);

      const extendedOrgDirectoryBreadcrumb = matchBreadcrumbConfig(
        '/directories?view=grid&tab=organizations'
      );
      expect(
        extendedOrgDirectoryBreadcrumb?.items.some(item => item.label === 'Organizations')
      ).toBe(true);

      const activitiesCalendarBreadcrumb = matchBreadcrumbConfig('/activities?tab=calendar');
      expect(activitiesCalendarBreadcrumb?.items.some(item => item.label === 'Calendar')).toBe(
        true
      );
    });

    it('should keep directory tab entries discoverable in command search', () => {
      const results = searchCommands('organizations', { limit: 25 });
      expect(results.some(command => command.id === 'directory-organizations')).toBe(true);
    });

    it('should keep activities calendar entry discoverable in command search', () => {
      const results = searchCommands('calendar', { limit: 25 });
      expect(results.some(command => command.id === 'activities-calendar')).toBe(true);
    });
  });
});
