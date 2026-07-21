/**
 * API v2 - Activity Routes
 * Activity management endpoints with standardized responses
 */

import { Request, RequestHandler, Response, Router } from 'express';
import Joi from 'joi';

import { ActivityControllerV2 } from '../../controllers/v2/activityController';
import { ActivityStarCommsController } from '../../controllers/v2/activityStarCommsController';
import { OperationCommandController } from '../../controllers/v2/operationCommandController';
import { ReadyCheckController } from '../../controllers/v2/readyCheckController';
import { authenticate, authenticateWithTenant } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { activitySchemas } from '../../schemas/activitySchemas';

const router = Router();
const controller = new ActivityControllerV2();
const readyCheckController = new ReadyCheckController();
const opCommandController = new OperationCommandController();
const activityStarCommsController = new ActivityStarCommsController();
const bringAndInviteFleetRequestSchema: Joi.ObjectSchema = Joi.object({
  fleetId: Joi.string().trim().required(),
  shipIds: Joi.array().items(Joi.string().trim()).max(100).optional(),
  userIds: Joi.array().items(Joi.string().trim()).max(200).optional(),
});

type BringFleetAndInviteMembersAction = (req: Request, res: Response) => Promise<void>;

const bringFleetAndInviteMembersAction = (
  controller as ActivityControllerV2 & {
    bringFleetAndInviteMembers: BringFleetAndInviteMembersAction;
  }
).bringFleetAndInviteMembers;

const bringFleetAndInviteMembersHandler: RequestHandler = (req, res, next) => {
  bringFleetAndInviteMembersAction.call(controller, req, res).catch(next);
};

// Discovery endpoints (no auth for public discovery)
router.get(
  '/activities/recommended',
  authenticate,
  controller.getRecommendedActivities.bind(controller)
);

router.get('/activities/upcoming', authenticate, controller.getUpcomingActivities.bind(controller));

// Statistics endpoint
router.get(
  '/activities/statistics',
  authenticate,
  controller.getActivityStatistics.bind(controller)
);

// Search activities
router.get('/activities', authenticate, controller.searchActivities.bind(controller));

// My activities
router.get('/users/me/activities', authenticate, controller.getMyActivities.bind(controller));

// Organization-scoped activity operations
router.get(
  '/organizations/:orgId/activities',
  authenticate,
  controller.listOrgActivities.bind(controller)
);

router.post(
  '/organizations/:orgId/activities',
  authenticate,
  validateSchema(activitySchemas.createV2),
  controller.createActivity.bind(controller)
);

router.get(
  '/organizations/:orgId/activities/analytics',
  authenticate,
  controller.getActivityAnalytics.bind(controller)
);

// Quick join endpoints (must be before /:id to avoid route conflicts)
router.post(
  '/activities/:id/join-link',
  authenticate,
  controller.generateJoinLink.bind(controller)
);

router.get('/activities/join/:token', controller.previewActivityByToken.bind(controller));

router.post(
  '/activities/join/:token',
  authenticate,
  controller.joinActivityByToken.bind(controller)
);

// Individual activity operations
router.get('/activities/:id', authenticate, controller.getActivityById.bind(controller));

router.put(
  '/activities/:id',
  authenticate,
  validateSchema(activitySchemas.updateV2),
  controller.updateActivity.bind(controller)
);

router.delete('/activities/:id', authenticate, controller.deleteActivity.bind(controller));

// Participation endpoints
router.post('/activities/:id/join', authenticate, controller.joinActivity.bind(controller));

router.post('/activities/:id/leave', authenticate, controller.leaveActivity.bind(controller));

router.get(
  '/activities/:id/participants',
  authenticate,
  controller.getParticipants.bind(controller)
);

router.put(
  '/activities/:id/participants/:userId',
  authenticate,
  controller.updateParticipant.bind(controller)
);

// Calendar and scheduling endpoints
router.get(
  '/organizations/:orgId/activities/calendar',
  authenticate,
  controller.getActivityCalendar.bind(controller)
);

router.get(
  '/activities/:id/calendar-export',
  authenticate,
  controller.exportActivityToCalendar.bind(controller)
);

// Reminder endpoints
router.post(
  '/activities/:id/reminders',
  authenticate,
  controller.createActivityReminder.bind(controller)
);

router.get(
  '/activities/:id/reminders',
  authenticate,
  controller.getActivityReminders.bind(controller)
);

// Reminder management endpoints: planned — cancel/reschedule reminders

// Activity status management
router.put(
  '/activities/:id/status',
  authenticate,
  controller.updateActivityStatus.bind(controller)
);

router.post(
  '/activities/:id/complete',
  authenticateWithTenant,
  validateSchema(activitySchemas.complete),
  controller.completeActivity.bind(controller)
);

router.post(
  '/activities/:id/cancel',
  authenticateWithTenant,
  controller.cancelActivity.bind(controller)
);

// Organization management endpoints
router.post(
  '/activities/:id/invite-org',
  authenticate,
  controller.inviteOrganization.bind(controller)
);

router.post(
  '/activities/:id/accept-invite',
  authenticate,
  controller.acceptOrganizationInvite.bind(controller)
);

router.post(
  '/activities/:id/decline-invite',
  authenticate,
  controller.declineOrganizationInvite.bind(controller)
);

// Voice channel endpoints
router.post('/activities/:id/voice', authenticate, controller.createVoiceChannel.bind(controller));

router.post(
  '/activities/:id/voice/link',
  authenticate,
  controller.linkVoiceChannel.bind(controller)
);

// Batch operations
router.post(
  '/organizations/:orgId/activities/batch',
  authenticate,
  controller.batchCreateActivities.bind(controller)
);

router.post(
  '/activities/batch/update',
  authenticateWithTenant,
  controller.batchUpdateActivities.bind(controller)
);

router.post(
  '/activities/batch/delete',
  authenticateWithTenant,
  controller.batchDeleteActivities.bind(controller)
);

// Ship & crew management endpoints
router.post('/activities/:id/ships', authenticate, controller.addShip.bind(controller));

// Loan ships (must be before /:ownerId/crew to avoid route conflict)
router.post(
  '/activities/:id/ships/loan',
  authenticate,
  validateSchema(activitySchemas.loanShips),
  controller.loanShips.bind(controller)
);

router.post(
  '/activities/:id/ships/:ownerId/crew',
  authenticate,
  controller.joinShipCrew.bind(controller)
);

router.delete(
  '/activities/:id/ships/crew',
  authenticate,
  controller.leaveShipCrew.bind(controller)
);

router.get(
  '/activities/:id/ships/available-crew',
  authenticate,
  controller.getAvailableCrewPositions.bind(controller)
);

// Passenger (non-crew) slot management
router.get(
  '/activities/:id/ships/available-passengers',
  authenticate,
  controller.getAvailablePassengerSlots.bind(controller)
);

// Leave passenger slot (static path — declare before /:shipId variants)
router.delete(
  '/activities/:id/ships/passengers',
  authenticate,
  controller.leaveShipPassenger.bind(controller)
);

router.patch(
  '/activities/:id/ships/:shipId/passengers',
  authenticate,
  validateSchema(activitySchemas.setPassengerSlots),
  controller.setPassengerSlots.bind(controller)
);

router.post(
  '/activities/:id/ships/:shipId/passengers/join',
  authenticate,
  validateSchema(activitySchemas.joinPassenger),
  controller.joinShipPassenger.bind(controller)
);

// Typed crew-slot management (seats per role)
router.get(
  '/activities/:id/ships/crew-slots',
  authenticate,
  controller.getCrewSlotAvailability.bind(controller)
);

router.patch(
  '/activities/:id/ships/:shipId/crew-slots',
  authenticate,
  validateSchema(activitySchemas.setCrewSlots),
  controller.setCrewSlots.bind(controller)
);

// Fleet operations: bring fleet ships / invite fleet members
router.post(
  '/activities/:id/fleet/bring-and-invite',
  authenticate,
  validateSchema(bringAndInviteFleetRequestSchema),
  bringFleetAndInviteMembersHandler
);

router.post(
  '/activities/:id/fleet/bring',
  authenticate,
  validateSchema(activitySchemas.bringFleet),
  controller.bringFleetToActivity.bind(controller)
);

router.post(
  '/activities/:id/fleet/invite',
  authenticate,
  validateSchema(activitySchemas.inviteFleet),
  controller.inviteFleetMembers.bind(controller)
);

// Set/move a participant's crew position on a ship (self, creator, or leader)
router.patch(
  '/activities/:id/crew',
  authenticate,
  validateSchema(activitySchemas.setCrewPosition),
  controller.setCrewPosition.bind(controller)
);

// Nest a ship inside a parent ship's hangar/cargo (or un-nest if parentShipId is null)
router.patch(
  '/activities/:id/ships/:shipAssignmentId/nest',
  authenticate,
  validateSchema(activitySchemas.nestShip),
  controller.nestShip.bind(controller)
);

// Route planning endpoints
router.post('/activities/:id/route', authenticate, controller.addRoutePlan.bind(controller));

router.put(
  '/activities/:id/route/:order',
  authenticate,
  controller.updateWaypoint.bind(controller)
);

// Mining data endpoint
router.post(
  '/activities/:id/enrich-mining',
  authenticate,
  controller.enrichWithMiningData.bind(controller)
);

// Aggregator endpoints
router.post(
  '/organizations/:orgId/activities/create-full',
  authenticate,
  validateSchema(activitySchemas.createActivityFull),
  controller.createActivityFull.bind(controller)
);

router.post(
  '/activities/:id/complete-full',
  authenticateWithTenant,
  validateSchema(activitySchemas.completeActivityFull),
  controller.completeActivityFull.bind(controller)
);

// Ready check endpoints (voice-command friendly)
router.post(
  '/activities/:id/ready-check',
  authenticateWithTenant,
  validateSchema(activitySchemas.initiateReadyCheck),
  readyCheckController.initiateReadyCheck.bind(readyCheckController)
);

router.post(
  '/activities/:id/ready-check/respond',
  authenticateWithTenant,
  validateSchema(activitySchemas.respondReadyCheck),
  readyCheckController.respondToReadyCheck.bind(readyCheckController)
);

router.get(
  '/activities/:id/ready-check',
  authenticateWithTenant,
  readyCheckController.getReadyCheck.bind(readyCheckController)
);

router.delete(
  '/activities/:id/ready-check',
  authenticateWithTenant,
  readyCheckController.cancelReadyCheck.bind(readyCheckController)
);

// ===== Operation Command Chain endpoints (Wingman AI ready) =====

// Command chain setup
router.post(
  '/activities/:id/command-chain',
  authenticateWithTenant,
  validateSchema(activitySchemas.setCommandChain),
  opCommandController.setCommandChain.bind(opCommandController)
);

router.get(
  '/activities/:id/command-chain',
  authenticateWithTenant,
  opCommandController.getCommandChain.bind(opCommandController)
);

// Issue and list commands
router.post(
  '/activities/:id/commands',
  authenticateWithTenant,
  validateSchema(activitySchemas.issueCommand),
  opCommandController.issueCommand.bind(opCommandController)
);

router.get(
  '/activities/:id/commands',
  authenticateWithTenant,
  opCommandController.getCommands.bind(opCommandController)
);

// Single command + acknowledge
router.get(
  '/activities/:id/commands/:cmdId',
  authenticateWithTenant,
  opCommandController.getCommand.bind(opCommandController)
);

router.post(
  '/activities/:id/commands/:cmdId/ack',
  authenticateWithTenant,
  validateSchema(activitySchemas.acknowledgeCommand),
  opCommandController.acknowledgeCommand.bind(opCommandController)
);

// Pre-flight check (voice shortcut: "Run pre-flight check")
router.post(
  '/activities/:id/preflight-check',
  authenticateWithTenant,
  opCommandController.preflightCheck.bind(opCommandController)
);

// StarComms orchestration from activity context
router.post(
  '/activities/:activityId/starcomms/provision',
  authenticateWithTenant,
  validateSchema(activitySchemas.provisionStarComms),
  activityStarCommsController.provisionFromActivity.bind(activityStarCommsController)
);

export { router };
