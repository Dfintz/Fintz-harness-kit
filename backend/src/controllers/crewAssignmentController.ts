import { Request, Response } from 'express';

import { AssignmentStatus } from '../models/CrewAssignment';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import {
  type AddCrewMemberInput,
  type CreateAssignmentInput,
  CrewAssignmentService,
} from '../services/crew';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import { ForbiddenError, UnauthorizedError } from '../utils/apiErrors';
import { extractPaginationOptions } from '../utils/pagination';
import { requirePermission } from '../utils/permissionHelpers';

import { BaseController } from './BaseController';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    currentOrganizationId?: string;
  };
}

/**
 * CrewAssignmentController - HTTP layer for crew assignment management.
 *
 * Delegates all business logic to CrewAssignmentService.
 * Controller only handles HTTP concerns: auth extraction, request parsing, response shaping.
 */
export class CrewAssignmentController extends BaseController {
  private readonly service = new CrewAssignmentService();
  private readonly permissionService = new OrganizationPermissionService();

  constructor() {
    super();
  }

  /**
   * Verify user has fleet permission in the organization.
   * @throws ForbiddenError if insufficient permissions
   */
  private async verifyFleetPermission(
    userId: string,
    organizationId: string,
    action: PermissionAction = PermissionAction.MANAGE
  ): Promise<void> {
    const actionText = action === PermissionAction.VIEW ? 'view' : 'manage';
    await requirePermission(
      this.permissionService,
      organizationId,
      userId,
      ResourceType.FLEET,
      action,
      {
        customMessage: `You do not have permission to ${actionText} crew assignments`,
      }
    );
  }

  private getOrgId(req: AuthRequest): string {
    const orgId = req.user?.currentOrganizationId;
    if (!orgId) {
      throw new ForbiddenError('No active organization selected');
    }
    return orgId;
  }

  private getUserId(req: AuthRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }
    return userId;
  }

  public createAssignment = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const authReq = req as AuthRequest;
        const organizationId = this.getOrgId(authReq);
        const userId = this.getUserId(authReq);
        await this.verifyFleetPermission(userId, organizationId);

        const input = req.body as CreateAssignmentInput;
        const assignment = await this.service.createAssignment(organizationId, userId, input);

        return assignment;
      },
      201
    );
  };

  public getAssignments = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrgId(authReq);
      const userId = this.getUserId(authReq);

      // Verify user has permission to view fleet data
      await this.verifyFleetPermission(userId, organizationId, PermissionAction.VIEW);

      const pagination = extractPaginationOptions(req);
      return this.service.getAssignments(organizationId, pagination);
    });
  };

  public getAssignmentById = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrgId(authReq);
      const userId = this.getUserId(authReq);

      // Verify user has permission to view fleet data
      await this.verifyFleetPermission(userId, organizationId, PermissionAction.VIEW);

      return this.service.getAssignmentById(organizationId, req.params.id);
    });
  };

  public addCrewMember = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrgId(authReq);
      await this.verifyFleetPermission(this.getUserId(authReq), organizationId);
      const input = req.body as AddCrewMemberInput;
      return this.service.addCrewMember(organizationId, req.params.id, input);
    });
  };

  public removeCrewMember = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrgId(authReq);
      await this.verifyFleetPermission(this.getUserId(authReq), organizationId);
      return this.service.removeCrewMember(organizationId, req.params.id, req.params.userId);
    });
  };

  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrgId(authReq);
      await this.verifyFleetPermission(this.getUserId(authReq), organizationId);
      const { status } = req.body as { status: AssignmentStatus };
      return this.service.updateStatus(organizationId, req.params.id, status);
    });
  };
}
