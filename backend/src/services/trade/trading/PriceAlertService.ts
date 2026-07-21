/**
 * Price Alert Service
 *
 * Manages real-time price alerts for trading commodities.
 * Integrates with WebSocket to push notifications when price thresholds are met.
 * Alerts are persisted to the database (PriceAlert entity).
 * Subscriptions remain in-memory as they are transient real-time connections.
 */

import { Repository } from 'typeorm';

import { AppDataSource } from '../../../config/database';
import { PriceAlert, PriceAlertCondition } from '../../../models/PriceAlert';
import { logger } from '../../../utils/logger';
import { emitToRoom, emitToUser } from '../../../websocket/websocketServer';

import { uifService } from './UIFService';

/**
 * Re-export AlertCondition as alias for backward compatibility
 */
export { PriceAlertCondition as AlertCondition };

/**
 * Re-export PriceAlert interface for consumers
 */
export type { PriceAlert } from '../../../models/PriceAlert';

/**
 * Price alert event payload
 */
export interface PriceAlertEvent {
  alertId: string;
  commodity: string;
  location?: string;
  condition: PriceAlertCondition;
  threshold: number;
  currentPrice: number;
  previousPrice?: number;
  changePercent?: number;
  triggeredAt: Date;
}

/**
 * Price subscription for real-time updates
 */
interface PriceSubscription {
  commodity: string;
  location?: string;
  lastPrice?: number;
  subscribers: Set<string>; // User IDs
}

export class PriceAlertService {
  private static instance: PriceAlertService;
  private subscriptions: Map<string, PriceSubscription> = new Map();
  private priceCheckInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 60000; // Check every minute
  private readonly rateLimitDelayMs = 200; // Delay between price checks for rate limiting

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the TypeORM repository for PriceAlert (lazy-initialized)
   */
  private getRepository(): Repository<PriceAlert> {
    return AppDataSource.getRepository(PriceAlert);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PriceAlertService {
    if (!PriceAlertService.instance) {
      PriceAlertService.instance = new PriceAlertService();
    }
    return PriceAlertService.instance;
  }

  /**
   * Start price monitoring
   */
  public start(): void {
    if (this.priceCheckInterval) {
      return; // Already running
    }

    logger.info('Starting price alert service');

    this.priceCheckInterval = setInterval(() => {
      this.checkPrices().catch(error => {
        logger.error('Error checking prices:', error);
      });
    }, this.checkIntervalMs);

    // Initial check
    this.checkPrices().catch(error => {
      logger.error('Error in initial price check:', error);
    });
  }

  /**
   * Stop price monitoring
   */
  public stop(): void {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
      this.priceCheckInterval = null;
      logger.info('Price alert service stopped');
    }
  }

  /**
   * Create a new price alert (persisted to DB)
   */
  public async createAlert(alert: Omit<PriceAlert, 'id' | 'createdAt'>): Promise<PriceAlert> {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const repo = this.getRepository();

    const newAlert = repo.create({
      ...alert,
      id,
    });

    const saved = await repo.save(newAlert);

    // Add to subscription tracking
    this.addSubscription(alert.commodity, alert.location, alert.userId);

    logger.info(`Created price alert: ${id} for ${alert.commodity}`);
    return saved;
  }

  /**
   * Get alerts for a user (from DB)
   */
  public async getUserAlerts(userId: string): Promise<PriceAlert[]> {
    return this.getRepository().find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get alert by ID (from DB)
   */
  public async getAlert(alertId: string): Promise<PriceAlert | null> {
    return this.getRepository().findOne({ where: { id: alertId } });
  }

  /**
   * Update an alert (persisted to DB)
   */
  public async updateAlert(
    alertId: string,
    updates: Partial<Omit<PriceAlert, 'id' | 'userId' | 'createdAt'>>
  ): Promise<PriceAlert | null> {
    const repo = this.getRepository();
    const alert = await repo.findOne({ where: { id: alertId } });
    if (!alert) {
      return null;
    }

    Object.assign(alert, updates);
    const saved = await repo.save(alert);
    logger.info(`Updated price alert: ${alertId}`);
    return saved;
  }

  /**
   * Delete an alert (from DB)
   */
  public async deleteAlert(alertId: string): Promise<boolean> {
    const repo = this.getRepository();
    const alert = await repo.findOne({ where: { id: alertId } });
    if (!alert) {
      return false;
    }

    await repo.remove(alert);
    this.removeSubscription(alert.commodity, alert.location, alert.userId);

    logger.info(`Deleted price alert: ${alertId}`);
    return true;
  }

  /**
   * Subscribe to real-time price updates for a commodity
   */
  public subscribe(userId: string, commodity: string, location?: string): void {
    this.addSubscription(commodity, location, userId);
    logger.debug(`User ${userId} subscribed to ${commodity} price updates`);
  }

  /**
   * Unsubscribe from price updates
   */
  public unsubscribe(userId: string, commodity: string, location?: string): void {
    this.removeSubscription(commodity, location, userId);
    logger.debug(`User ${userId} unsubscribed from ${commodity} price updates`);
  }

  /**
   * Check prices and trigger alerts
   */
  private async checkPrices(): Promise<void> {
    const commodities = new Set<string>();

    // Collect distinct commodities from DB alerts (avoids loading ALL alert rows)
    const dbCommodities = await this.getRepository()
      .createQueryBuilder('a')
      .select('DISTINCT a.commodity', 'commodity')
      .where('a.enabled = true')
      .getRawMany<{ commodity: string }>();
    for (const row of dbCommodities) {
      commodities.add(row.commodity);
    }

    for (const subscription of this.subscriptions.values()) {
      commodities.add(subscription.commodity);
    }

    if (commodities.size === 0) {
      return;
    }

    logger.debug(`Checking prices for ${commodities.size} commodities`);

    for (const commodity of commodities) {
      try {
        const item = await uifService.getItemDetails(commodity);
        if (!item) {
          continue;
        }

        const currentPrice = item.averagePrice;
        if (!currentPrice) {
          continue;
        }

        // Check alerts for this commodity
        await this.processAlerts(commodity, currentPrice);

        // Push real-time updates to subscribers
        await this.pushPriceUpdate(commodity, item);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelayMs));
      } catch (error: unknown) {
        logger.error(`Error checking price for ${commodity}:`, error);
      }
    }
  }

  /**
   * Process alerts for a commodity (DB-backed)
   */
  private async processAlerts(commodity: string, currentPrice: number): Promise<void> {
    const repo = this.getRepository();
    const relevantAlerts = await repo.find({
      where: { commodity, enabled: true },
    });

    for (const alert of relevantAlerts) {
      const subscription = this.getSubscriptionKey(commodity, alert.location);
      const sub = this.subscriptions.get(subscription);
      const previousPrice = sub?.lastPrice;

      let triggered = false;

      switch (alert.condition) {
        case PriceAlertCondition.ABOVE:
          triggered = currentPrice >= alert.threshold;
          break;
        case PriceAlertCondition.BELOW:
          triggered = currentPrice <= alert.threshold;
          break;
        case PriceAlertCondition.CHANGE_PERCENT:
          if (previousPrice) {
            const changePercent = Math.abs(((currentPrice - previousPrice) / previousPrice) * 100);
            triggered = changePercent >= alert.threshold;
          }
          break;
      }

      if (triggered) {
        // Prevent spamming - only trigger once per hour
        const cooldownMs = 60 * 60 * 1000;
        if (alert.lastTriggered && Date.now() - alert.lastTriggered.getTime() < cooldownMs) {
          continue;
        }

        alert.lastTriggered = new Date();
        await repo.save(alert);

        const event: PriceAlertEvent = {
          alertId: alert.id,
          commodity: alert.commodity,
          location: alert.location,
          condition: alert.condition,
          threshold: alert.threshold,
          currentPrice,
          previousPrice,
          changePercent: previousPrice
            ? ((currentPrice - previousPrice) / previousPrice) * 100
            : undefined,
          triggeredAt: new Date(),
        };

        // Push alert to user via WebSocket
        emitToUser(alert.userId, 'price-alert', event);
        logger.info(`Triggered price alert ${alert.id} for user ${alert.userId}`);
      }
    }
  }

  /**
   * Push price update to all subscribers
   */
  private async pushPriceUpdate(
    commodity: string,
    item: {
      averagePrice?: number;
      minPrice?: number;
      maxPrice?: number;
      locations: Array<{ price?: number; location: string; type: string }>;
    }
  ): Promise<void> {
    // Find all subscriptions for this commodity
    for (const [_key, subscription] of this.subscriptions.entries()) {
      if (subscription.commodity !== commodity) {
        continue;
      }

      if (subscription.subscribers.size === 0) {
        continue;
      }

      const priceData = {
        commodity,
        averagePrice: item.averagePrice,
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
        previousPrice: subscription.lastPrice,
        changePercent:
          subscription.lastPrice && item.averagePrice
            ? ((item.averagePrice - subscription.lastPrice) / subscription.lastPrice) * 100
            : undefined,
        locations: item.locations.slice(0, 5), // Top 5 locations
        timestamp: new Date(),
      };

      // Update last price
      subscription.lastPrice = item.averagePrice;

      // Push to trading room
      emitToRoom('trading:prices', 'price-update', priceData);

      // Also push to individual subscribers
      for (const userId of subscription.subscribers) {
        emitToUser(userId, 'price-update', priceData);
      }
    }
  }

  /**
   * Add subscription tracking
   */
  private addSubscription(commodity: string, location: string | undefined, userId: string): void {
    const key = this.getSubscriptionKey(commodity, location);
    let subscription = this.subscriptions.get(key);

    if (!subscription) {
      subscription = {
        commodity,
        location,
        subscribers: new Set(),
      };
      this.subscriptions.set(key, subscription);
    }

    subscription.subscribers.add(userId);
  }

  /**
   * Remove subscription tracking
   */
  private removeSubscription(
    commodity: string,
    location: string | undefined,
    userId: string
  ): void {
    const key = this.getSubscriptionKey(commodity, location);
    const subscription = this.subscriptions.get(key);

    if (subscription) {
      subscription.subscribers.delete(userId);

      // Clean up if no more subscribers
      if (subscription.subscribers.size === 0) {
        this.subscriptions.delete(key);
      }
    }
  }

  /**
   * Get subscription key
   */
  private getSubscriptionKey(commodity: string, location?: string): string {
    return location ? `${commodity}:${location}` : commodity;
  }

  /**
   * Get service statistics (DB-backed)
   */
  public async getStats(): Promise<{
    alertCount: number;
    activeAlerts: number;
    subscriptionCount: number;
    subscriberCount: number;
  }> {
    const repo = this.getRepository();
    const alertCount = await repo.count();
    const activeAlerts = await repo.count({ where: { enabled: true } });

    let subscriberCount = 0;
    for (const sub of this.subscriptions.values()) {
      subscriberCount += sub.subscribers.size;
    }

    return {
      alertCount,
      activeAlerts,
      subscriptionCount: this.subscriptions.size,
      subscriberCount,
    };
  }
}

// Export singleton instance
export const priceAlertService = PriceAlertService.getInstance();

