/**
 * NotificationDispatcher
 *
 * Thin orchestration layer over `NotificationService` for system-level
 * notifications (rate-limit alerts, webhook circuit breakers, security
 * events). Resolves recipient cohorts (e.g. all platform admins) and fans
 * out an in-app notification for each.
 *
 * This is intentionally not a TypeORM service — it composes existing
 * services and repositories. Swallows errors per-recipient so a single
 * failed send never blocks the rest of the dispatch.
 */
import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { NotificationPriority, NotificationType } from '../../models/Notification';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { NotificationService } from '../communication/notifications/NotificationService';

const ADMIN_ROLES = ['admin', 'superadmin'] as const;

export interface AdminAlertOptions {
  type?: NotificationType;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
}

export class NotificationDispatcher {
  private static instance: NotificationDispatcher;
  private readonly notificationService: NotificationService;

  private constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService ?? new NotificationService();
  }

  static getInstance(): NotificationDispatcher {
    if (!NotificationDispatcher.instance) {
      NotificationDispatcher.instance = new NotificationDispatcher();
    }
    return NotificationDispatcher.instance;
  }

  private get userRepo(): Repository<User> {
    return AppDataSource.getRepository(User);
  }

  /**
   * Get all platform admin user IDs.
   */
  async getPlatformAdminIds(): Promise<string[]> {
    const admins = await this.userRepo.find({
      where: { role: In(ADMIN_ROLES as unknown as string[]) },
      select: ['id'],
    });
    return admins.map(a => a.id);
  }

  /**
   * Dispatch an in-app notification to every platform admin.
   * Returns the number of recipients successfully notified.
   */
  async notifyPlatformAdmins(
    title: string,
    message: string,
    options: AdminAlertOptions = {}
  ): Promise<number> {
    const adminIds = await this.getPlatformAdminIds();
    if (adminIds.length === 0) {
      logger.warn('NotificationDispatcher: no platform admins found for alert', { title });
      return 0;
    }

    const type = options.type ?? NotificationType.ERROR;
    const priority = options.priority ?? NotificationPriority.HIGH;

    let delivered = 0;
    await Promise.all(
      adminIds.map(async userId => {
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
      })
    );

    logger.info('NotificationDispatcher: platform admin alert dispatched', {
      title,
      type,
      priority,
      adminCount: adminIds.length,
      delivered,
    });

    return delivered;
  }
}

export const notificationDispatcher = NotificationDispatcher.getInstance();

