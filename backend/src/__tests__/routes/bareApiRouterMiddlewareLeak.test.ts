import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard for the shared-prefix router middleware leak.
 *
 * These routers are mounted at a shared/path-less/root prefix in app.ts (bare `/api`,
 * path-less `/api/v2`, `/api/organizations`, or the app root via `app.use(router)`).
 * Applying auth or tenant middleware via a router-global `router.use(...)` makes that
 * middleware run on EVERY request that flows through the router before reaching its real
 * handler — including unmatched requests that fall through from an earlier-registered
 * router — e.g. blocking org-less users on `/api/rsi/verify/*` with "No active
 * organization selected", or 401-ing unauthenticated public routes registered afterwards.
 *
 * Enforcement must be applied PER-ROUTE (spread a shared `authStack` into each route
 * definition) so it stays scoped to the router's own paths. This test fails if any of
 * these files re-introduces a router-global auth/tenant `router.use(...)`.
 *
 * NOT covered here: routers mounted at a UNIQUE sub-path (e.g. `v2Router.use('/squadrons',
 * router)`) — their router-global middleware cannot contaminate other resources, so the
 * per-route requirement does not apply to them.
 *
 * Companion coverage: `tenantContext.test.ts` proves `/rsi/verify/*` is tenant-optional.
 * See MASTER_IMPROVEMENT_PLAN_2026-06 item A6.
 */
const ROUTES_DIR = join(__dirname, '..', '..', 'routes');

// Routers mounted at a shared/path-less/root prefix. Each must apply auth/tenant
// middleware per-route, never via a router-global `router.use(...)`.
const SHARED_PREFIX_ROUTERS = [
  // Bare `/api` mounts
  'cargoManifestRoutes.ts',
  'squadronRoutes.ts',
  'organizationShipRoutes.ts',
  'crewAssignmentRoutes.ts',
  'fleetLogisticsRoutes.ts',
  'intelVaultRoutes.ts',
  'reputationRoutes.ts',
  'tournamentRoutes.ts',
  'shipDataRoutes.ts',
  // Path-less `/api/v2` mounts
  'briefingRoutes.ts',
  'imageRoutes.ts',
  // Shared `/api/organizations` prefix mount
  'organizationInventoryRoutes.ts',
  // App-root `app.use(router)` mount
  'webhookRoutes.ts',
] as const;

// Matches a router-GLOBAL auth/tenant middleware application at the start of a line, e.g.
//   router.use(authenticateToken)
//   router.use(authenticate)
//   router.use(tenantContextMiddleware)
//   router.use(requireTenantContext)
// The line-start anchor (with the multiline flag) means explanatory `// ... router.use(...)`
// comments are ignored, and a path-scoped form such as `router.use('/foo', authenticate)`
// does NOT match because the first argument there is a string literal, not the identifier.
const ROUTER_GLOBAL_AUTH_USE =
  /^\s*router\.use\(\s*(authenticate|authenticateToken|tenantContextMiddleware|requireTenantContext)\b/m;

describe('shared-prefix router middleware leak guard', () => {
  it.each(SHARED_PREFIX_ROUTERS)(
    '%s applies auth/tenant per-route, not via a router-global router.use()',
    file => {
      const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
      expect(source).not.toMatch(ROUTER_GLOBAL_AUTH_USE);
    }
  );

  it.each(SHARED_PREFIX_ROUTERS)('%s declares a shared per-route authStack', file => {
    const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
    expect(source).toMatch(/const authStack = \[/);
    expect(source).toMatch(/\.\.\.authStack/);
  });
});
