/**
 * Member Profile Controller
 *
 * REST endpoint for aggregated member intel profiles.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase E)
 */
import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { MemberProfileService } from '../../services/intel/MemberProfileService';
import { BaseController } from '../BaseController';

export class MemberProfileController extends BaseController {
  private profileService: MemberProfileService | null = null;

  private getService(): MemberProfileService {
    this.profileService ??= new MemberProfileService();
    return this.profileService;
  }

  /* ─── GET /members/:userId/profile ─────────────────────────────── */

  public getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, userId } = req.params;
      const viewerId = req.user?.id;
      const isPlatformAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
      return this.getService().getProfile(orgId, userId, viewerId, isPlatformAdmin);
    });
  };
}
