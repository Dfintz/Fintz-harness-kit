"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivityByIdLoader = createActivityByIdLoader;
exports.createActivitiesByOrganizationIdLoader = createActivitiesByOrganizationIdLoader;
exports.createActivitiesByUserIdLoader = createActivitiesByUserIdLoader;
const dataloader_1 = __importDefault(require("dataloader"));
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Activity_1 = require("../../models/Activity");
const logger_1 = require("../../utils/logger");
const types_1 = require("./types");
function createActivityByIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (activityIds) => {
        try {
            const activityRepository = database_1.AppDataSource.getRepository(Activity_1.Activity);
            const activities = await activityRepository.find({
                where: { id: (0, typeorm_1.In)([...activityIds]) },
            });
            const activityMap = new Map();
            activities.forEach(activity => activityMap.set(activity.id, activity));
            return activityIds.map(id => activityMap.get(id) ?? null);
        }
        catch (error) {
            logger_1.logger.error('Error in activityByIdLoader:', error);
            return activityIds.map(() => null);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createActivitiesByOrganizationIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (organizationIds) => {
        try {
            const activityRepository = database_1.AppDataSource.getRepository(Activity_1.Activity);
            const activities = await activityRepository.find({
                where: { organizationId: (0, typeorm_1.In)([...organizationIds]) },
                order: { scheduledStartDate: 'DESC' },
            });
            const activitiesByOrgId = new Map();
            organizationIds.forEach(id => activitiesByOrgId.set(id, []));
            activities.forEach(activity => {
                const activityList = activity.organizationId
                    ? activitiesByOrgId.get(activity.organizationId)
                    : undefined;
                if (activityList) {
                    activityList.push(activity);
                }
            });
            return organizationIds.map(id => activitiesByOrgId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in activitiesByOrganizationIdLoader:', error);
            return organizationIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
function createActivitiesByUserIdLoader(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return new dataloader_1.default(async (userIds) => {
        try {
            const activityRepository = database_1.AppDataSource.getRepository(Activity_1.Activity);
            const activities = await activityRepository
                .createQueryBuilder('activity')
                .where('activity.creatorId IN (:...userIds)', { userIds: [...userIds] })
                .orderBy('activity.scheduledStartDate', 'DESC')
                .getMany();
            const activitiesByUserId = new Map();
            userIds.forEach(id => activitiesByUserId.set(id, []));
            activities.forEach(activity => {
                if (activity.creatorId && userIds.includes(activity.creatorId)) {
                    const activityList = activitiesByUserId.get(activity.creatorId);
                    if (activityList) {
                        activityList.push(activity);
                    }
                }
            });
            return userIds.map(id => activitiesByUserId.get(id) ?? []);
        }
        catch (error) {
            logger_1.logger.error('Error in activitiesByUserIdLoader:', error);
            return userIds.map(() => []);
        }
    }, {
        cache: options.cache ?? true,
        maxBatchSize: options.maxBatchSize ?? 100,
    });
}
//# sourceMappingURL=activityLoaders.js.map