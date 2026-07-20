"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicStatsController = void 0;
exports.clearPublicStatsCache = clearPublicStatsCache;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const AllianceDiplomacy_1 = require("../../models/AllianceDiplomacy");
const Federation_1 = require("../../models/Federation");
const Fleet_1 = require("../../models/Fleet");
const PublicJobListing_1 = require("../../models/PublicJobListing");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const User_1 = require("../../models/User");
const UserShip_1 = require("../../models/UserShip");
const api_1 = require("../../types/api");
const logger_1 = require("../../utils/logger");
let cachedStats = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
function clearPublicStatsCache() {
    cachedStats = null;
    cacheExpiry = 0;
}
class PublicStatsController {
    async getPublicStats(_req, res) {
        try {
            const now = Date.now();
            if (cachedStats && now < cacheExpiry) {
                res.success(cachedStats);
                return;
            }
            const [publicOrganizations, activeAllianceCount, publicFederations, users, publicJobListings, shipsTracked, fleetsTracked,] = await Promise.all([
                database_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile).count({
                    where: { isPublic: true },
                }),
                database_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy).count({
                    where: { status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
                }),
                database_1.AppDataSource.getRepository(Federation_1.Federation).count({
                    where: [
                        { isPublic: true, status: 'active' },
                        { isPublic: true, status: 'forming' },
                    ],
                }),
                database_1.AppDataSource.getRepository(User_1.User).count(),
                database_1.AppDataSource.getRepository(PublicJobListing_1.PublicJobListing).count({
                    where: {
                        isActive: true,
                    },
                }),
                database_1.AppDataSource.getRepository(UserShip_1.UserShip).count(),
                database_1.AppDataSource.getRepository(Fleet_1.Fleet).count({
                    where: { status: (0, typeorm_1.In)([Fleet_1.FleetStatus.ACTIVE, Fleet_1.FleetStatus.DEPLOYED]) },
                }),
            ]);
            const publicAlliances = activeAllianceCount + publicFederations;
            const stats = {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch public stats', { error });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch platform statistics', undefined, 500);
        }
    }
}
exports.PublicStatsController = PublicStatsController;
//# sourceMappingURL=publicStatsController.js.map