/**
 * RSI Verification Controller
 *
 * Handles RSI account verification endpoints for authenticating
 * that users are the owners of their claimed RSI accounts
 */

import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { RsiVerificationService, rsiVerificationAnalytics } from '../services/rsi';
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../utils/apiErrors';
import { logger } from '../utils/logger';

import { BaseController } from './BaseController';

/**
 * Request body for initiating RSI verification
 */
interface InitiateVerificationBody {
  rsiHandle: string;
}

/**
 * Request body for initiating RSI organization verification
 */
interface InitiateOrgVerificationBody {
  orgId: string;
  rsiOrgSid: string;
}

/**
 * Request body for completing RSI organization verification
 */
interface CompleteOrgVerificationBody {
  orgId: string;
}

/**
 * Request body for verifying organization ownership
 */
interface VerifyOrganizationBody {
  orgSid: string;
}

/**
 * Request body for rank-based RSI organization verification
 */
interface VerifyOrgByRankBody {
  orgId: string;
  rsiOrgSid: string;
}

/**
 * RSI Verification Controller
 * Manages RSI account ownership verification through the Sentry API
 */
export class RsiVerificationController extends BaseController {
  private readonly rsiVerificationService: RsiVerificationService;

  constructor() {
    super();
    this.rsiVerificationService = new RsiVerificationService();
  }

  /**
   * Initiate RSI handle verification
   * POST /api/rsi/verify/initiate
   *
   * Generates a verification code that the user must add to their RSI bio
   *
   * @param req - Authenticated request with rsiHandle in body
   * @param res - Response with verification code
   */
  public initiateVerification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      this.validateRequired(req.body, 'rsiHandle');

      const body = req.body as InitiateVerificationBody;

      const result = await this.rsiVerificationService.initiateVerification(
        user.id,
        body.rsiHandle
      );

      if (!result.success) {
        if (result.isExternalError) {
          throw new ServiceUnavailableError(result.error ?? 'RSI API is temporarily unavailable');
        }
        throw new ValidationError(result.error ?? 'Verification initiation failed');
      }

      logger.info(`RSI verification initiated for user ${user.id}`);

      return {
        message:
          'Verification initiated. Add the verification link to your RSI bio — ' +
          "we'll detect it automatically.",
        verificationCode: result.verificationCode,
        verificationUrl: result.verificationUrl,
        expiresAt: result.expiresAt,
        rsiHandle: result.rsiHandle,
        instructions: [
          '1. Log in to your RSI account at robertsspaceindustries.com',
          '2. Edit your profile Short Bio',
          '3. Paste the verification link anywhere in your bio',
          '4. Save your profile changes',
          "5. We'll detect it automatically within a couple of minutes — or click \"Verify Now\"",
        ],
      };
    });
  };

  /**
   * Complete RSI handle verification
   * POST /api/rsi/verify/complete
   *
   * Checks if the verification code is present in the user's RSI bio
   *
   * @param req - Authenticated request
   * @param res - Response with verification result
   */
  public completeVerification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);

      const result = await this.rsiVerificationService.completeVerification(user.id);

      if (!result.success) {
        throw new ValidationError(result.error ?? 'Verification failed');
      }

      logger.info(`RSI verification completed for user ${user.id}, handle: ${result.rsiHandle}`);

      return {
        message: 'RSI account verification successful!',
        verified: result.verified,
        rsiHandle: result.rsiHandle,
        displayName: result.displayName,
      };
    });
  };

  /**
   * Get RSI verification status
   * GET /api/rsi/verify/status
   *
   * Returns the current RSI verification status for the authenticated user
   *
   * @param req - Authenticated request
   * @param res - Response with verification status
   */
  public getVerificationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);

      const status = await this.rsiVerificationService.getVerificationStatus(user.id);

      return status;
    });
  };

  /**
   * Remove RSI verification
   * DELETE /api/rsi/verify
   *
   * Removes the RSI handle verification from the user's account
   *
   * @param req - Authenticated request
   * @param res - Response with success status
   */
  public removeVerification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);

      const result = await this.rsiVerificationService.removeVerification(user.id);

      if (!result.success) {
        throw new ValidationError(result.error ?? 'Failed to remove verification');
      }

      logger.info(`RSI verification removed for user ${user.id}`);

      return {
        message: 'RSI verification removed successfully',
      };
    });
  };

  /**
   * Initiate RSI organization verification
   * POST /api/rsi/verify/organization/initiate
   *
   * Generates a verification code that must be added to the RSI organization description
   *
   * @param req - Authenticated request with orgId and rsiOrgSid in body
   * @param res - Response with verification code
   */
  public initiateOrganizationVerification = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      this.validateRequired(req.body, 'orgId');
      this.validateRequired(req.body, 'rsiOrgSid');

      const body = req.body as InitiateOrgVerificationBody;

      const result = await this.rsiVerificationService.initiateOrganizationVerification(
        user.id,
        body.orgId,
        body.rsiOrgSid
      );

      if (!result.success) {
        throw new ValidationError(result.error ?? 'Organization verification initiation failed');
      }

      logger.info(
        `RSI organization verification initiated for org ${body.orgId} by user ${user.id}`
      );

      return {
        message:
          'Verification initiated. Add the verification link to your RSI organization page — ' +
          "we'll detect it automatically.",
        verificationCode: result.verificationCode,
        verificationUrl: result.verificationUrl,
        expiresAt: result.expiresAt,
        rsiOrgSid: result.rsiHandle,
        instructions: [
          '1. Log in to your RSI account at robertsspaceindustries.com',
          '2. Navigate to your organization page',
          '3. Edit your organization settings',
          '4. Paste the verification link into your Introduction, History, Manifesto, or Charter',
          '5. Save your organization changes',
          "6. We'll detect it automatically within a couple of minutes — or click \"Verify Now\"",
        ],
      };
    });
  };

  /**
   * Complete RSI organization verification
   * POST /api/rsi/verify/organization/complete
   *
   * Checks if the verification code is present in the organization's RSI description
   *
   * @param req - Authenticated request with orgId in body
   * @param res - Response with verification result
   */
  public completeOrganizationVerification = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      this.validateRequired(req.body, 'orgId');

      const body = req.body as CompleteOrgVerificationBody;

      const result = await this.rsiVerificationService.completeOrganizationVerification(
        user.id,
        body.orgId
      );

      if (!result.success) {
        throw new ValidationError(result.error ?? 'Organization verification failed');
      }

      logger.info(
        `RSI organization verification completed for org ${body.orgId}, SID: ${result.rsiHandle}`
      );

      return {
        message: 'RSI organization verification successful!',
        verified: result.verified,
        rsiOrgSid: result.rsiHandle,
        orgName: result.displayName,
      };
    });
  };

  /**
   * Verify RSI organization by rank (no code required)
   * POST /api/rsi/verify/organization/rank
   *
   * Verifies the organization if the user holds a 5-star rank, Founder, or Officer role on RSI
   *
   * @param req - Authenticated request with orgId and rsiOrgSid in body
   * @param res - Response with verification result
   */
  public verifyOrganizationByRank = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      this.validateRequired(req.body, 'orgId');
      this.validateRequired(req.body, 'rsiOrgSid');

      const body = req.body as VerifyOrgByRankBody;

      const result = await this.rsiVerificationService.verifyOrganizationByRank(
        user.id,
        body.orgId,
        body.rsiOrgSid
      );

      if (!result.success) {
        throw new ValidationError(result.error ?? 'Rank-based organization verification failed');
      }

      logger.info(`RSI organization verified by rank for org ${body.orgId} by user ${user.id}`);

      return {
        message: 'RSI organization verified by rank!',
        verified: result.verified,
        rsiOrgSid: result.rsiHandle,
        orgName: result.displayName,
      };
    });
  };

  /**
   * Verify organization ownership
   * POST /api/rsi/verify/organization
   *
   * Checks if the authenticated user is an owner/admin of the specified RSI organization
   *
   * @param req - Authenticated request with orgSid in body
   * @param res - Response with organization ownership verification result
   */
  public verifyOrganizationOwnership = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      this.validateRequired(req.body, 'orgSid');

      const body = req.body as VerifyOrganizationBody;

      const result = await this.rsiVerificationService.verifyOrganizationOwnership(
        user.id,
        body.orgSid
      );

      if (!result.success) {
        throw new ValidationError(result.error ?? 'Organization verification failed');
      }

      return {
        orgSid: result.orgSid,
        orgName: result.orgName,
        isOwner: result.isOwner,
        isAdmin: result.isAdmin,
        userRank: result.userRank,
      };
    });
  };

  /**
   * Lookup RSI user profile (public)
   * GET /api/rsi/user/:handle
   *
   * Looks up RSI user profile data without requiring authentication
   *
   * @param req - Request with RSI handle in params
   * @param res - Response with RSI user data
   */
  public lookupRsiUser = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.validateRequired(req.params, 'handle');

      const { handle } = req.params;

      const result = await this.rsiVerificationService.lookupRsiUser(handle);

      if (!result.verified) {
        throw new NotFoundError('RSI user');
      }

      return {
        handle: result.handle,
        displayName: result.displayName,
        bio: result.bio,
        organizations: result.organizations,
      };
    });
  };

  /**
   * Lookup RSI organization (public)
   * GET /api/rsi/organization/:sid
   *
   * Looks up RSI organization data without requiring authentication
   *
   * @param req - Request with organization SID in params
   * @param res - Response with RSI organization data
   */
  public lookupRsiOrganization = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.validateRequired(req.params, 'sid');

      const { sid } = req.params;

      const result = await this.rsiVerificationService.lookupRsiOrganization(sid);

      if (!result.found) {
        throw new NotFoundError('RSI organization');
      }

      return result.data;
    });
  };

  /**
   * Get verification analytics (admin only)
   * GET /api/rsi/verify/analytics
   *
   * Returns verification metrics for the last 24 hours
   *
   * @param req - Authenticated request (admin required)
   * @param res - Response with analytics snapshot
   */
  public getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);

      if (user.role !== 'admin') {
        throw new ForbiddenError('Admin access required');
      }

      return rsiVerificationAnalytics.getSnapshot();
    });
  };
}
