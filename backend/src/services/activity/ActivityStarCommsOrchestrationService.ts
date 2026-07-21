import { Activity } from '../../models/Activity';
import { ActivityParticipantStatus } from '../../models/ActivityParticipant';
import { ExternalIntegration, IntegrationType } from '../../models/ExternalIntegration';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { StarCommsAdapter } from '../communication/starcomms';
import { ExternalIntegrationService } from '../external';
import { FleetService } from '../fleet/FleetService';

import { ActivityAuditAction, activityAuditLogger } from './ActivityAuditLogger';
import { ActivityParticipantService } from './ActivityParticipantService';
import { ActivityService } from './ActivityService';

export interface ProvisionStarCommsInput {
  activityId: string;
  integrationId: string;
  userId: string;
  userName: string;
  organizationId: string;
  dryRun?: boolean;
}

export interface ProvisionStarCommsResult {
  activityId: string;
  integrationId: string;
  dryRun: boolean;
  operation: {
    success: boolean;
    operationId?: string;
    message?: string;
  };
  assignments: {
    synced: boolean;
    participantCount: number;
    message?: string;
  };
}

export class ActivityStarCommsOrchestrationService {
  private readonly activityService = new ActivityService();
  private readonly participantService = new ActivityParticipantService();
  private readonly integrationService = new ExternalIntegrationService();
  private readonly fleetService = new FleetService();
  private readonly starCommsAdapter = new StarCommsAdapter();

  public async provisionFromActivity(
    input: ProvisionStarCommsInput
  ): Promise<ProvisionStarCommsResult> {
    const activity = await this.requireActivityInOrganization(
      input.activityId,
      input.organizationId
    );
    await this.requireManagePermission(activity.id, activity.creatorId, input.userId);

    const integration = await this.requireStarCommsIntegration(
      input.integrationId,
      input.organizationId
    );

    const connectionConfig = this.starCommsAdapter.buildConnectionConfig(integration);
    const operationPayload = this.buildOperationPayload(activity, input.organizationId);

    if (input.dryRun) {
      return {
        activityId: input.activityId,
        integrationId: input.integrationId,
        dryRun: true,
        operation: {
          success: true,
          operationId: activity.id,
          message: 'Dry run successful - no StarComms write calls executed',
        },
        assignments: {
          synced: false,
          participantCount: await this.participantService.getParticipantCount(activity.id),
          message: 'Dry run skipped assignment sync',
        },
      };
    }

    const operationResult = await this.starCommsAdapter.ensureOperationFromActivity(
      connectionConfig,
      operationPayload
    );

    if (!operationResult.success) {
      throw new ConflictError(operationResult.message || 'Failed to provision StarComms operation');
    }

    const participants = await this.participantService.getParticipants(
      activity.id,
      ActivityParticipantStatus.ACCEPTED
    );

    const assignmentResult = await this.starCommsAdapter.syncAssignments(connectionConfig, {
      activityId: activity.id,
      assignments: participants.map(participant => ({
        userId: participant.userId,
        userName: participant.userName,
        role: participant.role,
        shipId: participant.shipId,
        shipName: participant.shipName,
        crewPosition: participant.crewPosition,
      })),
    });

    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_UPDATED,
      activityId: activity.id,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: input.organizationId,
      performedById: input.userId,
      performedByName: input.userName,
      details: {
        action: 'starcomms_provision',
        integrationId: input.integrationId,
        operationId: operationResult.operationId,
        participantCount: participants.length,
      },
    });

    return {
      activityId: input.activityId,
      integrationId: input.integrationId,
      dryRun: false,
      operation: operationResult,
      assignments: {
        synced: assignmentResult.success,
        participantCount: participants.length,
        message: assignmentResult.message,
      },
    };
  }

  private async requireActivityInOrganization(
    activityId: string,
    organizationId: string
  ): Promise<Activity> {
    const activity = await this.activityService.getActivityById(activityId);
    if (!activity) {
      throw new NotFoundError('Activity');
    }

    if (activity.organizationId !== organizationId) {
      throw new NotFoundError('Activity');
    }

    return activity;
  }

  private async requireManagePermission(
    activityId: string,
    activityCreatorId: string,
    userId: string
  ): Promise<void> {
    if (activityCreatorId === userId) {
      return;
    }

    const canManage = await this.participantService.canManageActivity(activityId, userId);
    if (!canManage) {
      throw new ForbiddenError('Only activity leaders can provision StarComms operations');
    }
  }

  private async requireStarCommsIntegration(
    integrationId: string,
    organizationId: string
  ): Promise<ExternalIntegration> {
    const integration = await this.integrationService.getIntegrationById(integrationId);
    if (!integration) {
      throw new NotFoundError('Integration');
    }

    const fleet = await this.fleetService.getFleetById(organizationId, integration.fleetId);
    if (!fleet) {
      throw new NotFoundError('Integration');
    }

    if (integration.type !== IntegrationType.STARCOMMS) {
      throw new ValidationError('Integration is not configured as StarComms');
    }

    if (!integration.enabled) {
      throw new ValidationError('Integration is disabled');
    }

    return integration;
  }

  private buildOperationPayload(
    activity: Activity,
    organizationId: string
  ): Record<string, unknown> {
    return {
      activityId: activity.id,
      organizationId,
      title: activity.title,
      description: activity.description,
      status: activity.status,
      location: activity.location,
      scheduledStartDate: activity.scheduledStartDate?.toISOString(),
      scheduledEndDate: activity.scheduledEndDate?.toISOString(),
      voiceChannelId: activity.voiceChannelId,
      discordEventId: activity.discordEventId,
      routePlan: activity.routePlan,
      shipAssignments: activity.shipAssignments,
    };
  }
}
