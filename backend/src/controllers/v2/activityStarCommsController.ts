import { Request, Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import {
  ActivityStarCommsOrchestrationService,
  ProvisionStarCommsResult,
} from '../../services/activity/ActivityStarCommsOrchestrationService';
import { ForbiddenError, ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

export class ActivityStarCommsController extends BaseController {
  private readonly orchestrationService = new ActivityStarCommsOrchestrationService();

  public provisionFromActivity = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn<ProvisionStarCommsResult>(
      req,
      res,
      async () => {
        const activityId = this.requireUuid(req.params.activityId, 'activityId');
        const integrationId = this.requireUuid(
          String((req.body as { integrationId: string }).integrationId),
          'integrationId'
        );
        const dryRun = Boolean((req.body as { dryRun?: boolean }).dryRun);

        const user = (req as AuthRequest).user;
        if (!user?.id || !user.username) {
          throw new ForbiddenError('Authentication required');
        }
        if (!user.currentOrganizationId) {
          throw new ForbiddenError('Organization context is required for activity operations');
        }

        return this.orchestrationService.provisionFromActivity({
          activityId,
          integrationId,
          dryRun,
          userId: user.id,
          userName: user.username,
          organizationId: user.currentOrganizationId,
        });
      },
      200
    );
  };

  private requireUuid(value: string | undefined, fieldName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      throw new ValidationError(`Invalid ${fieldName}`);
    }
    return value;
  }
}
