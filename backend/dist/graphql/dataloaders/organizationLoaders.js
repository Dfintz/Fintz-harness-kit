"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrganizationByIdLoader = createOrganizationByIdLoader;
exports.createOrganizationsByUserIdLoader = createOrganizationsByUserIdLoader;
const dataloader_1 = __importDefault(require("dataloader"));
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const logger_1 = require("../../utils/logger");
const types_1 = require("./types");
function createOrganizationByIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (organizationIds) => {
        try {
            const organizationRepository = database_1.AppDataSource.getRepository(Organization_1.Organization);
            const organizations = await organizationRepository.find({
                where: { id: (0, typeorm_1.In)([...organizationIds]) },
            });
            const orgMap = new Map();
            organizations.forEach((org) => orgMap.set(org.id, org));
            return organizationIds.map((id) => orgMap.get(id) ?? null);
        }
        catch (error) {
            logger_1.logger.error('Error in organizationByIdLoader:', error);
            return organizationIds.map(() => null);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createOrganizationsByUserIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (userIds) => {
        try {
            const membershipRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
            const memberships = await membershipRepository
                .createQueryBuilder('membership')
                .leftJoinAndSelect('membership.organization', 'organization')
                .where('membership.userId IN (:...userIds)', {
                userIds: [...userIds],
            })
                .andWhere('membership.status = :status', { status: 'active' })
                .getMany();
            const orgsByUserId = new Map();
            userIds.forEach((id) => orgsByUserId.set(id, []));
            memberships.forEach((membership) => {
                if (membership.organization) {
                    const orgs = orgsByUserId.get(membership.userId);
                    if (orgs) {
                        orgs.push(membership.organization);
                    }
                }
            });
            return userIds.map((id) => orgsByUserId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in organizationsByUserIdLoader:', error);
            return userIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
//# sourceMappingURL=organizationLoaders.js.map