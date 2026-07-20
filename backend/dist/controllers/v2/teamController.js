"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const teamSchemas_1 = require("../../schemas/teamSchemas");
const TeamService_1 = require("../../services/team/TeamService");
const api_1 = require("../../types/api");
class TeamControllerV2 {
    service = new TeamService_1.TeamService();
    async listTeams(req, res) {
        const { orgId } = req.params;
        let teams = await this.service.getTeamsByOrg(orgId);
        if (req.crewOnly) {
            teams = teams.filter(t => t.type === 'crew');
        }
        res.success(teams);
    }
    async getTeamTree(req, res) {
        const { orgId } = req.params;
        let tree = await this.service.getTeamTree(orgId);
        if (req.crewOnly) {
            tree = tree.filter((t) => t.type === 'crew');
        }
        res.success({ tree, totalTeams: tree.length });
    }
    async createTeam(req, res) {
        const { orgId } = req.params;
        const { error, value } = teamSchemas_1.createTeam.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const team = await this.service.createTeam(orgId, value);
        res.status(201).json({ success: true, data: team });
    }
    async getTeamById(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const team = await this.service.getTeamById(orgId, req.params.id);
        if (!team) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Team not found', 404);
        }
        res.success(team);
    }
    async updateTeam(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const { error, value } = teamSchemas_1.updateTeam.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const team = await this.service.updateTeam(orgId, req.params.id, value);
        res.success(team);
    }
    async deleteTeam(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        await this.service.deleteTeam(orgId, req.params.id);
        res.success({ message: 'Team deleted' });
    }
    async moveTeam(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const { error, value } = teamSchemas_1.moveTeam.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const team = await this.service.moveTeam(orgId, req.params.id, value.parentTeamId);
        res.success(team);
    }
    async reorderTeams(req, res) {
        const { orgId } = req.params;
        const { error, value } = teamSchemas_1.reorderTeams.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        await this.service.reorderTeams(orgId, value.orderedIds, value.parentTeamId ?? null);
        res.success({ message: 'Teams reordered' });
    }
    async getMembers(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const members = await this.service.getTeamMembers(orgId, req.params.id);
        res.success(members);
    }
    async addMember(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const { error, value } = teamSchemas_1.addTeamMember.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const { userId, role, ...personnelData } = value;
        const member = await this.service.addMember(orgId, req.params.id, userId, role, Object.keys(personnelData).length > 0 ? personnelData : undefined);
        res.status(201).json({ success: true, data: member });
    }
    async updateMember(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const { error, value } = teamSchemas_1.updateTeamMember.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const member = await this.service.updateMember(orgId, req.params.teamId, req.params.memberId, value);
        res.success(member);
    }
    async removeMember(req, res) {
        const user = req.user;
        const orgId = user?.currentOrganizationId;
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        await this.service.removeMember(orgId, req.params.teamId, req.params.memberId);
        res.success({ message: 'Member removed' });
    }
}
exports.TeamControllerV2 = TeamControllerV2;
//# sourceMappingURL=teamController.js.map