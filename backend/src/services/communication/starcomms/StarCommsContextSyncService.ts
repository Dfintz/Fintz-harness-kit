import { trackMetric } from '../../../config/applicationInsights';
import { AppDataSource } from '../../../data-source';
import { IntegrationType } from '../../../models/ExternalIntegration';
import { Organization } from '../../../models/Organization';
import { logger } from '../../../utils/logger';
import { ExternalIntegrationService } from '../../external';
import { FleetService } from '../../fleet/FleetService';

import { StarCommsAdapter } from './StarCommsAdapter';

export interface StarCommsBriefingSyncPayload {
  organizationId: string;
  briefingId: string;
  title: string;
  classification: string;
  status: string;
  missionId?: string;
  operationIds?: string[];
}

export interface StarCommsTeamSyncPayload {
  organizationId: string;
  teamId: string;
  teamName: string;
  teamType?: string;
  action: 'team-created' | 'team-deleted';
}

export class StarCommsContextSyncService {
  private static readonly BRIEFING_SYNC_SUCCESS_METRIC = 'starcomms.briefing.sync.success_total';
  private static readonly BRIEFING_SYNC_SKIPPED_METRIC = 'starcomms.briefing.sync.skipped_total';
  private static readonly BRIEFING_SYNC_FAILED_METRIC = 'starcomms.briefing.sync.failed_total';
  private static readonly TEAM_SYNC_SUCCESS_METRIC = 'starcomms.team.sync.success_total';
  private static readonly TEAM_SYNC_SKIPPED_METRIC = 'starcomms.team.sync.skipped_total';
  private static readonly TEAM_SYNC_FAILED_METRIC = 'starcomms.team.sync.failed_total';

  private readonly organizationRepository = AppDataSource.getRepository(Organization);
  private readonly fleetService = new FleetService();
  private readonly integrationService = new ExternalIntegrationService();
  private readonly starCommsAdapter = new StarCommsAdapter();

  async syncBriefingContext(payload: StarCommsBriefingSyncPayload): Promise<void> {
    const enabled = await this.isFlagEnabled(payload.organizationId, 'enableBriefingSync');
    if (!enabled) {
      this.trackSyncMetric(StarCommsContextSyncService.BRIEFING_SYNC_SKIPPED_METRIC);
      return;
    }

    const integration = await this.findStarCommsIntegration(payload.organizationId);
    if (!integration) {
      this.trackSyncMetric(StarCommsContextSyncService.BRIEFING_SYNC_SKIPPED_METRIC);
      logger.debug('StarComms briefing sync skipped: no integration configured', {
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
    } catch (error: unknown) {
      this.trackSyncMetric(StarCommsContextSyncService.BRIEFING_SYNC_FAILED_METRIC);
      logger.warn('StarComms briefing sync failed', {
        organizationId: payload.organizationId,
        briefingId: payload.briefingId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async syncTeamContext(payload: StarCommsTeamSyncPayload): Promise<void> {
    const enabled = await this.isFlagEnabled(payload.organizationId, 'enableTeamSync');
    if (!enabled) {
      this.trackSyncMetric(StarCommsContextSyncService.TEAM_SYNC_SKIPPED_METRIC);
      return;
    }

    const integration = await this.findStarCommsIntegration(payload.organizationId);
    if (!integration) {
      this.trackSyncMetric(StarCommsContextSyncService.TEAM_SYNC_SKIPPED_METRIC);
      logger.debug('StarComms team sync skipped: no integration configured', {
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
    } catch (error: unknown) {
      this.trackSyncMetric(StarCommsContextSyncService.TEAM_SYNC_FAILED_METRIC);
      logger.warn('StarComms team sync failed', {
        organizationId: payload.organizationId,
        teamId: payload.teamId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private trackSyncMetric(metricName: string): void {
    trackMetric(metricName, 1);
  }

  private async isFlagEnabled(
    organizationId: string,
    flag: 'enableBriefingSync' | 'enableTeamSync'
  ): Promise<boolean> {
    const org = await this.organizationRepository
      .createQueryBuilder('organization')
      .where('organization.id = :organizationId', { organizationId })
      .getOne();
    const settings = org?.settings;
    return Boolean(settings?.starComms?.[flag]);
  }

  private async findStarCommsIntegration(organizationId: string): Promise<
    | (Awaited<ReturnType<ExternalIntegrationService['getIntegrations']>>[number] & {
        starCommsConfig?: { baseUrl?: string };
      })
    | null
  > {
    const fleets = await this.fleetService.getAllFleets(organizationId);

    for (const fleet of fleets) {
      const integrations = await this.integrationService.getIntegrations(fleet.id);
      const starCommsIntegration = integrations.find(
        integration =>
          integration.enabled &&
          integration.type === IntegrationType.STARCOMMS &&
          Boolean(integration.starCommsConfig?.baseUrl)
      );

      if (starCommsIntegration) {
        return starCommsIntegration;
      }
    }

    return null;
  }
}
