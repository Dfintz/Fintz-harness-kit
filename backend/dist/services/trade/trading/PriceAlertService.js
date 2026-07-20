"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceAlertService = exports.PriceAlertService = exports.AlertCondition = void 0;
const database_1 = require("../../../config/database");
const PriceAlert_1 = require("../../../models/PriceAlert");
Object.defineProperty(exports, "AlertCondition", { enumerable: true, get: function () { return PriceAlert_1.PriceAlertCondition; } });
const logger_1 = require("../../../utils/logger");
const websocketServer_1 = require("../../../websocket/websocketServer");
const UIFService_1 = require("./UIFService");
class PriceAlertService {
    static instance;
    subscriptions = new Map();
    priceCheckInterval = null;
    checkIntervalMs = 60000;
    rateLimitDelayMs = 200;
    constructor() {
    }
    getRepository() {
        return database_1.AppDataSource.getRepository(PriceAlert_1.PriceAlert);
    }
    static getInstance() {
        if (!PriceAlertService.instance) {
            PriceAlertService.instance = new PriceAlertService();
        }
        return PriceAlertService.instance;
    }
    start() {
        if (this.priceCheckInterval) {
            return;
        }
        logger_1.logger.info('Starting price alert service');
        this.priceCheckInterval = setInterval(() => {
            this.checkPrices().catch(error => {
                logger_1.logger.error('Error checking prices:', error);
            });
        }, this.checkIntervalMs);
        this.checkPrices().catch(error => {
            logger_1.logger.error('Error in initial price check:', error);
        });
    }
    stop() {
        if (this.priceCheckInterval) {
            clearInterval(this.priceCheckInterval);
            this.priceCheckInterval = null;
            logger_1.logger.info('Price alert service stopped');
        }
    }
    async createAlert(alert) {
        const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const repo = this.getRepository();
        const newAlert = repo.create({
            ...alert,
            id,
        });
        const saved = await repo.save(newAlert);
        this.addSubscription(alert.commodity, alert.location, alert.userId);
        logger_1.logger.info(`Created price alert: ${id} for ${alert.commodity}`);
        return saved;
    }
    async getUserAlerts(userId) {
        return this.getRepository().find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }
    async getAlert(alertId) {
        return this.getRepository().findOne({ where: { id: alertId } });
    }
    async updateAlert(alertId, updates) {
        const repo = this.getRepository();
        const alert = await repo.findOne({ where: { id: alertId } });
        if (!alert) {
            return null;
        }
        Object.assign(alert, updates);
        const saved = await repo.save(alert);
        logger_1.logger.info(`Updated price alert: ${alertId}`);
        return saved;
    }
    async deleteAlert(alertId) {
        const repo = this.getRepository();
        const alert = await repo.findOne({ where: { id: alertId } });
        if (!alert) {
            return false;
        }
        await repo.remove(alert);
        this.removeSubscription(alert.commodity, alert.location, alert.userId);
        logger_1.logger.info(`Deleted price alert: ${alertId}`);
        return true;
    }
    subscribe(userId, commodity, location) {
        this.addSubscription(commodity, location, userId);
        logger_1.logger.debug(`User ${userId} subscribed to ${commodity} price updates`);
    }
    unsubscribe(userId, commodity, location) {
        this.removeSubscription(commodity, location, userId);
        logger_1.logger.debug(`User ${userId} unsubscribed from ${commodity} price updates`);
    }
    async checkPrices() {
        const commodities = new Set();
        const dbCommodities = await this.getRepository()
            .createQueryBuilder('a')
            .select('DISTINCT a.commodity', 'commodity')
            .where('a.enabled = true')
            .getRawMany();
        for (const row of dbCommodities) {
            commodities.add(row.commodity);
        }
        for (const subscription of this.subscriptions.values()) {
            commodities.add(subscription.commodity);
        }
        if (commodities.size === 0) {
            return;
        }
        logger_1.logger.debug(`Checking prices for ${commodities.size} commodities`);
        for (const commodity of commodities) {
            try {
                const item = await UIFService_1.uifService.getItemDetails(commodity);
                if (!item) {
                    continue;
                }
                const currentPrice = item.averagePrice;
                if (!currentPrice) {
                    continue;
                }
                await this.processAlerts(commodity, currentPrice);
                await this.pushPriceUpdate(commodity, item);
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelayMs));
            }
            catch (error) {
                logger_1.logger.error(`Error checking price for ${commodity}:`, error);
            }
        }
    }
    async processAlerts(commodity, currentPrice) {
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
                case PriceAlert_1.PriceAlertCondition.ABOVE:
                    triggered = currentPrice >= alert.threshold;
                    break;
                case PriceAlert_1.PriceAlertCondition.BELOW:
                    triggered = currentPrice <= alert.threshold;
                    break;
                case PriceAlert_1.PriceAlertCondition.CHANGE_PERCENT:
                    if (previousPrice) {
                        const changePercent = Math.abs(((currentPrice - previousPrice) / previousPrice) * 100);
                        triggered = changePercent >= alert.threshold;
                    }
                    break;
            }
            if (triggered) {
                const cooldownMs = 60 * 60 * 1000;
                if (alert.lastTriggered && Date.now() - alert.lastTriggered.getTime() < cooldownMs) {
                    continue;
                }
                alert.lastTriggered = new Date();
                await repo.save(alert);
                const event = {
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
                (0, websocketServer_1.emitToUser)(alert.userId, 'price-alert', event);
                logger_1.logger.info(`Triggered price alert ${alert.id} for user ${alert.userId}`);
            }
        }
    }
    async pushPriceUpdate(commodity, item) {
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
                changePercent: subscription.lastPrice && item.averagePrice
                    ? ((item.averagePrice - subscription.lastPrice) / subscription.lastPrice) * 100
                    : undefined,
                locations: item.locations.slice(0, 5),
                timestamp: new Date(),
            };
            subscription.lastPrice = item.averagePrice;
            (0, websocketServer_1.emitToRoom)('trading:prices', 'price-update', priceData);
            for (const userId of subscription.subscribers) {
                (0, websocketServer_1.emitToUser)(userId, 'price-update', priceData);
            }
        }
    }
    addSubscription(commodity, location, userId) {
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
    removeSubscription(commodity, location, userId) {
        const key = this.getSubscriptionKey(commodity, location);
        const subscription = this.subscriptions.get(key);
        if (subscription) {
            subscription.subscribers.delete(userId);
            if (subscription.subscribers.size === 0) {
                this.subscriptions.delete(key);
            }
        }
    }
    getSubscriptionKey(commodity, location) {
        return location ? `${commodity}:${location}` : commodity;
    }
    async getStats() {
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
exports.PriceAlertService = PriceAlertService;
exports.priceAlertService = PriceAlertService.getInstance();
//# sourceMappingURL=PriceAlertService.js.map