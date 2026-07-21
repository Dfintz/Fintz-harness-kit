import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { IntegrationStatusService } from '../../services/monitoring/IntegrationStatusService';
import { NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { BaseController } from '../BaseController';

/**
 * IntegrationStatusController — Exposes system health and integration status.
 * Mounted under admin routes; requires admin privileges.
 * Delegates to IntegrationStatusService (singleton with 30s cache).
 */
export class IntegrationStatusController extends BaseController {
  private readonly integrationStatusService: IntegrationStatusService;

  constructor() {
    super();
    this.integrationStatusService = IntegrationStatusService.getInstance();
  }

  /**
   * GET /admin/integrations/health
   * Get health dashboard for all external integrations.
   */
  public getSystemHealth = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      logger.info('Integration health dashboard requested', { userId: user.id });
      return this.integrationStatusService.getSystemHealth();
    });
  };

  /**
   * GET /admin/integrations/health/:name
   * Get health for a specific integration by name.
   */
  public getIntegrationHealth = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const user = this.getAuthUser(authReq);
      const { name } = authReq.params;

      logger.info('Specific integration health requested', { userId: user.id, integration: name });

      const health = await this.integrationStatusService.getIntegrationHealth(name);
      if (!health) {
        throw new NotFoundError('Integration', name);
      }

      return health;
    });
  };

  /**
   * POST /admin/integrations/health/refresh
   * Force-refresh all integration health checks (invalidates cache).
   */
  public refreshHealth = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      logger.info('Integration health refresh triggered', { userId: user.id });
      return this.integrationStatusService.refreshHealth();
    });
  };
}
