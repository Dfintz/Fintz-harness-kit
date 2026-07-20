"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const availabilityController_1 = require("../../controllers/v2/availabilityController");
const teamController_1 = require("../../controllers/v2/teamController");
const data_source_1 = require("../../data-source");
const auth_1 = require("../../middleware/auth");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Organization_1 = require("../../models/Organization");
const Team_1 = require("../../models/Team");
const api_1 = require("../../types/api");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new teamController_1.TeamControllerV2();
const availabilityController = new availabilityController_1.AvailabilityControllerV2();
async function isCrewTeamRequest(req) {
    const teamId = req.params.id || req.params.teamId;
    if (!teamId) {
        if (req.method === 'POST' && req.body?.type === 'crew') {
            return true;
        }
        if (req.method === 'GET') {
            req.crewOnly = true;
            return true;
        }
        return false;
    }
    const orgId = req.params.orgId || req.user?.currentOrganizationId;
    if (!orgId) {
        return false;
    }
    const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
    const team = await teamRepo.findOne({
        where: { id: teamId, organizationId: orgId },
        select: ['id', 'type'],
    });
    return team?.type === 'crew';
}
async function requireTeamsEnabled(req, _res, next) {
    try {
        const orgId = req.params.orgId || req.user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        const org = await orgRepo.findOne({ where: { id: orgId } });
        if (!org) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Organization not found', 404);
        }
        if (org.settings?.enableTeams === false) {
            const crewTeam = await isCrewTeamRequest(req);
            if (!crewTeam) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Teams feature is disabled for this organization. An org leader can enable it in Organization Settings.', 403);
            }
        }
        next();
    }
    catch (err) {
        next(err);
    }
}
router.get('/organizations/:orgId/teams', auth_1.authenticate, requireTeamsEnabled, controller.listTeams.bind(controller));
router.get('/organizations/:orgId/teams/tree', auth_1.authenticate, requireTeamsEnabled, controller.getTeamTree.bind(controller));
router.post('/organizations/:orgId/teams', auth_1.authenticate, requireTeamsEnabled, controller.createTeam.bind(controller));
router.put('/organizations/:orgId/teams/reorder', auth_1.authenticate, requireTeamsEnabled, controller.reorderTeams.bind(controller));
router.get('/teams/:id', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.getTeamById.bind(controller));
router.put('/teams/:id', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.updateTeam.bind(controller));
router.delete('/teams/:id', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.deleteTeam.bind(controller));
router.put('/teams/:id/move', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.moveTeam.bind(controller));
router.get('/teams/:id/members', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.getMembers.bind(controller));
router.post('/teams/:id/members', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.addMember.bind(controller));
router.put('/teams/:teamId/members/:memberId', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.updateMember.bind(controller));
router.delete('/teams/:teamId/members/:memberId', auth_1.authenticateWithTenant, requireTeamsEnabled, controller.removeMember.bind(controller));
router.get('/organizations/:orgId/teams/:teamId/availability/heatmap', auth_1.authenticate, requireTeamsEnabled, availabilityController.getTeamAvailability.bind(availabilityController));
router.get('/organizations/:orgId/teams/:teamId/availability/best-times', auth_1.authenticate, requireTeamsEnabled, availabilityController.getTeamBestTimes.bind(availabilityController));
//# sourceMappingURL=teams.js.map