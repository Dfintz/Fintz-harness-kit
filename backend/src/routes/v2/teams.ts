/**
 * API v2 — Team Routes (Wave 2.6)
 * Team management endpoints
 */

import { NextFunction, Request, Response, Router } from 'express';

import { AvailabilityControllerV2 } from '../../controllers/v2/availabilityController';
import { TeamControllerV2 } from '../../controllers/v2/teamController';
import { AppDataSource } from '../../data-source';
import { authenticate, authenticateWithTenant } from '../../middleware/auth';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Organization } from '../../models/Organization';
import { Team } from '../../models/Team';
import { ApiErrorCode } from '../../types/api';

const router = Router();
const controller = new TeamControllerV2();
const availabilityController = new AvailabilityControllerV2();

type AuthRequest = Request & {
  user?: { id?: string; currentOrganizationId?: string };
};

/**
 * Check whether the target team (if any) is a fleet crew team (`type: 'crew'`).
 * Fleet crew teams are exempt from the teams-disabled gate because they are
 * managed through the Fleet page, not the Teams page proper.
 */
async function isCrewTeamRequest(req: Request): Promise<boolean> {
  const teamId = req.params.id || req.params.teamId;
  if (!teamId) {
    // Org-scoped create route — allow if requesting crew type only
    if (req.method === 'POST' && req.body?.type === 'crew') {
      return true;
    }
    // For GET list/tree, allow but flag so controller can filter to crew-only
    if (req.method === 'GET') {
      (req as AuthRequest & { crewOnly?: boolean }).crewOnly = true;
      return true;
    }
    return false;
  }

  // Individual team route — look up the team scoped to the user's organization
  const orgId = req.params.orgId || (req as AuthRequest).user?.currentOrganizationId;
  if (!orgId) {
    return false;
  }

  const teamRepo = AppDataSource.getRepository(Team);
  const team = await teamRepo.findOne({
    where: { id: teamId, organizationId: orgId },
    select: ['id', 'type'],
  });

  return team?.type === 'crew';
}

/**
 * Middleware: reject the request if the organization has teams disabled,
 * unless the request targets a fleet crew team (type: 'crew').
 *
 * Fleet crew teams are auto-created by FleetTeamService and managed through
 * the Fleet page. They remain accessible regardless of the teams setting,
 * as long as the user has fleet edit permissions (checked downstream).
 */
async function requireTeamsEnabled(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = req.params.orgId || (req as AuthRequest).user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const orgRepo = AppDataSource.getRepository(Organization);
    const org = await orgRepo.findOne({ where: { id: orgId } });

    if (!org) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, 'Organization not found', 404);
    }

    if (org.settings?.enableTeams === false) {
      // Fleet crew teams are exempt — they are managed via fleet permissions
      const crewTeam = await isCrewTeamRequest(req);
      if (!crewTeam) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Teams feature is disabled for this organization. An org leader can enable it in Organization Settings.',
          403
        );
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

// Organization-scoped team operations
router.get(
  '/organizations/:orgId/teams',
  authenticate,
  requireTeamsEnabled,
  controller.listTeams.bind(controller)
);
router.get(
  '/organizations/:orgId/teams/tree',
  authenticate,
  requireTeamsEnabled,
  controller.getTeamTree.bind(controller)
);
router.post(
  '/organizations/:orgId/teams',
  authenticate,
  requireTeamsEnabled,
  controller.createTeam.bind(controller)
);
router.put(
  '/organizations/:orgId/teams/reorder',
  authenticate,
  requireTeamsEnabled,
  controller.reorderTeams.bind(controller)
);

// Individual team operations
router.get(
  '/teams/:id',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.getTeamById.bind(controller)
);
router.put(
  '/teams/:id',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.updateTeam.bind(controller)
);
router.delete(
  '/teams/:id',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.deleteTeam.bind(controller)
);
router.put(
  '/teams/:id/move',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.moveTeam.bind(controller)
);

// Team member operations
router.get(
  '/teams/:id/members',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.getMembers.bind(controller)
);
router.post(
  '/teams/:id/members',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.addMember.bind(controller)
);
router.put(
  '/teams/:teamId/members/:memberId',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.updateMember.bind(controller)
);
router.delete(
  '/teams/:teamId/members/:memberId',
  authenticateWithTenant,
  requireTeamsEnabled,
  controller.removeMember.bind(controller)
);

// Team availability (cross-system: teams × availability)
router.get(
  '/organizations/:orgId/teams/:teamId/availability/heatmap',
  authenticate,
  requireTeamsEnabled,
  availabilityController.getTeamAvailability.bind(availabilityController)
);
router.get(
  '/organizations/:orgId/teams/:teamId/availability/best-times',
  authenticate,
  requireTeamsEnabled,
  availabilityController.getTeamBestTimes.bind(availabilityController)
);

export { router };
