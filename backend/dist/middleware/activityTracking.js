"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackUserActivity = void 0;
const database_1 = require("../config/database");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const trackUserActivity = async (req, res, next) => {
    const authReq = req;
    if (!authReq.user?.id) {
        next();
        return;
    }
    try {
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        void userRepo.update({ id: authReq.user.id }, { lastActiveAt: new Date() }).catch((error) => {
            logger_1.logger.warn('Failed to update user lastActiveAt', {
                userId: authReq.user?.id,
                error: error instanceof Error ? error.message : String(error)
            });
        });
        next();
    }
    catch (error) {
        logger_1.logger.warn('Error in trackUserActivity middleware', {
            userId: authReq.user?.id,
            error: error instanceof Error ? error.message : String(error)
        });
        next();
    }
};
exports.trackUserActivity = trackUserActivity;
//# sourceMappingURL=activityTracking.js.map