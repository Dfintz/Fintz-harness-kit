import { Request, Response } from 'express';

import type { TeamMemberRole, TeamMemberStatus } from '../models/TeamMember';
import { FleetService } from '../services/fleet/FleetService';
import { TeamMemberFilterOptions, TeamService } from '../services/team/TeamService';
import { NotFoundError, ValidationError } from '../utils/apiErrors';
import { extractPaginationOptions } from '../utils/pagination';

import { BaseController } from './BaseController';

/** Request with auth context (organizationId + user) */
type AuthRequest = Request & {
  organizationId?: string;
  user?: { id?: string; organizationId?: string };
};

/**
 * SquadronController - Manages squadron (user group) membership
 *
 * Handles people organization (squadrons, divisions, wings).
 * For ship ownership, use UserShipController or OrganizationShipController.
 *
 * Sprint 12-D: Now delegates directly to TeamService (SquadronService removed).
 */
export class SquadronController extends BaseController {
  private readonly teamService: TeamService;
  private readonly fleetService: FleetService;

  constructor() {
    super();
    this.teamService = new TeamService();
    this.fleetService = new FleetService();
  }

  /**
   * Resolve the teamId linked to a fleet (squadron).
   */
  private async resolveTeamId(organizationId: string, squadronId: string): Promise<string> {
    const fleet = await this.fleetService.findById(organizationId, squadronId);
    if (!fleet) {
      throw new NotFoundError(`Fleet/squadron ${squadronId}`);
    }
    if (!fleet.teamId) {
      throw new ValidationError(
        `Fleet ${squadronId} has no linked team. ` +
          'Run migration 1789000000000-MigrateFleetMembersToTeamMembers first.'
      );
    }
    return fleet.teamId;
  }

  /**
   * Get squadron members with advanced filtering
   * GET /api/squadrons/:squadronId/members
   * Query params: page, limit, sortBy, sortOrder, userId, role, shipType, status, joinedAfter, joinedBefore, searchTerm
   */
  public getSquadronMembers = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const squadronId = req.params.squadronId || (req.query.squadronId as string);
      const teamId = squadronId ? await this.resolveTeamId(organizationId, squadronId) : undefined;

      const filters: TeamMemberFilterOptions = {
        teamId,
        userId: req.query.userId as string,
        role: req.query.role as TeamMemberRole | undefined,
        shipType: req.query.shipType as string,
        status: this.parseStatusFilter(req.query.status),
        joinedAfter: req.query.joinedAfter ? new Date(req.query.joinedAfter as string) : undefined,
        joinedBefore: req.query.joinedBefore
          ? new Date(req.query.joinedBefore as string)
          : undefined,
        lastActiveAfter: req.query.lastActiveAfter
          ? new Date(req.query.lastActiveAfter as string)
          : undefined,
        lastActiveBefore: req.query.lastActiveBefore
          ? new Date(req.query.lastActiveBefore as string)
          : undefined,
        searchTerm: req.query.searchTerm as string,
        ...extractPaginationOptions(req),
      };

      return this.teamService.getTeamMembersFiltered(organizationId, filters);
    });
  };

  /**
   * Get specific squadron member by ID
   * GET /api/squadrons/:squadronId/members/:memberId
   */
  public getSquadronMemberById = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { memberId } = req.params;

      if (!organizationId || !memberId) {
        throw new ValidationError('Organization context and member ID required');
      }

      const member = await this.teamService.getTeamMemberById(organizationId, memberId);

      if (!member) {
        throw new NotFoundError('Squadron member');
      }

      return member;
    });
  };

  /**
   * Get all members of a squadron
   * GET /api/squadrons/:squadronId/roster
   */
  public getSquadronRoster = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      return this.teamService.getTeamMembers(organizationId, teamId);
    });
  };

  /**
   * Get all squadrons for a user
   * GET /api/users/:userId/squadrons
   */
  public getUserSquadrons = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const userId = req.params.userId || (req as AuthRequest).user?.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      return this.teamService.findByUser(organizationId, userId);
    });
  };

  /**
   * Check if user is member of squadron
   * GET /api/squadrons/:squadronId/members/:userId/check
   */
  public checkMembership = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId, userId } = req.params;

      if (!organizationId || !squadronId || !userId) {
        throw new ValidationError('Organization context, squadron ID, and user ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      const isMember = await this.teamService.isMember(organizationId, teamId, userId);

      return { isMember };
    });
  };

  /**
   * Get membership details
   * GET /api/squadrons/:squadronId/members/:userId
   */
  public getMembership = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId, userId } = req.params;

      if (!organizationId || !squadronId || !userId) {
        throw new ValidationError('Organization context, squadron ID, and user ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      const membership = await this.teamService.getMembership(organizationId, teamId, userId);

      if (!membership) {
        throw new NotFoundError('Membership');
      }

      return membership;
    });
  };

  // ========================================
  // MEMBERSHIP MANAGEMENT
  // ========================================

  /**
   * Add user to squadron
   * POST /api/squadrons/:squadronId/members
   * Body: { userId: string, role?: string }
   */
  public addMember = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;
      const { userId, role } = req.body;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);

      // Check if already a member
      const existing = await this.teamService.getMembership(organizationId, teamId, userId);
      if (existing) {
        throw new ValidationError('User is already a member of this squadron');
      }

      const member = await this.teamService.addMember(
        organizationId,
        teamId,
        userId,
        (role || 'member') as TeamMemberRole
      );

      res.status(201).json(member);
    });
  };

  /**
   * Bulk add members to squadron
   * POST /api/squadrons/:squadronId/members/bulk
   * Body: { members: { userId: string, role?: string }[] } (max 100)
   */
  public bulkAddMembers = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;
      const { members } = req.body;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      if (!Array.isArray(members)) {
        throw new ValidationError('members must be an array');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      const created = await this.teamService.bulkAddMembers(organizationId, teamId, members);

      res.status(201).json(created);
    });
  };

  /**
   * Bulk update squadron members
   * PATCH /api/squadrons/members/bulk
   * Body: { updates: BulkUpdateFleetMemberDto[] } (max 100)
   */
  public bulkUpdateMembers = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { updates } = req.body;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!Array.isArray(updates)) {
        throw new ValidationError('updates must be an array');
      }

      return this.teamService.bulkUpdateMembers(organizationId, updates);
    });
  };

  /**
   * Bulk delete squadron members
   * DELETE /api/squadrons/members/bulk
   * Body: { memberIds: string[] } (max 100)
   */
  public bulkDeleteMembers = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId, memberIds } = req.body;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!squadronId) {
        throw new ValidationError('squadronId is required');
      }

      if (!Array.isArray(memberIds)) {
        throw new ValidationError('memberIds must be an array');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      await this.teamService.bulkDeleteMembers(organizationId, teamId, memberIds);

      res.status(204).send();
    });
  };

  /**
   * Bulk update member status
   * PATCH /api/squadrons/members/bulk/status
   * Body: { memberIds: string[], status: TeamMemberStatus } (max 100)
   */
  public bulkUpdateStatus = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId, memberIds, status } = req.body;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!squadronId) {
        throw new ValidationError('squadronId is required');
      }

      if (!Array.isArray(memberIds)) {
        throw new ValidationError('memberIds must be an array');
      }

      if (!status) {
        throw new ValidationError('status is required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      await this.teamService.bulkUpdateStatus(
        organizationId,
        teamId,
        memberIds,
        status as TeamMemberStatus
      );

      res.status(204).send();
    });
  };

  /**
   * Update member role
   * PATCH /api/squadrons/:squadronId/members/:userId/role
   * Body: { role: string }
   */
  public updateRole = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId, userId } = req.params;
      const { role } = req.body;

      if (!organizationId || !squadronId || !userId) {
        throw new ValidationError('Organization context, squadron ID, and user ID required');
      }

      if (!role) {
        throw new ValidationError('role is required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      const membership = await this.teamService.getMembership(organizationId, teamId, userId);

      if (!membership) {
        throw new NotFoundError('Membership');
      }

      const member = await this.teamService.updateMember(organizationId, teamId, membership.id, {
        role: role as TeamMemberRole,
      });

      if (!member) {
        throw new NotFoundError('Membership');
      }

      return member;
    });
  };

  /**
   * Remove member from squadron
   * DELETE /api/squadrons/:squadronId/members/:userId
   */
  public removeMember = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId, userId } = req.params;

      if (!organizationId || !squadronId || !userId) {
        throw new ValidationError('Organization context, squadron ID, and user ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      const membership = await this.teamService.getMembership(organizationId, teamId, userId);

      if (!membership) {
        throw new NotFoundError('Membership');
      }

      await this.teamService.removeMember(organizationId, teamId, membership.id);

      res.status(204).send();
    });
  };

  // ========================================
  // ANALYTICS
  // ========================================

  /**
   * Get squadron member count
   * GET /api/squadrons/:squadronId/count
   */
  public getSquadronMemberCount = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      const count = await this.teamService.getTeamMemberCount(organizationId, teamId);

      return { count };
    });
  };

  /**
   * Get active member count
   * GET /api/squadrons/:squadronId/count/active
   */
  public getActiveCount = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      const count = await this.teamService.getActiveCount(organizationId, teamId);

      return { count };
    });
  };

  /**
   * Get members by role distribution
   * GET /api/squadrons/:squadronId/stats/roles
   */
  public getMembersByRole = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      return this.teamService.getMembersByRole(organizationId, teamId);
    });
  };

  /**
   * Get members by ship type distribution
   * GET /api/squadrons/:squadronId/stats/ships
   */
  public getMembersByShipType = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      return this.teamService.getMembersByShipType(organizationId, teamId);
    });
  };

  /**
   * Get squadron statistics
   * GET /api/squadrons/:squadronId/stats
   */
  public getSquadronStatistics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const { squadronId } = req.params;

      if (!organizationId || !squadronId) {
        throw new ValidationError('Organization context and squadron ID required');
      }

      const teamId = await this.resolveTeamId(organizationId, squadronId);
      return this.teamService.getTeamStatistics(organizationId, teamId);
    });
  };

  /**
   * Get user's squadron count
   * GET /api/users/:userId/squadrons/count
   */
  public getUserSquadronCount = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const userId = req.params.userId || (req as AuthRequest).user?.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const count = await this.teamService.getUserTeamCount(organizationId, userId);

      return { count };
    });
  };

  // ========================================
  // HELPER METHODS
  // ========================================

  private parseStatusFilter(status: unknown): TeamMemberStatus | TeamMemberStatus[] | undefined {
    if (!status) {
      return undefined;
    }

    if (typeof status === 'string') {
      if (status.includes(',')) {
        return status.split(',').map(s => s.trim() as TeamMemberStatus);
      }
      return status as TeamMemberStatus;
    }

    return undefined;
  }
}
