/**
 * Public Stats Controller (v2)
 *
 * Provides public platform statistics for the landing page.
 * No authentication required — rate-limited only.
 */

import { Request, Response } from 'express';
import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { AllianceDiplomacy, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import { Federation } from '../../models/Federation';
import { Fleet, FleetStatus } from '../../models/Fleet';
import { PublicJobListing } from '../../models/PublicJobListing';
import { PublicOrgProfile } from '../../models/PublicOrgProfile';
import { User } from '../../models/User';
import { UserShip } from '../../models/UserShip';
import { ApiErrorCode } from '../../types/api';
import { logger } from '../../utils/logger';

interface PublicStats {
  publicOrganizations: number;
  publicAlliances: number;
  publicFederations: number;
  users: number;
  publicJobListings: number;
  shipsTracked: number;
  fleetsTracked: number;
}

// Cache stats for 5 minutes to avoid hammering the DB on a public endpoint
let cachedStats: PublicStats | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Clear the module-level cache (for testing)
 * @internal
 */
export function clearPublicStatsCache(): void {
  cachedStats = null;
  cacheExpiry = 0;
}

export class PublicStatsController {
  async getPublicStats(_req: Request, res: Response): Promise<void> {
    try {
      const now = Date.now();

      if (cachedStats && now < cacheExpiry) {
        res.success(cachedStats);
        return;
      }

      const [
        publicOrganizations,
        activeAllianceCount,
        publicFederations,
        users,
        publicJobListings,
        shipsTracked,
        fleetsTracked,
      ] = await Promise.all([
        AppDataSource.getRepository(PublicOrgProfile).count({
          where: { isPublic: true },
        }),
        AppDataSource.getRepository(AllianceDiplomacy).count({
          where: { status: DiplomacyStatus.ACTIVE },
        }),
        AppDataSource.getRepository(Federation).count({
          where: [
            { isPublic: true, status: 'active' },
            { isPublic: true, status: 'forming' },
          ],
        }),
        AppDataSource.getRepository(User).count(),
        AppDataSource.getRepository(PublicJobListing).count({
          where: {
            isActive: true,
          },
        }),
        AppDataSource.getRepository(UserShip).count(),
        AppDataSource.getRepository(Fleet).count({
          where: { status: In([FleetStatus.ACTIVE, FleetStatus.DEPLOYED]) },
        }),
      ]);

      const publicAlliances = activeAllianceCount + publicFederations;

      const stats: PublicStats = {
        publicOrganizations,
        publicAlliances,
        publicFederations,
        users,
        publicJobListings,
        shipsTracked,
        fleetsTracked,
      };

      cachedStats = stats;
      cacheExpiry = now + CACHE_TTL_MS;

      res.success(stats);
    } catch (error: unknown) {
      logger.error('Failed to fetch public stats', { error });
      res.error(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch platform statistics', undefined, 500);
    }
  }
}
