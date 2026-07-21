/**
 * API v2 Main Router
 * Central routing configuration for API v2 endpoints
 * Implements standardized query parameters and response formats
 * per ROADMAP.md section 2.3
 */

import { Router } from 'express';

import { trackUserActivity } from '../../middleware/activityTracking';
import { csrfProtection } from '../../middleware/csrf';
import { errorHandlerV2 } from '../../middleware/errorHandlerV2';
import { requireOrgMembership } from '../../middleware/orgMembership';
import { queryParserMiddleware } from '../../middleware/queryParser';
import { requestIdMiddleware } from '../../middleware/requestId';
import { standardResponseMiddleware } from '../../middleware/standardResponse';
import { memberAuditRouter } from '../memberAuditRoutes';

import { router as twoFactorRoutes } from './2fa';
import { router as achievementsRoutes } from './achievements';
import { router as activitiesRoutes } from './activities';
import { router as adminRoutes } from './admin';
import { router as allianceDiplomacyRoutes } from './allianceDiplomacy';
import { router as analyticsRoutes } from './analytics';
import { router as announcementsRoutes } from './announcements';
import { router as apiKeysRoutes } from './apiKeys';
import { router as approvalsRoutes } from './approvals';
import { router as archivesRoutes } from './archives';
import { router as auditRoutes } from './audit';
import { router as authRoutes } from './auth';
import { router as availabilityRoutes } from './availability';
import { router as backupRoutes } from './backup';
import { router as botCommandsRoutes } from './botCommands';
import { router as bountiesRoutes } from './bounties';
import { router as briefingsRoutes } from './briefings';
import { router as calendarRoutes } from './calendar';
import { casRoutes } from './casRoutes';
import { router as certificationsRoutes } from './certifications';
import { router as claimsRoutes } from './claims';
// combat removed — Star Citizen has no combat logging API
import { router as commentsRoutes } from './comments';
import { router as configRoutes } from './config';
import { router as contactRequestsRoutes } from './contactRequests';
import { router as creditsRoutes } from './credits';
import { router as crewAssignmentRoutes } from './crewAssignments';
import { router as dashboardsRoutes } from './dashboards';
import { router as dashboardSummaryRoutes } from './dashboardSummary';
import { router as directoryRoutes } from './directory';
import { router as discordRoutes } from './discord';
import { router as documentsRoutes } from './documents';
import { router as encryptionRoutes } from './encryption';
import { router as equipmentRoutes } from './equipment';
import { router as errorsRoutes } from './errors';
import { router as eventAttendanceRoutes } from './eventAttendance';
import { router as eventConflictsRoutes } from './eventConflicts';
import { router as eventsRoutes } from './events';
import { router as eventWaitlistRoutes } from './eventWaitlist';
import { router as exportRoutes } from './export';
import { router as featureFlagsRoutes } from './featureFlags';
import { router as federationsRoutes } from './federations';
import { router as fleetsRoutes } from './fleets';
import { router as focusRoutes } from './focus';
import { router as gdprRoutes } from './gdpr';
import { router as imagesRoutes } from './images';
import { router as importRoutes } from './import';
import { router as integrationsRoutes } from './integrations';
import { intelRoutes } from './intel';
import { router as inventoryRoutes } from './inventory';
import { router as invitationRoutes } from './invitations';
import { router as jobsRoutes } from './jobs';
import { router as jumppointRoutes } from './jumppoint';
import { router as loadoutsRoutes } from './loadouts';
import { router as logisticsRoutes } from './logistics';
import { router as lootRoutes } from './loot';
import { router as matchmakingRoutes } from './matchmaking';
// messages removed — Discord remains the primary text/voice platform
import { router as membershipIntakeRoutes } from './membershipIntake';
import { router as metricsRoutes } from './metrics';
// Standalone mining disabled — mining remains as activity type
import { router as missionsRoutes } from './missions';
import { router as mobileRoutes } from './mobile';
import { router as moderationRoutes } from './moderation';
import { router as notificationsRoutes } from './notifications';
import { router as organizationsRoutes } from './organizations';
import { router as orgApplicationRoutes } from './orgApplications';
import { router as participationRoutes } from './participation';
import { orgPermissionRoutes, router as permissionsRoutes } from './permissions';
import { router as publicJobListingRoutes } from './publicJobListing';
import { router as publicStatsRoutes } from './publicStats';
import { router as rateLimitsRoutes } from './rateLimits';
import { router as recruitmentRoutes } from './recruitment';
import { router as recurringActivitiesRoutes } from './recurringActivities';
import { router as relationshipsRoutes } from './relationships';
import { router as reportsRoutes } from './reports';
import { router as reputationRoutes } from './reputation';
import { router as roleRequestsRoutes } from './roleRequests';
import { orgRolesRouter, router as rolesRoutes } from './roles';
import { router as rsiRoutes } from './rsi';
import { router as rsiCrawlerRoutes } from './rsiCrawler';
import { router as rsiMemberIntelRoutes } from './rsiMemberIntel';
import { router as rsiRoleMappingRoutes } from './rsiRoleMapping';
import { router as rsiSyncRoutes } from './rsiSync';
import { router as scstatsRoutes } from './scstats';
import { router as searchRoutes } from './search';
import { router as sharedAccountsRoutes } from './sharedAccounts';
import { router as shipLoansRoutes } from './shipLoans';
import { router as shipMaintenanceRoutes } from './shipMaintenance';
import { router as shipsRoutes } from './ships';
import { router as skillsRoutes } from './skills';
import { router as socialRoutes } from './social';
import { router as squadronsRoutes } from './squadrons';
import { router as starCommsRoutes } from './starCommsRoutes';
// subscriptions removed — no billing/monetization plan
import { router as systemRoutes } from './system';
import { router as tagsRoutes } from './tags';
import { router as teamsRoutes } from './teams';
import { router as templatesRoutes } from './templates';
import { router as ticketsRoutes } from './tickets';
import { router as tournamentRoutes } from './tournaments';
import { router as tradingRoutes } from './trading';
import { router as usersRoutes } from './users';
import { voiceServerRouter as voiceServerRoutes } from './voiceServerRoutes';
import { router as votingRoutes } from './voting';
import { router as webauthnRoutes } from './webauthn';
import { router as webhooksRoutes } from './webhooks';
import { router as wikiRoutes } from './wiki';
import { router as workflowsRoutes } from './workflows';

const v2Router = Router();

// Apply v2-specific middleware
v2Router.use(requestIdMiddleware);
v2Router.use(standardResponseMiddleware);
v2Router.use(queryParserMiddleware);
v2Router.use(trackUserActivity); // Track user activity on all v2 routes
v2Router.use(requireOrgMembership); // Validate org membership when org ID is in URL

// CWE-352: CSRF double-submit cookie validation on state-changing requests
// Exempt auth endpoints that use their own authentication mechanisms
const CSRF_EXEMPT_V2_PATHS = new Set([
  '/auth/login',
  '/auth/demo',
  '/auth/discord/callback',
  '/auth/azuread/callback',
  '/auth/logout',
  '/auth/logout-all',
  '/errors/track', // Error tracking should work for unauthenticated users
  '/metrics/web-vitals', // Web Vitals telemetry (no auth required)
  '/webauthn/authenticate/options', // Passkey login — public endpoint, no session yet
  '/webauthn/authenticate/verify', // Passkey login — public endpoint, issues new session
]);
const BOT_INTERNAL_V2_CSRF_EXEMPT_PREFIXES = [
  '/recruitment',
  '/tickets',
  '/alliance-diplomacy',
  '/rsi/role-mapping',
];
const isBotInternalV2CsrfExemptPath = (path: string): boolean =>
  BOT_INTERNAL_V2_CSRF_EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix));
v2Router.use((req, res, next) => {
  // CWE-352: Skip CSRF for Bearer token requests — mirrors the app-level
  // bypass in app.ts (line ~170). API clients authenticate via token, not cookies.
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return next();
  }
  // Skip CSRF for bot internal token requests only on endpoints that use
  // botOrUserAuth to validate BOT_INTERNAL_SECRET.
  if (req.headers['x-bot-internal-token'] && isBotInternalV2CsrfExemptPath(req.path)) {
    return next();
  }
  // Skip CSRF for dev routes (gated by ALLOW_DEV_LOGIN, dev-only)
  if (req.path.startsWith('/dev')) {
    return next();
  }
  if (CSRF_EXEMPT_V2_PATHS.has(req.path)) {
    return next();
  }
  csrfProtection.protect(req, res, next);
});

// Mount v2 routes
// Health check — must be above authenticated routers
v2Router.get('/health', (req, res) => {
  res.success({
    status: 'ok',
    version: '2.0.0',
    features: {
      pagination: 'offset-based',
      sorting: 'field prefix with - for descending',
      filtering: 'filter[field]=value',
      fieldSelection: 'fields=field1,field2',
      hateoasLinks: true,
    },
    timestamp: new Date().toISOString(),
  });
});

// Public/unauthenticated routes MUST come before routers that use router.use(authenticate)
// (ships, loadouts, shipLoans, etc.) — those block unmatched paths with 401.
v2Router.use(authRoutes);
v2Router.use(directoryRoutes); // Public directory routes
v2Router.use(publicJobListingRoutes);
v2Router.use(publicStatsRoutes); // Public platform stats
v2Router.use('/bot', botCommandsRoutes); // Public bot command documentation
v2Router.use(errorsRoutes); // Error tracking (no auth required)
v2Router.use('/metrics', metricsRoutes); // Web Vitals telemetry (no auth required)
v2Router.use('/search', searchRoutes); // Public opportunity search (no auth required)
v2Router.use('/webauthn', webauthnRoutes); // Passkey login — public endpoints must be before routers with router.use(authenticate)
v2Router.use('/mobile', mobileRoutes); // Public APK download proxy endpoint

// Mount bot-facing routes before path-less authenticated routers.
// This prevents unrelated authenticate middleware in path-less routers from
// intercepting bot traffic with 401 responses.
v2Router.use('/alliance-diplomacy', allianceDiplomacyRoutes);
v2Router.use('/tickets', ticketsRoutes);
v2Router.use('/recruitment', recruitmentRoutes);
v2Router.use('/rsi/role-mapping', rsiRoleMappingRoutes);

v2Router.use(organizationsRoutes);
v2Router.use(orgApplicationRoutes);
v2Router.use(invitationRoutes);
v2Router.use(membershipIntakeRoutes);
v2Router.use(fleetsRoutes);
v2Router.use(shipsRoutes);
v2Router.use(loadoutsRoutes);
v2Router.use(shipLoansRoutes);
v2Router.use(shipMaintenanceRoutes);
v2Router.use(eventConflictsRoutes);
v2Router.use(eventAttendanceRoutes);
v2Router.use(eventWaitlistRoutes);
v2Router.use(activitiesRoutes);
v2Router.use(availabilityRoutes);
v2Router.use(recurringActivitiesRoutes);
v2Router.use(tradingRoutes);
v2Router.use(inventoryRoutes);
v2Router.use(usersRoutes);
v2Router.use(intelRoutes); // V2 intel vault, entries, officers, audit logs

// Audit flags, watchlist, and member profile — real implementations
v2Router.use(memberAuditRouter);
// Standalone mining disabled — mining remains as activity type
v2Router.use('/tournaments', tournamentRoutes);
v2Router.use('/matchmaking', matchmakingRoutes);
v2Router.use('/bounties', bountiesRoutes);
v2Router.use('/briefings', briefingsRoutes);
v2Router.use('/feature-flags', featureFlagsRoutes);
v2Router.use(focusRoutes);
v2Router.use('/squadrons', squadronsRoutes);
v2Router.use('/participation', participationRoutes);
v2Router.use('/permissions', permissionsRoutes);
v2Router.use(orgPermissionRoutes); // Org-scoped permission routes at /organizations/:orgId/users/:userId/permissions
v2Router.use('/role-requests', roleRequestsRoutes);
v2Router.use('/roles', rolesRoutes);
v2Router.use(orgRolesRouter); // Org-scoped role routes at /organizations/:orgId/roles
v2Router.use(encryptionRoutes); // Organization encryption (uses /organizations/:id/encryption paths)
v2Router.use('/admin', adminRoutes);
v2Router.use('/discord', discordRoutes);
v2Router.use('/reputation', reputationRoutes);
v2Router.use('/rsi', rsiRoutes);
v2Router.use('/rsi-crawler', rsiCrawlerRoutes);
v2Router.use('/scstats', scstatsRoutes);

// CAS (Composite Activity Score)
v2Router.use(casRoutes);

// Voice Server (Mumble, TeamSpeak, etc.)
v2Router.use(voiceServerRoutes);

v2Router.use('/rsi/members/:orgId/intel', rsiMemberIntelRoutes);
v2Router.use('/rsi/sync', rsiSyncRoutes);
v2Router.use('/contact-requests', contactRequestsRoutes);
v2Router.use('/federations', federationsRoutes);
v2Router.use('/logistics', logisticsRoutes);
v2Router.use('/jobs', jobsRoutes);
v2Router.use('/shared-accounts', sharedAccountsRoutes);
v2Router.use('/jumppoints', jumppointRoutes);
v2Router.use('/2fa', twoFactorRoutes);
v2Router.use('/events', eventsRoutes);
v2Router.use('/gdpr', gdprRoutes);
v2Router.use('/images', imagesRoutes);
v2Router.use('/notifications', notificationsRoutes);
v2Router.use('/claims', claimsRoutes);
// subscriptions mount removed
v2Router.use('/analytics', analyticsRoutes);
v2Router.use('/audit', auditRoutes);
v2Router.use('/webhooks', webhooksRoutes);
v2Router.use('/moderation', moderationRoutes);
v2Router.use('/achievements', achievementsRoutes);
v2Router.use('/announcements', announcementsRoutes);
v2Router.use('/api-keys', apiKeysRoutes);
v2Router.use('/approvals', approvalsRoutes);
v2Router.use('/archives', archivesRoutes);
v2Router.use('/backup', backupRoutes);
v2Router.use('/calendar', calendarRoutes);
v2Router.use('/certifications', certificationsRoutes);
// combat mount removed
v2Router.use('/comments', commentsRoutes);
v2Router.use('/config', configRoutes);
v2Router.use('/crew-assignments', crewAssignmentRoutes);
v2Router.use('/credits', creditsRoutes);
v2Router.use('/loot', lootRoutes);
v2Router.use('/dashboards', dashboardsRoutes);
v2Router.use('/dashboard', dashboardSummaryRoutes);
v2Router.use('/documents', documentsRoutes);
v2Router.use('/equipment', equipmentRoutes);
v2Router.use('/export', exportRoutes);
v2Router.use('/import', importRoutes);
v2Router.use('/integrations', integrationsRoutes);
v2Router.use(starCommsRoutes);
// messages mount removed
v2Router.use('/missions', missionsRoutes);
v2Router.use('/rate-limits', rateLimitsRoutes);
v2Router.use('/reports', reportsRoutes);
v2Router.use('/skills', skillsRoutes);
v2Router.use('/relationships', relationshipsRoutes);
v2Router.use('/social', socialRoutes);
v2Router.use('/system', systemRoutes);
v2Router.use('/tags', tagsRoutes);
v2Router.use(teamsRoutes);
v2Router.use('/templates', templatesRoutes);
v2Router.use('/voting', votingRoutes);
v2Router.use('/wiki', wikiRoutes);
v2Router.use('/workflows', workflowsRoutes);

// Apply error handler last
v2Router.use(errorHandlerV2);

export { v2Router };
