"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationDispatcher = exports.NotificationDispatcher = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Notification_1 = require("../../models/Notification");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const NotificationService_1 = require("../communication/notifications/NotificationService");
const ADMIN_ROLES = ['admin', 'superadmin'];
class NotificationDispatcher {
    static instance;
    notificationService;
    constructor(notificationService) {
        this.notificationService = notificationService ?? new NotificationService_1.NotificationService();
    }
    static getInstance() {
        if (!NotificationDispatcher.instance) {
            NotificationDispatcher.instance = new NotificationDispatcher();
        }
        return NotificationDispatcher.instance;
    }
    get userRepo() {
        return database_1.AppDataSource.getRepository(User_1.User);
    }
    async getPlatformAdminIds() {
        const admins = await this.userRepo.find({
            where: { role: (0, typeorm_1.In)(ADMIN_ROLES) },
            select: ['id'],
        });
        return admins.map(a => a.id);
    }
    async notifyPlatformAdmins(title, message, options = {}) {
        const adminIds = await this.getPlatformAdminIds();
        if (adminIds.length === 0) {
            logger_1.logger.warn('NotificationDispatcher: no platform admins found for alert', { title });
            return 0;
        }
        const type = options.type ?? Notification_1.NotificationType.ERROR;
        const priority = options.priority ?? Notification_1.NotificationPriority.HIGH;
        let delivered = 0;
        await Promise.all(adminIds.map(async (userId) => {
            const result = await this.notificationService.create({
                userId,
                type,
                title,
                message,
                priority,
                data: options.data,
            });
            if (result.success) {
                delivered += 1;
            }
        }));
        logger_1.logger.info('NotificationDispatcher: platform admin alert dispatched', {
            title,
            type,
            priority,
            adminCount: adminIds.length,
            delivered,
        });
        return delivered;
    }
}
exports.NotificationDispatcher = NotificationDispatcher;
exports.notificationDispatcher = NotificationDispatcher.getInstance();
//# sourceMappingURL=NotificationDispatcher.js.map