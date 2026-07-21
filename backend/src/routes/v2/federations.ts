import { Router } from 'express';

import { FederationController } from '../../controllers/federationController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { tenantContextMiddleware } from '../../middleware/tenantContext';
import { discordSettingsSchemas } from '../../schemas/discordSchemas';
import { federationSchemas } from '../../schemas/federationSchemas';

const router = Router();

// Lazy controller init to avoid EntityMetadataNotFoundError at import time
let federationController: FederationController;
const getController = () => {
  if (!federationController) {
    federationController = new FederationController();
  }
  return federationController;
};

// ─── Public Directory (no auth required) ───────────────────────
router.get('/public/stats', (req, res) => getController().publicStats(req, res));

router.get(
  '/public/:id',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().publicGet(req, res)
);

router.get('/public', validateSchema(federationSchemas.publicDirectoryQuery, 'query'), (req, res) =>
  getController().publicList(req, res)
);

// ─── Public Federation Application Mode (no auth required) ─────
router.get(
  '/:id/application-mode',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getFederationApplicationMode(req, res)
);

// ─── Authenticated routes ──────────────────────────────────────
router.use(authenticate);
router.use(tenantContextMiddleware);

// ── Federation CRUD ────────────────────────────────────────────
router.get('/search', validateSchema(federationSchemas.searchQuery, 'query'), (req, res) =>
  getController().search(req, res)
);

// Resolve a federation slug to its ID (authenticated)
router.get(
  '/resolve-slug/:slug',
  validateSchema(federationSchemas.slugParam, 'params'),
  (req, res) => getController().resolveSlug(req, res)
);

router.get('/', validateSchema(federationSchemas.listQuery, 'query'), (req, res) =>
  getController().list(req, res)
);

router.post(
  '/',
  authenticate,
  tenantContextMiddleware,
  validateSchema(federationSchemas.create, 'body'),
  (req, res) => getController().create(req, res)
);

router.get('/:id', validateSchema(federationSchemas.federationIdParam, 'params'), (req, res) =>
  getController().getById(req, res)
);

router.delete('/:id', validateSchema(federationSchemas.federationIdParam, 'params'), (req, res) =>
  getController().disband(req, res)
);

router.put(
  '/:id',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);

router.put(
  '/:id/activate',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().activate(req, res)
);

// ── Chairman / Succession ──────────────────────────────────────
router.put(
  '/:id/succession-mode',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().updateSuccessionMode(req, res)
);

router.post(
  '/:id/succeed-chairman',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().succeedChairman(req, res)
);

// ── Member Management ──────────────────────────────────────────
router.post(
  '/:id/members/invite',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.inviteMember, 'body'),
  (req, res) => getController().inviteMember(req, res)
);

router.post(
  '/:id/members/accept',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().acceptInvitation(req, res)
);

router.delete(
  '/:id/members/:memberId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.memberIdParam, 'params'),
  (req, res) => getController().removeMember(req, res)
);

router.put(
  '/:id/members/:memberId/role',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.memberIdParam, 'params'),
  validateSchema(federationSchemas.updateMemberRole, 'body'),
  (req, res) => getController().updateMemberRole(req, res)
);

// ── Proposals & Voting ─────────────────────────────────────────
router.get(
  '/:id/proposals',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.proposalListQuery, 'query'),
  (req, res) => getController().listProposals(req, res)
);

router.post(
  '/:id/proposals',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.createProposal, 'body'),
  (req, res) => getController().createProposal(req, res)
);

router.get(
  '/:id/proposals/:proposalId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.proposalIdParam, 'params'),
  (req, res) => getController().getProposal(req, res)
);

router.post(
  '/:id/proposals/:proposalId/vote',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.proposalIdParam, 'params'),
  validateSchema(federationSchemas.castVote, 'body'),
  (req, res) => getController().castVote(req, res)
);

// ── Shared Resources ──────────────────────────────────────────
router.post(
  '/:id/resources',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.addResource, 'body'),
  (req, res) => getController().addResource(req, res)
);

router.delete(
  '/:id/resources/:resourceId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.resourceIdParam, 'params'),
  (req, res) => getController().removeResource(req, res)
);

// ── Treaties ──────────────────────────────────────────────────
router.post(
  '/:id/treaties',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.createTreaty, 'body'),
  (req, res) => getController().createTreaty(req, res)
);

router.delete(
  '/:id/treaties/:treatyId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.treatyIdParam, 'params'),
  (req, res) => getController().terminateTreaty(req, res)
);

router.post(
  '/:id/treaties/:treatyId/respond',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.treatyIdParam, 'params'),
  validateSchema(federationSchemas.respondToTreaty, 'body'),
  (req, res) => getController().respondToTreaty(req, res)
);

// ── Analytics ─────────────────────────────────────────────────
router.get(
  '/:id/stats',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getStats(req, res)
);

router.get(
  '/:id/contributions',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getContributions(req, res)
);

// ── Settings ──────────────────────────────────────────────────
router.get(
  '/:id/settings',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getSettings(req, res)
);

router.put(
  '/:id/settings',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.updateSettings, 'body'),
  (req, res) => getController().updateSettings(req, res)
);

// ── Federation Fleets & Units ─────────────────────────────────
router.get(
  '/:id/fleets',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationFleets(req, res)
);

router.get(
  '/:id/units',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationUnits(req, res)
);
// ── Ambassadors ───────────────────────────────────────────────

// "me" must come before ":ambId" to avoid param collision
router.get(
  '/:id/ambassadors/me',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getMyAmbassadorProfile(req, res)
);

router.get(
  '/:id/ambassadors',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listAmbassadors(req, res)
);

router.post(
  '/:id/ambassadors',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.appointAmbassador, 'body'),
  (req, res) => getController().appointAmbassador(req, res)
);

router.put(
  '/:id/ambassadors/:ambId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.ambassadorIdParam, 'params'),
  validateSchema(federationSchemas.updateAmbassador, 'body'),
  (req, res) => getController().updateAmbassador(req, res)
);

router.delete(
  '/:id/ambassadors/:ambId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.ambassadorIdParam, 'params'),
  (req, res) => getController().removeAmbassador(req, res)
);

// ── Federation Wiki ───────────────────────────────────────────

router.get(
  '/:id/wiki/tree',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getWikiTree(req, res)
);

router.get(
  '/:id/wiki/:pageId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.wikiPageIdParam, 'params'),
  (req, res) => getController().getWikiPage(req, res)
);

router.get('/:id/wiki', validateSchema(federationSchemas.federationIdParam, 'params'), (req, res) =>
  getController().listWikiPages(req, res)
);

router.post(
  '/:id/wiki',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.createWikiPage, 'body'),
  (req, res) => getController().createWikiPage(req, res)
);

router.put(
  '/:id/wiki/:pageId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.wikiPageIdParam, 'params'),
  validateSchema(federationSchemas.updateWikiPage, 'body'),
  (req, res) => getController().updateWikiPage(req, res)
);

router.delete(
  '/:id/wiki/:pageId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.wikiPageIdParam, 'params'),
  (req, res) => getController().deleteWikiPage(req, res)
);

// ── Federation Announcements ──────────────────────────────────

router.get(
  '/:id/announcements',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationAnnouncements(req, res)
);

router.post(
  '/:id/announcements',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.createFederationAnnouncement, 'body'),
  (req, res) => getController().createFederationAnnouncement(req, res)
);

router.delete(
  '/:id/announcements/:announcementId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.announcementIdParam, 'params'),
  (req, res) => getController().deleteFederationAnnouncement(req, res)
);

router.put(
  '/:id/announcements/:announcementId/pin',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.announcementIdParam, 'params'),
  (req, res) => getController().toggleAnnouncementPin(req, res)
);

router.post(
  '/:id/announcements/:announcementId/post',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.announcementIdParam, 'params'),
  validateSchema(federationSchemas.postFederationAnnouncementToDiscord, 'body'),
  (req, res) => getController().postFederationAnnouncementToDiscord(req, res)
);

// ── Federation Polls ──────────────────────────────────────────

router.get(
  '/:id/polls',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationPolls(req, res)
);

router.post(
  '/:id/polls',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.createFederationPoll, 'body'),
  (req, res) => getController().createFederationPoll(req, res)
);

router.post(
  '/:id/polls/:pollId/vote',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.pollIdParam, 'params'),
  validateSchema(federationSchemas.castFederationVote, 'body'),
  (req, res) => getController().castFederationVote(req, res)
);

router.get(
  '/:id/polls/:pollId/results',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.pollIdParam, 'params'),
  (req, res) => getController().getFederationPollResults(req, res)
);

router.put(
  '/:id/polls/:pollId/close',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.pollIdParam, 'params'),
  (req, res) => getController().closeFederationPoll(req, res)
);

router.delete(
  '/:id/polls/:pollId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.pollIdParam, 'params'),
  (req, res) => getController().deleteFederationPoll(req, res)
);

router.post(
  '/:id/polls/:pollId/post',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.pollIdParam, 'params'),
  validateSchema(federationSchemas.postFederationPollToDiscord, 'body'),
  (req, res) => getController().postFederationPollToDiscord(req, res)
);

// ── Federation Teams ──────────────────────────────────────────

router.get(
  '/:id/teams',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationTeams(req, res)
);

router.get(
  '/:id/teams/:teamId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.teamIdParam, 'params'),
  (req, res) => getController().getFederationTeam(req, res)
);

router.post(
  '/:id/teams',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.createFederationTeam, 'body'),
  (req, res) => getController().createFederationTeam(req, res)
);

router.put(
  '/:id/teams/:teamId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.teamIdParam, 'params'),
  validateSchema(federationSchemas.updateFederationTeam, 'body'),
  (req, res) => getController().updateFederationTeam(req, res)
);

router.post(
  '/:id/teams/:teamId/members',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.teamIdParam, 'params'),
  validateSchema(federationSchemas.addTeamMember, 'body'),
  (req, res) => getController().addFederationTeamMember(req, res)
);

router.delete(
  '/:id/teams/:teamId/members/:memberUserId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.teamIdParam, 'params'),
  validateSchema(federationSchemas.memberUserIdParam, 'params'),
  (req, res) => getController().removeFederationTeamMember(req, res)
);

router.delete(
  '/:id/teams/:teamId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.teamIdParam, 'params'),
  (req, res) => getController().deleteFederationTeam(req, res)
);

// ── Federation Intel ──────────────────────────────────────────

router.get(
  '/:id/intel',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationIntel(req, res)
);

router.get(
  '/:id/intel/:intelId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.intelIdParam, 'params'),
  (req, res) => getController().getFederationIntel(req, res)
);

router.post(
  '/:id/intel',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.submitFederationIntel, 'body'),
  (req, res) => getController().submitFederationIntel(req, res)
);

router.put(
  '/:id/intel/:intelId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.intelIdParam, 'params'),
  validateSchema(federationSchemas.updateFederationIntel, 'body'),
  (req, res) => getController().updateFederationIntel(req, res)
);

router.put(
  '/:id/intel/:intelId/approve',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.intelIdParam, 'params'),
  (req, res) => getController().approveFederationIntel(req, res)
);

router.put(
  '/:id/intel/:intelId/archive',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.intelIdParam, 'params'),
  (req, res) => getController().archiveFederationIntel(req, res)
);

router.delete(
  '/:id/intel/:intelId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.intelIdParam, 'params'),
  (req, res) => getController().deleteFederationIntel(req, res)
);

// ── Federation Personnel ──────────────────────────────────────

router.get(
  '/:id/personnel',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationPersonnel(req, res)
);

router.get(
  '/:id/personnel/summary',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getFederationPersonnelSummary(req, res)
);

// ── Federation Applications ───────────────────────────────────

router.post(
  '/:id/applications',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.submitFederationApplication, 'body'),
  (req, res) => getController().submitFederationApplication(req, res)
);

router.get(
  '/:id/applications',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().listFederationApplications(req, res)
);

router.put(
  '/:id/applications/:appId/review',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.appIdParam, 'params'),
  validateSchema(federationSchemas.reviewFederationApplication, 'body'),
  (req, res) => getController().reviewFederationApplication(req, res)
);

router.delete(
  '/:id/applications/:appId',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.appIdParam, 'params'),
  (req, res) => getController().withdrawFederationApplication(req, res)
);

// ── Federation Discord Management ─────────────────────────────

router.get(
  '/:id/discord/status',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getFederationDiscordStatus(req, res)
);

router.post(
  '/:id/discord/setup',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.setupFederationDiscord, 'body'),
  (req, res) => getController().setupFederationDiscord(req, res)
);

router.delete(
  '/:id/discord',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().unlinkFederationDiscord(req, res)
);

router.get(
  '/:id/discord/conflicts',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getFederationDiscordConflicts(req, res)
);

router.post(
  '/:id/discord/conflicts/:discordUserId/resolve',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.resolveDiscordConflict, 'body'),
  (req, res) => getController().resolveFederationDiscordConflict(req, res)
);

router.post(
  '/:id/discord/sync-user',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  validateSchema(federationSchemas.syncDiscordUser, 'body'),
  (req, res) => getController().syncFederationDiscordUser(req, res)
);

// ── Federation Discord Guild Settings ─────────────────────────

// List all guild settings for the federation
router.get(
  '/:id/discord/guild-settings',
  validateSchema(federationSchemas.federationIdParam, 'params'),
  (req, res) => getController().getFederationGuildSettingsList(req, res)
);

// Get settings for a specific guild
router.get(
  '/:id/discord/guild-settings/:guildId',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  (req, res) => getController().getFederationGuildSettings(req, res)
);

// Per-section PATCH endpoints
router.patch(
  '/:id/discord/guild-settings/:guildId/event-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.eventSettings, 'body'),
  (req, res) => getController().updateFederationEventSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/voice-channel-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.voiceChannelSettings, 'body'),
  (req, res) => getController().updateFederationVoiceChannelSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/tunnel-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.tunnelSettings, 'body'),
  (req, res) => getController().updateFederationTunnelSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/notification-preferences',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.notificationPreferences, 'body'),
  (req, res) => getController().updateFederationNotificationPreferences(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/role-sync-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.roleSyncSettings, 'body'),
  (req, res) => getController().updateFederationRoleSyncSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/cross-moderation-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.crossModerationSettings, 'body'),
  (req, res) => getController().updateFederationCrossModerationSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/ticket-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.ticketSettings, 'body'),
  (req, res) => getController().updateFederationTicketSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/team-voice-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.teamVoiceSettings, 'body'),
  (req, res) => getController().updateFederationTeamVoiceSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/lfg-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.lfgSettings, 'body'),
  (req, res) => getController().updateFederationLfgSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/recruitment-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.recruitmentSettings, 'body'),
  (req, res) => getController().updateFederationRecruitmentSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/welcome-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.welcomeSettings, 'body'),
  (req, res) => getController().updateFederationWelcomeSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/audit-log-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.auditLogSettings, 'body'),
  (req, res) => getController().updateFederationAuditLogSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/stat-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.statSettings, 'body'),
  (req, res) => getController().updateFederationStatSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/dm-notification-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.dmNotificationSettings, 'body'),
  (req, res) => getController().updateFederationDmNotificationSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/smart-lfg-ping-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.smartLfgPingSettings, 'body'),
  (req, res) => getController().updateFederationSmartLfgPingSettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/giveaway-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.giveawaySettings, 'body'),
  (req, res) => getController().updateFederationGiveawaySettings(req, res)
);

router.patch(
  '/:id/discord/guild-settings/:guildId/advanced-event-settings',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.advancedEventSettings, 'body'),
  (req, res) => getController().updateFederationAdvancedEventSettings(req, res)
);

router.post(
  '/:id/discord/guild-settings/:guildId/starcomms-managers',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  validateSchema(discordSettingsSchemas.starCommsManagerManagement, 'body'),
  (req, res) => getController().addFederationStarCommsManagerRole(req, res)
);

router.delete(
  '/:id/discord/guild-settings/:guildId/starcomms-managers/:roleId',
  validateSchema(federationSchemas.guildIdParam, 'params'),
  (req, res) => getController().removeFederationStarCommsManagerRole(req, res)
);

export { router };
