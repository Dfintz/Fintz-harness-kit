"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarCommsContextSyncService = void 0;
const applicationInsights_1 = require("../../../config/applicationInsights");
const data_source_1 = require("../../../data-source");
const ExternalIntegration_1 = require("../../../models/ExternalIntegration");
const Organization_1 = require("../../../models/Organization");
const logger_1 = require("../../../utils/logger");
const external_1 = require("../../external");
const FleetService_1 = require("../../fleet/FleetService");
const StarCommsAdapter_1 = require("./StarCommsAdapter");
class StarCommsContextSyncService {
    static BRIEFING_SYNC_SUCCESS_METRIC = 'starcomms.briefing.sync.success_total';
    static BRIEFING_SYNC_SKIPPED_METRIC = 'starcomms.briefing.sync.skipped_total';
    static BRIEFING_SYNC_FAILED_METRIC = 'starcomms.briefing.sync.failed_total';
    static TEAM_SYNC_SUCCESS_METRIC = 'starcomms.team.sync.success_total';
    static TEAM_SYNC_SKIPPED_METRIC = 'starcomms.team.sync.skipped_total';
    static TEAM_SYNC_FAILED_METRIC = 'starcomms.team.sync.failed_total';
    organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    fleetService = new FleetService_1.FleetService();
    integrationService = new external_1.ExternalIntegrationService();
    starCommsAdapter = new StarCommsAdapter_1.StarCommsAdapter();
    async syncBriefingContext(payload) {
        const enabled = await this.isFlagEnabled(payload.organizationId, 'enableBriefingSync');
        if (!enabled) {
            this.trackSyncMetric(StarCommsContextSyncService.BRIEFING_SYNC_SKIPPED_METRIC);
            return;
        }
        const integration = await this.findStarCommsIntegration(payload.organizationId);
        if (!integration) {
            this.trackSyncMetric(StarCommsContextSyncService.BRIEFING_SYNC_SKIPPED_METRIC);
            logger_1.logger.debug('StarComms briefing sync skipped: no integration configured', {
                organizationId: payload.organizationId,
                briefingId: payload.briefingId,
            });
            return;
        }
        try {
            const config = this.starCommsAdapter.buildConnectionConfig(integration);
            await this.starCommsAdapter.ensureOperationFromActivity(config, {
                activityId: payload.briefingId,
                organizationId: payload.organizationId,
                title: payload.title,
                classification: payload.classification,
                status: payload.status,
                missionId: payload.missionId,
                operationIds: payload.operationIds,
                source: 'briefing',
            });
            this.trackSyncMetric(StarCommsContextSyncService.BRIEFING_SYNC_SUCCESS_METRIC);
        }
        catch (error) {
            this.trackSyncMetric(StarCommsContextSyncService.BRIEFING_SYNC_FAILED_METRIC);
            logger_1.logger.warn('StarComms briefing sync failed', {
                organizationId: payload.organizationId,
                briefingId: payload.briefingId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async syncTeamContext(payload) {
        const enabled = await this.isFlagEnabled(payload.organizationId, 'enableTeamSync');
        if (!enabled) {
            this.trackSyncMetric(StarCommsContextSyncService.TEAM_SYNC_SKIPPED_METRIC);
            return;
        }
        const integration = await this.findStarCommsIntegration(payload.organizationId);
        if (!integration) {
            this.trackSyncMetric(StarCommsContextSyncService.TEAM_SYNC_SKIPPED_METRIC);
            logger_1.logger.debug('StarComms team sync skipped: no integration configured', {
                organizationId: payload.organizationId,
                teamId: payload.teamId,
            });
            return;
        }
        try {
            const config = this.starCommsAdapter.buildConnectionConfig(integration);
            await this.starCommsAdapter.syncAssignments(config, {
                activityId: payload.teamId,
                assignments: [
                    {
                        userId: payload.teamId,
                        userName: payload.teamName,
                        role: payload.teamType ?? 'team',
                        shipId: undefined,
                        shipName: undefined,
                        crewPosition: payload.action,
                    },
                ],
                source: 'team',
                action: payload.action,
            });
            this.trackSyncMetric(StarCommsContextSyncService.TEAM_SYNC_SUCCESS_METRIC);
        }
        catch (error) {
            this.trackSyncMetric(StarCommsContextSyncService.TEAM_SYNC_FAILED_METRIC);
            logger_1.logger.warn('StarComms team sync failed', {
                organizationId: payload.organizationId,
                teamId: payload.teamId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    trackSyncMetric(metricName) {
        (0, applicationInsights_1.trackMetric)(metricName, 1);
    }
    async isFlagEnabled(organizationId, flag) {
        const org = await this.organizationRepository
            .createQueryBuilder('organization')
            .where('organization.id = :organizationId', { organizationId })
            .getOne();
        const settings = org?.settings;
        return Boolean(settings?.starComms?.[flag]);
    }
    async findStarCommsIntegration(organizationId) {
        const fleets = await this.fleetService.getAllFleets(organizationId);
        for (const fleet of fleets) {
            const integrations = await this.integrationService.getIntegrations(fleet.id);
            const starCommsIntegration = integrations.find(integration => integration.enabled &&
                integration.type === ExternalIntegration_1.IntegrationType.STARCOMMS &&
                Boolean(integration.starCommsConfig?.baseUrl));
            if (starCommsIntegration) {
                return starCommsIntegration;
            }
        }
        return null;
    }
}
exports.StarCommsContextSyncService = StarCommsContextSyncService;
//# sourceMappingURL=StarCommsContextSyncService.js.map