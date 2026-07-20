"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserByIdLoader = createUserByIdLoader;
exports.createUsersByOrganizationIdLoader = createUsersByOrganizationIdLoader;
const dataloader_1 = __importDefault(require("dataloader"));
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const types_1 = require("./types");
function createUserByIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (userIds) => {
        try {
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const users = await userRepository.find({
                where: { id: (0, typeorm_1.In)([...userIds]) },
            });
            const userMap = new Map();
            users.forEach((user) => userMap.set(user.id, user));
            return userIds.map((id) => userMap.get(id) ?? null);
        }
        catch (error) {
            logger_1.logger.error('Error in userByIdLoader:', error);
            return userIds.map(() => null);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createUsersByOrganizationIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (organizationIds) => {
        try {
            const membershipRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
            const memberships = await membershipRepository
                .createQueryBuilder('membership')
                .leftJoinAndSelect('membership.user', 'user')
                .where('membership.organizationId IN (:...organizationIds)', {
                organizationIds: [...organizationIds],
            })
                .andWhere('membership.status = :status', { status: 'active' })
                .getMany();
            const usersByOrgId = new Map();
            organizationIds.forEach((id) => usersByOrgId.set(id, []));
            memberships.forEach((membership) => {
                if (membership.user) {
                    const users = usersByOrgId.get(membership.organizationId);
                    if (users) {
                        users.push(membership.user);
                    }
                }
            });
            return organizationIds.map((id) => usersByOrgId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in usersByOrganizationIdLoader:', error);
            return organizationIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
//# sourceMappingURL=userLoaders.js.map