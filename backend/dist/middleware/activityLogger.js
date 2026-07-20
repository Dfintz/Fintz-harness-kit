"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSpecificAction = exports.activityLogger = exports.ActivityLoggerMiddleware = void 0;
const user_1 = require("../services/user");
const logger_1 = require("../utils/logger");
class ActivityLoggerMiddleware {
    activityService;
    excludedPaths;
    excludedMethods;
    constructor() {
        this.activityService = new user_1.UserActivityService();
        this.excludedPaths = new Set([
            '/api/health',
            '/api/ping',
            '/api/status',
            '/api/users/me/activity',
        ]);
        this.excludedMethods = new Set([]);
    }
    determineAction(req) {
        const { method, path } = req;
        if (path.includes('/login')) {
            return 'auth.login';
        }
        if (path.includes('/logout')) {
            return 'auth.logout';
        }
        if (path.includes('/forgot-password')) {
            return 'auth.password_reset_requested';
        }
        if (path.includes('/reset-password')) {
            return 'auth.password_reset_completed';
        }
        if (path.includes('/change-password')) {
            return 'user.password_changed';
        }
        switch (method) {
            case 'POST':
                return 'resource.created';
            case 'PATCH':
            case 'PUT':
                return 'resource.updated';
            case 'DELETE':
                return 'resource.deleted';
            case 'GET':
                return 'resource.viewed';
            default:
                return 'resource.accessed';
        }
    }
    shouldLog(req) {
        if (!req.user?.id) {
            return false;
        }
        if (this.excludedPaths.has(req.path)) {
            return false;
        }
        if (this.excludedMethods.has(req.method)) {
            return false;
        }
        return true;
    }
    logActivity = async (req, res, next) => {
        req.startTime = Date.now();
        if (!this.shouldLog(req)) {
            next();
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            next();
            return;
        }
        const action = this.determineAction(req);
        const resource = req.path;
        const method = req.method;
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent');
        const originalSend = res.send;
        let logged = false;
        const activityService = this.activityService;
        res.send = (function (body) {
            if (!logged) {
                logged = true;
                const statusCode = res.statusCode;
                const duration = req.startTime ? Date.now() - req.startTime : undefined;
                setImmediate(async () => {
                    try {
                        const payload = {
                            userId,
                            action,
                            resource,
                            method,
                            ipAddress,
                            userAgent,
                            statusCode,
                            duration,
                            metadata: {
                                query: req.query,
                                params: req.params
                            }
                        };
                        await activityService?.logActivity(payload);
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to log user activity:', error);
                    }
                });
            }
            return originalSend.call(this, body);
        }).bind(res);
        next();
    };
    static async logSpecificAction(req, action, metadata) {
        if (!req.user?.id) {
            return;
        }
        const activityService = new user_1.UserActivityService();
        const payload = {
            userId: req.user.id,
            action,
            resource: req.path,
            method: req.method,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata
        };
        try {
            await activityService.logActivity(payload);
        }
        catch (error) {
            logger_1.logger.error('Failed to log specific action:', error);
        }
    }
}
exports.ActivityLoggerMiddleware = ActivityLoggerMiddleware;
exports.activityLogger = new ActivityLoggerMiddleware().logActivity;
exports.logSpecificAction = ActivityLoggerMiddleware.logSpecificAction;
//# sourceMappingURL=activityLogger.js.map