/**
 * Focus Controller V2 — Sprint 18-E Focus Preferences
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { setOrgFocusSchema, setUserFocusSchema } from '../../schemas/focusSchemas';
import { FocusService } from '../../services/user/FocusService';
import { ApiErrorCode } from '../../types/api';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export class FocusControllerV2 {
  private readonly service = new FocusService();

  /**
   * GET /api/v2/focuses
   * Get list of all available focus values
   */
  async getFocusList(_req: Request, res: Response): Promise<void> {
    const focuses = this.service.getFocusList();
    res.success({ focuses });
  }

  /**
   * PUT /api/v2/users/me/focuses
   * Set the current user's primary and secondary focuses
   */
  async setUserFocus(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { error, value } = setUserFocusSchema.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    await this.service.setUserFocus(userId, value.primaryFocuses, value.secondaryFocuses);
    res.success({ message: 'User focuses updated' });
  }

  /**
   * GET /api/v2/users/me/focuses
   * Get the current user's focus configuration
   */
  async getUserFocus(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const focus = await this.service.getUserFocus(userId);
    res.success({ focus: focus ?? null });
  }

  /**
   * PUT /api/v2/organizations/:orgId/focuses
   * Set organization's focuses
   */
  async setOrgFocus(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { orgId } = req.params;
    const { error, value } = setOrgFocusSchema.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    await this.service.setOrgFocus(orgId, value.focuses);
    res.success({ message: 'Organization focuses updated' });
  }

  /**
   * GET /api/v2/organizations/:orgId/focuses
   * Get organization's focus configuration
   */
  async getOrgFocus(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const focus = await this.service.getOrgFocus(orgId);
    res.success({ focus: focus ?? null });
  }
}
