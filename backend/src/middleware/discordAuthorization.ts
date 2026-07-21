import { NextFunction, Response } from 'express';

import { AppDataSource } from '../config/database';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { GuildOrganizationService } from '../services/discord/GuildOrganizationService';
import { logAuthorizationFailure } from '../utils/auditLogger';
import { logger } from '../utils/logger';
import { getRoleName } from '../utils/roleUtils';

import { AuthRequest } from './auth';

/**
 * Discord Settings Authorization Middleware
 *
 * Verifies user is authorized to manage Discord settings for an organization.
 * Authorization checks:
 * 1. User is authenticated
 * 2. OrgId is provided and user is an active member
 * 3. User is organization owner or admin
 * 4. If guildId is in route params, the guild belongs to the organization
 */
export const discordAdminAuthorization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // User must be authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const { orgId, guildId } = req.params;

    if (!orgId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
      return;
    }

    // Admin users bypass all authorization checks
    if (req.user.role === 'admin') {
      logger.debug(`Admin user ${req.user.id} accessing Discord settings for org ${orgId}`);
      next();
      return;
    }

    // Step 1: Verify user belongs to the organization (fast path with JWT)
    const hasOrgInJwt = req.user.organizationIds?.includes(orgId);

    // Step 2: Query database for detailed membership information
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const membership = await membershipRepo.findOne({
      where: {
        userId: req.user.id,
        organizationId: orgId,
        isActive: true,
      },
    });

    if (!membership) {
      // Log authorization failure for audit trail
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      logAuthorizationFailure(
        req.user.id,
        req.user.username,
        req.user.role,
        `discord:organization:${orgId}`,
        req.method,
        ipAddress,
        userAgent
      );

      logger.warn(
        `Unauthorized Discord settings access attempt by user ${req.user.id} for org ${orgId}`,
        {
          userId: req.user.id,
          orgId,
          path: req.path,
          hasOrgInJwt,
        }
      );

      res.status(403).json({
        success: false,
        error: 'Not authorized to manage Discord settings for this organization',
        code: 'ORG_MEMBERSHIP_REQUIRED',
      });
      return;
    }

    // Step 3: Check if user is organization owner or admin
    const isOrgOwner =
      getRoleName(membership.role) === 'owner' || getRoleName(membership.role) === 'founder';
    const isOrgAdmin = getRoleName(membership.role) === 'admin';

    if (!isOrgOwner && !isOrgAdmin) {
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      logAuthorizationFailure(
        req.user.id,
        req.user.username,
        req.user.role,
        `discord:organization:${orgId}:admin-required`,
        req.method,
        ipAddress,
        userAgent
      );

      logger.warn(
        `Discord settings access denied - insufficient role (${getRoleName(membership.role)}) for user ${req.user.id} in org ${orgId}`
      );

      res.status(403).json({
        success: false,
        error: 'Only organization owners and admins can manage Discord settings',
        code: 'INSUFFICIENT_ROLE',
        requiredRole: 'owner or admin',
        currentRole: getRoleName(membership.role),
      });
      return;
    }

    // Step 4: If guildId is in the route, verify it belongs to this organization
    if (guildId) {
      const guildOrgService = GuildOrganizationService.getInstance();
      const guildOwnerOrgId = await guildOrgService.resolveOrganization(guildId);

      if (!guildOwnerOrgId || guildOwnerOrgId !== orgId) {
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        logAuthorizationFailure(
          req.user.id,
          req.user.username,
          req.user.role,
          `discord:guild:${guildId}:org-mismatch`,
          req.method,
          ipAddress,
          userAgent
        );

        logger.warn(
          `Discord guild ${guildId} does not belong to org ${orgId} - access denied for user ${req.user.id}`
        );

        res.status(403).json({
          success: false,
          error: 'This Discord guild is not linked to the specified organization',
          code: 'GUILD_ORG_MISMATCH',
        });
        return;
      }
    }

    // Authorization successful
    logger.debug(
      `Discord settings access granted for user ${req.user.id} (role: ${getRoleName(membership.role)}) in org ${orgId}${
        guildId ? ` for guild ${guildId}` : ''
      }`
    );

    next();
  } catch (error) {
    logger.error('Discord authorization check failed', { error });
    res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    });
  }
};
