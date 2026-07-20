"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const nanoid_1 = require("nanoid");
const tsyringe_1 = require("tsyringe");
const database_1 = require("../config/database");
const schemaValidation_1 = require("../middleware/schemaValidation");
const Organization_1 = require("../models/Organization");
const User_1 = require("../models/User");
const FleetService_1 = require("../services/fleet/FleetService");
const OrganizationService_1 = require("../services/organization/OrganizationService");
const ShipService_1 = require("../services/ship/ShipService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
const requireDevMode = (_req, _res, next) => {
    if (process.env.ALLOW_DEV_LOGIN !== 'true') {
        throw new apiErrors_1.UnauthorizedError('Development endpoints are disabled. Set ALLOW_DEV_LOGIN=true to enable.');
    }
    next();
};
const seedSchema = joi_1.default.object({
    organizations: joi_1.default.number().integer().min(1).max(10).default(1),
    fleetsPerOrg: joi_1.default.number().integer().min(1).max(20).default(2),
    shipsPerFleet: joi_1.default.number().integer().min(1).max(50).default(3),
});
router.post('/seed', requireDevMode, (0, schemaValidation_1.validateSchema)(seedSchema, 'body'), async (req, res) => {
    try {
        const { organizations: orgCount, fleetsPerOrg: fleetsCount, shipsPerFleet: shipsCount, } = req.body;
        const userId = req.user?.id ?? 'dev-seed-user';
        const seedId = (0, nanoid_1.nanoid)(8);
        logger_1.logger.info('dev-seed: starting data generation', {
            userId,
            seedId,
            orgCount,
            fleetsCount,
            shipsCount,
        });
        let organizationsCreated = 0;
        let fleetsCreated = 0;
        let shipsCreated = 0;
        const userRepository = database_1.AppDataSource.getRepository(User_1.User);
        let devUser = await userRepository.findOne({ where: { id: userId } });
        if (!devUser) {
            devUser = userRepository.create({
                id: userId,
                username: 'dev-seed-user',
                email: `${userId}@dev.local`,
                discordId: `dev-${(0, nanoid_1.nanoid)(12)}`,
                role: 'ADMIN',
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            await userRepository.save(devUser);
            logger_1.logger.info('dev-seed: created dev user', { userId });
        }
        const orgService = tsyringe_1.container.resolve(OrganizationService_1.OrganizationService);
        const fleetService = tsyringe_1.container.resolve(FleetService_1.FleetService);
        const shipService = tsyringe_1.container.resolve(ShipService_1.ShipService);
        for (let orgIdx = 0; orgIdx < orgCount; orgIdx++) {
            try {
                const orgName = `Test Org ${seedId}-${orgIdx + 1}`;
                const org = await orgService.createOrganization({
                    name: orgName,
                    description: `Demo organization created by seeding endpoint (${seedId})`,
                    type: Organization_1.OrganizationType.ROOT,
                    status: Organization_1.OrganizationStatus.ACTIVE,
                }, userId);
                organizationsCreated++;
                for (let fleetIdx = 0; fleetIdx < fleetsCount; fleetIdx++) {
                    try {
                        const fleetName = `${orgName} Fleet ${fleetIdx + 1}`;
                        const _fleet = await fleetService.createFleet(org.id, {
                            name: fleetName,
                            description: `Demo fleet created by seeding endpoint (${seedId})`,
                            type: fleetIdx % 2 === 0 ? 'COMBAT' : 'TRADING',
                        });
                        fleetsCreated++;
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
                                    id: `ship-${(0, nanoid_1.nanoid)(12)}`,
                                    name: shipName,
                                    manufacturer: manufacturers[shipIdx % 4],
                                    role: shipTypes[shipIdx % 4],
                                });
                                shipsCreated++;
                            }
                            catch (shipError) {
                                logger_1.logger.warn('dev-seed: ship creation failed, continuing', {
                                    seedId,
                                    error: shipError instanceof Error ? shipError.message : String(shipError),
                                });
                            }
                        }
                    }
                    catch (fleetError) {
                        logger_1.logger.warn('dev-seed: fleet creation failed, continuing', {
                            seedId,
                            error: fleetError instanceof Error ? fleetError.message : String(fleetError),
                        });
                    }
                }
            }
            catch (orgError) {
                logger_1.logger.warn('dev-seed: organization creation failed, continuing', {
                    seedId,
                    error: orgError instanceof Error ? orgError.message : String(orgError),
                });
            }
        }
        logger_1.logger.info('dev-seed: completed successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('dev-seed: error during data generation', {
            userId: req.user?.id,
            error: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof apiErrors_1.ValidationError) {
            const errorDetails = 'details' in error ? error.details : undefined;
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
});
//# sourceMappingURL=dev.routes.js.map