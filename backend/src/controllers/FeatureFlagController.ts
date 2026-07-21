/**
 * Feature Flag Controller
 * Public endpoints for client-side feature flag evaluation
 */

import { Request, Response } from 'express';

import { FeatureFlagService } from '../services/admin/FeatureFlagService';
import { ValidationError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

type AuthRequest = Request & { user?: { id?: string; activeOrgId?: string } };

export class FeatureFlagController extends BaseController {
  /**
   * GET /api/feature-flags/evaluate/:flagId
   * Evaluate a feature flag for the current user
   */
  public evaluateFlag = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { flagId } = req.params;
      const userId = (req as AuthRequest).user?.id;
      const organizationId = (req as AuthRequest).user?.activeOrgId;

      const isEnabled = await FeatureFlagService.isEnabled(flagId, userId, organizationId);

      return {
        flagId,
        enabled: isEnabled,
        timestamp: new Date().toISOString(),
      };
    });
  };

  /**
   * POST /api/feature-flags/evaluate-batch
   * Evaluate multiple feature flags at once
   */
  public evaluateBatch = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { flagIds } = req.body;

      if (!Array.isArray(flagIds)) {
        throw new ValidationError('flagIds must be an array');
      }

      const userId = (req as AuthRequest).user?.id;
      const organizationId = (req as AuthRequest).user?.activeOrgId;

      // Optimize: evaluate all flags in parallel instead of sequentially
      const evaluationPromises = flagIds.map(async flagId => {
        const enabled = await FeatureFlagService.isEnabled(flagId, userId, organizationId);
        return { flagId, enabled };
      });

      const evaluations = await Promise.all(evaluationPromises);

      const results: Record<string, boolean> = {};
      evaluations.forEach(({ flagId, enabled }) => {
        results[flagId] = enabled;
      });

      return {
        flags: results,
        timestamp: new Date().toISOString(),
      };
    });
  };

  /**
   * GET /api/feature-flags/enabled
   * Get all enabled feature flags for the current user
   */
  public getEnabledFlags = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = (req as AuthRequest).user?.id;
      const organizationId = (req as AuthRequest).user?.activeOrgId;

      const enabledFlags = await FeatureFlagService.getEnabledFeatures(userId, organizationId);

      return {
        flags: enabledFlags,
        timestamp: new Date().toISOString(),
      };
    });
  };

  /**
   * GET /api/admin/feature-flags/:id/analytics
   * Get analytics for a specific feature flag (admin only)
   */
  public getAnalytics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const analytics = await FeatureFlagService.getAnalytics(id, days);

      return analytics;
    });
  };
}
