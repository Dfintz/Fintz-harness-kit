"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v2Router = void 0;
const express_1 = require("express");
const activityTracking_1 = require("../../middleware/activityTracking");
const csrf_1 = require("../../middleware/csrf");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const orgMembership_1 = require("../../middleware/orgMembership");
const queryParser_1 = require("../../middleware/queryParser");
const requestId_1 = require("../../middleware/requestId");
const standardResponse_1 = require("../../middleware/standardResponse");
const memberAuditRoutes_1 = require("../memberAuditRoutes");
const _2fa_1 = require("./2fa");
const achievements_1 = require("./achievements");
const activities_1 = require("./activities");
const admin_1 = require("./admin");
const allianceDiplomacy_1 = require("./allianceDiplomacy");
const analytics_1 = require("./analytics");
const announcements_1 = require("./announcements");
const apiKeys_1 = require("./apiKeys");
const approvals_1 = require("./approvals");
const archives_1 = require("./archives");
const audit_1 = require("./audit");
const auth_1 = require("./auth");
const availability_1 = require("./availability");
const backup_1 = require("./backup");
const botCommands_1 = require("./botCommands");
const bounties_1 = require("./bounties");
const briefings_1 = require("./briefings");
const calendar_1 = require("./calendar");
const casRoutes_1 = require("./casRoutes");
const certifications_1 = require("./certifications");
const claims_1 = require("./claims");
const comments_1 = require("./comments");
const config_1 = require("./config");
const contactRequests_1 = require("./contactRequests");
const credits_1 = require("./credits");
const crewAssignments_1 = require("./crewAssignments");
const dashboards_1 = require("./dashboards");
const dashboardSummary_1 = require("./dashboardSummary");
const directory_1 = require("./directory");
const discord_1 = require("./discord");
const documents_1 = require("./documents");
const encryption_1 = require("./encryption");
const equipment_1 = require("./equipment");
const errors_1 = require("./errors");
const eventAttendance_1 = require("./eventAttendance");
const eventConflicts_1 = require("./eventConflicts");
const events_1 = require("./events");
const eventWaitlist_1 = require("./eventWaitlist");
const export_1 = require("./export");
const featureFlags_1 = require("./featureFlags");
const federations_1 = require("./federations");
const fleets_1 = require("./fleets");
const focus_1 = require("./focus");
const gdpr_1 = require("./gdpr");
const images_1 = require("./images");
const import_1 = require("./import");
const integrations_1 = require("./integrations");
const intel_1 = require("./intel");
const inventory_1 = require("./inventory");
const invitations_1 = require("./invitations");
const jobs_1 = require("./jobs");
const jumppoint_1 = require("./jumppoint");
const loadouts_1 = require("./loadouts");
const logistics_1 = require("./logistics");
const loot_1 = require("./loot");
const matchmaking_1 = require("./matchmaking");
const membershipIntake_1 = require("./membershipIntake");
const metrics_1 = require("./metrics");
const missions_1 = require("./missions");
const mobile_1 = require("./mobile");
const moderation_1 = require("./moderation");
const notifications_1 = require("./notifications");
const organizations_1 = require("./organizations");
const orgApplications_1 = require("./orgApplications");
const participation_1 = require("./participation");
const permissions_1 = require("./permissions");
const publicJobListing_1 = require("./publicJobListing");
const publicStats_1 = require("./publicStats");
const rateLimits_1 = require("./rateLimits");
const recruitment_1 = require("./recruitment");
const recurringActivities_1 = require("./recurringActivities");
const relationships_1 = require("./relationships");
const reports_1 = require("./reports");
const reputation_1 = require("./reputation");
const roleRequests_1 = require("./roleRequests");
const roles_1 = require("./roles");
const rsi_1 = require("./rsi");
const rsiCrawler_1 = require("./rsiCrawler");
const rsiMemberIntel_1 = require("./rsiMemberIntel");
const rsiRoleMapping_1 = require("./rsiRoleMapping");
const rsiSync_1 = require("./rsiSync");
const scstats_1 = require("./scstats");
const search_1 = require("./search");
const sharedAccounts_1 = require("./sharedAccounts");
const shipLoans_1 = require("./shipLoans");
const shipMaintenance_1 = require("./shipMaintenance");
const ships_1 = require("./ships");
const skills_1 = require("./skills");
const social_1 = require("./social");
const squadrons_1 = require("./squadrons");
const starCommsRoutes_1 = require("./starCommsRoutes");
const system_1 = require("./system");
const tags_1 = require("./tags");
const teams_1 = require("./teams");
const templates_1 = require("./templates");
const tickets_1 = require("./tickets");
const tournaments_1 = require("./tournaments");
const trading_1 = require("./trading");
const users_1 = require("./users");
const voiceServerRoutes_1 = require("./voiceServerRoutes");
const voting_1 = require("./voting");
const webauthn_1 = require("./webauthn");
const webhooks_1 = require("./webhooks");
const wiki_1 = require("./wiki");
const workflows_1 = require("./workflows");
const v2Router = (0, express_1.Router)();
exports.v2Router = v2Router;
v2Router.use(requestId_1.requestIdMiddleware);
v2Router.use(standardResponse_1.standardResponseMiddleware);
v2Router.use(queryParser_1.queryParserMiddleware);
v2Router.use(activityTracking_1.trackUserActivity);
v2Router.use(orgMembership_1.requireOrgMembership);
const CSRF_EXEMPT_V2_PATHS = new Set([
    '/auth/login',
    '/auth/demo',
    '/auth/discord/callback',
    '/auth/azuread/callback',
    '/auth/logout',
    '/auth/logout-all',
    '/errors/track',
    '/metrics/web-vitals',
    '/webauthn/authenticate/options',
    '/webauthn/authenticate/verify',
]);
const BOT_INTERNAL_V2_CSRF_EXEMPT_PREFIXES = [
    '/recruitment',
    '/tickets',
    '/alliance-diplomacy',
    '/rsi/role-mapping',
];
const isBotInternalV2CsrfExemptPath = (path) => BOT_INTERNAL_V2_CSRF_EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix));
v2Router.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return next();
    }
    if (req.headers['x-bot-internal-token'] && isBotInternalV2CsrfExemptPath(req.path)) {
        return next();
    }
    if (req.path.startsWith('/dev')) {
        return next();
    }
    if (CSRF_EXEMPT_V2_PATHS.has(req.path)) {
        return next();
    }
    csrf_1.csrfProtection.protect(req, res, next);
});
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
v2Router.use(auth_1.router);
v2Router.use(directory_1.router);
v2Router.use(publicJobListing_1.router);
v2Router.use(publicStats_1.router);
v2Router.use('/bot', botCommands_1.router);
v2Router.use(errors_1.router);
v2Router.use('/metrics', metrics_1.router);
v2Router.use('/search', search_1.router);
v2Router.use('/webauthn', webauthn_1.router);
v2Router.use('/mobile', mobile_1.router);
v2Router.use('/alliance-diplomacy', allianceDiplomacy_1.router);
v2Router.use('/tickets', tickets_1.router);
v2Router.use('/recruitment', recruitment_1.router);
v2Router.use('/rsi/role-mapping', rsiRoleMapping_1.router);
v2Router.use(organizations_1.router);
v2Router.use(orgApplications_1.router);
v2Router.use(invitations_1.router);
v2Router.use(membershipIntake_1.router);
v2Router.use(fleets_1.router);
v2Router.use(ships_1.router);
v2Router.use(loadouts_1.router);
v2Router.use(shipLoans_1.router);
v2Router.use(shipMaintenance_1.router);
v2Router.use(eventConflicts_1.router);
v2Router.use(eventAttendance_1.router);
v2Router.use(eventWaitlist_1.router);
v2Router.use(activities_1.router);
v2Router.use(availability_1.router);
v2Router.use(recurringActivities_1.router);
v2Router.use(trading_1.router);
v2Router.use(inventory_1.router);
v2Router.use(users_1.router);
v2Router.use(intel_1.intelRoutes);
v2Router.use(memberAuditRoutes_1.memberAuditRouter);
v2Router.use('/tournaments', tournaments_1.router);
v2Router.use('/matchmaking', matchmaking_1.router);
v2Router.use('/bounties', bounties_1.router);
v2Router.use('/briefings', briefings_1.router);
v2Router.use('/feature-flags', featureFlags_1.router);
v2Router.use(focus_1.router);
v2Router.use('/squadrons', squadrons_1.router);
v2Router.use('/participation', participation_1.router);
v2Router.use('/permissions', permissions_1.router);
v2Router.use(permissions_1.orgPermissionRoutes);
v2Router.use('/role-requests', roleRequests_1.router);
v2Router.use('/roles', roles_1.router);
v2Router.use(roles_1.orgRolesRouter);
v2Router.use(encryption_1.router);
v2Router.use('/admin', admin_1.router);
v2Router.use('/discord', discord_1.router);
v2Router.use('/reputation', reputation_1.router);
v2Router.use('/rsi', rsi_1.router);
v2Router.use('/rsi-crawler', rsiCrawler_1.router);
v2Router.use('/scstats', scstats_1.router);
v2Router.use(casRoutes_1.casRoutes);
v2Router.use(voiceServerRoutes_1.voiceServerRouter);
v2Router.use('/rsi/members/:orgId/intel', rsiMemberIntel_1.router);
v2Router.use('/rsi/sync', rsiSync_1.router);
v2Router.use('/contact-requests', contactRequests_1.router);
v2Router.use('/federations', federations_1.router);
v2Router.use('/logistics', logistics_1.router);
v2Router.use('/jobs', jobs_1.router);
v2Router.use('/shared-accounts', sharedAccounts_1.router);
v2Router.use('/jumppoints', jumppoint_1.router);
v2Router.use('/2fa', _2fa_1.router);
v2Router.use('/events', events_1.router);
v2Router.use('/gdpr', gdpr_1.router);
v2Router.use('/images', images_1.router);
v2Router.use('/notifications', notifications_1.router);
v2Router.use('/claims', claims_1.router);
v2Router.use('/analytics', analytics_1.router);
v2Router.use('/audit', audit_1.router);
v2Router.use('/webhooks', webhooks_1.router);
v2Router.use('/moderation', moderation_1.router);
v2Router.use('/achievements', achievements_1.router);
v2Router.use('/announcements', announcements_1.router);
v2Router.use('/api-keys', apiKeys_1.router);
v2Router.use('/approvals', approvals_1.router);
v2Router.use('/archives', archives_1.router);
v2Router.use('/backup', backup_1.router);
v2Router.use('/calendar', calendar_1.router);
v2Router.use('/certifications', certifications_1.router);
v2Router.use('/comments', comments_1.router);
v2Router.use('/config', config_1.router);
v2Router.use('/crew-assignments', crewAssignments_1.router);
v2Router.use('/credits', credits_1.router);
v2Router.use('/loot', loot_1.router);
v2Router.use('/dashboards', dashboards_1.router);
v2Router.use('/dashboard', dashboardSummary_1.router);
v2Router.use('/documents', documents_1.router);
v2Router.use('/equipment', equipment_1.router);
v2Router.use('/export', export_1.router);
v2Router.use('/import', import_1.router);
v2Router.use('/integrations', integrations_1.router);
v2Router.use(starCommsRoutes_1.router);
v2Router.use('/missions', missions_1.router);
v2Router.use('/rate-limits', rateLimits_1.router);
v2Router.use('/reports', reports_1.router);
v2Router.use('/skills', skills_1.router);
v2Router.use('/relationships', relationships_1.router);
v2Router.use('/social', social_1.router);
v2Router.use('/system', system_1.router);
v2Router.use('/tags', tags_1.router);
v2Router.use(teams_1.router);
v2Router.use('/templates', templates_1.router);
v2Router.use('/voting', voting_1.router);
v2Router.use('/wiki', wiki_1.router);
v2Router.use('/workflows', workflows_1.router);
v2Router.use(errorHandlerV2_1.errorHandlerV2);
//# sourceMappingURL=index.js.map