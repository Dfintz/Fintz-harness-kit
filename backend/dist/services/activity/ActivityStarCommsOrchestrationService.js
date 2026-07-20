"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityStarCommsOrchestrationService = void 0;
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const ExternalIntegration_1 = require("../../models/ExternalIntegration");
const apiErrors_1 = require("../../utils/apiErrors");
const starcomms_1 = require("../communication/starcomms");
const external_1 = require("../external");
const FleetService_1 = require("../fleet/FleetService");
const ActivityAuditLogger_1 = require("./ActivityAuditLogger");
const ActivityParticipantService_1 = require("./ActivityParticipantService");
const ActivityService_1 = require("./ActivityService");
class ActivityStarCommsOrchestrationService {
    activityService = new ActivityService_1.ActivityService();
    participantService = new ActivityParticipantService_1.ActivityParticipantService();
    integrationService = new external_1.ExternalIntegrationService();
    fleetService = new FleetService_1.FleetService();
    starCommsAdapter = new starcomms_1.StarCommsAdapter();
    async provisionFromActivity(input) {
        const activity = await this.requireActivityInOrganization(input.activityId, input.organizationId);
        await this.requireManagePermission(activity.id, activity.creatorId, input.userId);
        const integration = await this.requireStarCommsIntegration(input.integrationId, input.organizationId);
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
        const operationResult = await this.starCommsAdapter.ensureOperationFromActivity(connectionConfig, operationPayload);
        if (!operationResult.success) {
            throw new apiErrors_1.ConflictError(operationResult.message || 'Failed to provision StarComms operation');
        }
        const participants = await this.participantService.getParticipants(activity.id, ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED);
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
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_UPDATED,
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
    async requireActivityInOrganization(activityId, organizationId) {
        const activity = await this.activityService.getActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity');
        }
        if (activity.organizationId !== organizationId) {
            throw new apiErrors_1.NotFoundError('Activity');
        }
        return activity;
    }
    async requireManagePermission(activityId, activityCreatorId, userId) {
        if (activityCreatorId === userId) {
            return;
        }
        const canManage = await this.participantService.canManageActivity(activityId, userId);
        if (!canManage) {
            throw new apiErrors_1.ForbiddenError('Only activity leaders can provision StarComms operations');
        }
    }
    async requireStarCommsIntegration(integrationId, organizationId) {
        const integration = await this.integrationService.getIntegrationById(integrationId);
        if (!integration) {
            throw new apiErrors_1.NotFoundError('Integration');
        }
        const fleet = await this.fleetService.getFleetById(organizationId, integration.fleetId);
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Integration');
        }
        if (integration.type !== ExternalIntegration_1.IntegrationType.STARCOMMS) {
            throw new apiErrors_1.ValidationError('Integration is not configured as StarComms');
        }
        if (!integration.enabled) {
            throw new apiErrors_1.ValidationError('Integration is disabled');
        }
        return integration;
    }
    buildOperationPayload(activity, organizationId) {
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
exports.ActivityStarCommsOrchestrationService = ActivityStarCommsOrchestrationService;
//# sourceMappingURL=ActivityStarCommsOrchestrationService.js.map