/**
 * Team Controller V2 — Wave 2.6 Teams/Squads System
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import {
  addTeamMember,
  createTeam,
  moveTeam,
  reorderTeams,
  updateTeam,
  updateTeamMember,
} from '../../schemas/teamSchemas';
import { TeamService } from '../../services/team/TeamService';
import { ApiErrorCode } from '../../types/api';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export class TeamControllerV2 {
  private service = new TeamService();

  // ── Team CRUD ────────────────────────────────────────────────────────────

  /** GET /api/v2/organizations/:orgId/teams */
  async listTeams(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    let teams = await this.service.getTeamsByOrg(orgId);

    // When teams feature is disabled, only expose fleet crew teams
    if ((req as AuthRequest & { crewOnly?: boolean }).crewOnly) {
      teams = teams.filter(t => t.type === 'crew');
    }

    res.success(teams);
  }

  /** GET /api/v2/organizations/:orgId/teams/tree */
  async getTeamTree(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    let tree = await this.service.getTeamTree(orgId);

    // When teams feature is disabled, only expose fleet crew teams
    if ((req as AuthRequest & { crewOnly?: boolean }).crewOnly) {
      tree = tree.filter((t: { type?: string }) => t.type === 'crew');
    }

    res.success({ tree, totalTeams: tree.length });
  }

  /** POST /api/v2/organizations/:orgId/teams */
  async createTeam(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const { error, value } = createTeam.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }
    const team = await this.service.createTeam(orgId, value);
    res.status(201).json({ success: true, data: team });
  }

  /** GET /api/v2/teams/:id */
  async getTeamById(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const team = await this.service.getTeamById(orgId, req.params.id);
    if (!team) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, 'Team not found', 404);
    }
    res.success(team);
  }

  /** PUT /api/v2/teams/:id */
  async updateTeam(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const { error, value } = updateTeam.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    const team = await this.service.updateTeam(orgId, req.params.id, value);
    res.success(team);
  }

  /** DELETE /api/v2/teams/:id */
  async deleteTeam(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    await this.service.deleteTeam(orgId, req.params.id);
    res.success({ message: 'Team deleted' });
  }

  // ── Hierarchy ────────────────────────────────────────────────────────────

  /** PUT /api/v2/teams/:id/move */
  async moveTeam(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const { error, value } = moveTeam.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    const team = await this.service.moveTeam(orgId, req.params.id, value.parentTeamId);
    res.success(team);
  }

  /** PUT /api/v2/organizations/:orgId/teams/reorder */
  async reorderTeams(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const { error, value } = reorderTeams.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    await this.service.reorderTeams(orgId, value.orderedIds, value.parentTeamId ?? null);
    res.success({ message: 'Teams reordered' });
  }

  // ── Members ──────────────────────────────────────────────────────────────

  /** GET /api/v2/teams/:id/members */
  async getMembers(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const members = await this.service.getTeamMembers(orgId, req.params.id);
    res.success(members);
  }

  /** POST /api/v2/teams/:id/members */
  async addMember(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const { error, value } = addTeamMember.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    const { userId, role, ...personnelData } = value;
    const member = await this.service.addMember(
      orgId,
      req.params.id,
      userId,
      role,
      Object.keys(personnelData).length > 0 ? personnelData : undefined
    );
    res.status(201).json({ success: true, data: member });
  }

  /** PUT /api/v2/teams/:teamId/members/:memberId */
  async updateMember(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const { error, value } = updateTeamMember.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    const member = await this.service.updateMember(
      orgId,
      req.params.teamId,
      req.params.memberId,
      value
    );
    res.success(member);
  }

  /** DELETE /api/v2/teams/:teamId/members/:memberId */
  async removeMember(req: Request, res: Response): Promise<void> {
    const user = (req as AuthRequest).user;
    const orgId = user?.currentOrganizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    await this.service.removeMember(orgId, req.params.teamId, req.params.memberId);
    res.success({ message: 'Member removed' });
  }
}
