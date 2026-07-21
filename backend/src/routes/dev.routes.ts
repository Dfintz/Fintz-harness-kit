/**
 * Development-Only Routes
 *
 * Contains testing utilities, seeding endpoints, and debug features.
 * SECURITY: All routes gated by ALLOW_DEV_LOGIN environment variable.
 * Must NOT be exposed in production.
 *
 * These endpoints are for E2E testing and development only.
 * They should never be accessible in production deployments.
 */

import { Response, Router } from 'express';
import Joi from 'joi';
import { nanoid } from 'nanoid';
import { container } from 'tsyringe';

import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { OrganizationType, OrganizationStatus } from '../models/Organization';
import { User } from '../models/User';
import { FleetService } from '../services/fleet/FleetService';
import { OrganizationService } from '../services/organization/OrganizationService';
import { ShipService } from '../services/ship/ShipService';
import { ValidationError, UnauthorizedError } from '../utils/apiErrors';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Security Check: Ensure dev mode is enabled
 * Every route in this file should check this condition
 */
const requireDevMode = (_req: AuthRequest, _res: Response, next: () => void) => {
  if (process.env.ALLOW_DEV_LOGIN !== 'true') {
    throw new UnauthorizedError(
      'Development endpoints are disabled. Set ALLOW_DEV_LOGIN=true to enable.'
    );
  }
  next();
};

/**
 * POST /api/v2/dev/seed
 *
 * Generates realistic demo data for E2E testing and local development.
 * Creates organizations, fleets, and ships in a hierarchical structure.
 *
 * Security:
 * - Requires ALLOW_DEV_LOGIN=true environment variable
 * - Requests are logged for audit purposes
 *
 * Request Body:
 * {
 *   "organizations": 2,
 *   "fleetsPerOrg": 3,
 *   "shipsPerFleet": 5
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "seedId": "abc12345",
 *   "organizationsCreated": 2,
 *   "fleetsCreated": 6,
 *   "shipsCreated": 30,
 *   "totalResourcesCreated": 38
 * }
 */
const seedSchema = Joi.object({
  organizations: Joi.number().integer().min(1).max(10).default(1),
  fleetsPerOrg: Joi.number().integer().min(1).max(20).default(2),
  shipsPerFleet: Joi.number().integer().min(1).max(50).default(3),
});

router.post(
  '/seed',
  requireDevMode,
  validateSchema(seedSchema, 'body'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        organizations: orgCount,
        fleetsPerOrg: fleetsCount,
        shipsPerFleet: shipsCount,
      } = req.body as Record<string, number>;
      const userId = req.user?.id ?? 'dev-seed-user';
      const seedId = nanoid(8);

      logger.info('dev-seed: starting data generation', {
        userId,
        seedId,
        orgCount,
        fleetsCount,
        shipsCount,
      });

      let organizationsCreated = 0;
      let fleetsCreated = 0;
      let shipsCreated = 0;

      // Ensure dev user exists in database
      // For development only: create a minimal user record if it doesn't exist
      const userRepository = AppDataSource.getRepository(User);
      let devUser = await userRepository.findOne({ where: { id: userId } });
      if (!devUser) {
        devUser = userRepository.create({
          id: userId,
          username: 'dev-seed-user',
          email: `${userId}@dev.local`,
          discordId: `dev-${nanoid(12)}`, // Required field - generate unique ID
          role: 'ADMIN',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await userRepository.save(devUser);
        logger.info('dev-seed: created dev user', { userId });
      }

      const orgService = container.resolve(OrganizationService);
      const fleetService = container.resolve(FleetService);
      const shipService = container.resolve(ShipService);

      // Create organizations and their hierarchies
      for (let orgIdx = 0; orgIdx < orgCount; orgIdx++) {
        try {
          // Create organization
          const orgName = `Test Org ${seedId}-${orgIdx + 1}`;
          const org = await orgService.createOrganization(
            {
              name: orgName,
              description: `Demo organization created by seeding endpoint (${seedId})`,
              type: OrganizationType.ROOT,
              status: OrganizationStatus.ACTIVE,
            },
            userId
          );
          organizationsCreated++;

          // Create fleets for this organization
          for (let fleetIdx = 0; fleetIdx < fleetsCount; fleetIdx++) {
            try {
              const fleetName = `${orgName} Fleet ${fleetIdx + 1}`;
              const _fleet = await fleetService.createFleet(org.id, {
                name: fleetName,
                description: `Demo fleet created by seeding endpoint (${seedId})`,
                type: fleetIdx % 2 === 0 ? 'COMBAT' : 'TRADING',
              });
              fleetsCreated++;

              // Create ships for this fleet
              for (let shipIdx = 0; shipIdx < shipsCount; shipIdx++) {
                try {
                  const shipName = `${fleetName} Ship ${shipIdx + 1}`;
                  const shipTypes = [
                    'Cutlass Black',
                    'Drake Interceptor',
                    'Anvil F7C',
                    'MISC Prospector',
                  ];
                  const manufacturers = [
                    'Anvil Aerospace',
                    'Drake Interplanetary',
                    'Crusader Industries',
                    'MISC',
                  ];

                  const _ship = await shipService.create(org.id, {
                    id: `ship-${nanoid(12)}`,
                    name: shipName,
                    manufacturer: manufacturers[shipIdx % 4],
                    role: shipTypes[shipIdx % 4],
                  });
                  shipsCreated++;
                } catch (shipError) {
                  logger.warn('dev-seed: ship creation failed, continuing', {
                    seedId,
                    error: shipError instanceof Error ? shipError.message : String(shipError),
                  });
                }
              }
            } catch (fleetError) {
              logger.warn('dev-seed: fleet creation failed, continuing', {
                seedId,
                error: fleetError instanceof Error ? fleetError.message : String(fleetError),
              });
            }
          }
        } catch (orgError) {
          logger.warn('dev-seed: organization creation failed, continuing', {
            seedId,
            error: orgError instanceof Error ? orgError.message : String(orgError),
          });
        }
      }

      logger.info('dev-seed: completed successfully', {
        userId,
        seedId,
        organizationsCreated,
        fleetsCreated,
        shipsCreated,
      });

      res.status(200).json({
        success: true,
        seedId,
        organizationsCreated,
        fleetsCreated,
        shipsCreated,
        totalResourcesCreated: organizationsCreated + fleetsCreated + shipsCreated,
      });
    } catch (error) {
      logger.error('dev-seed: error during data generation', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ValidationError) {
        const errorDetails =
          'details' in error ? (error as unknown as Record<string, unknown>).details : undefined;
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: errorDetails,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'SEED_ERROR',
          message: 'Failed to generate demo data',
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
);

export { router };
