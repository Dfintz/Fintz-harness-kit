import { PriceAlert, PriceAlertCondition } from '../../../models/PriceAlert';
export { PriceAlertCondition as AlertCondition };
export type { PriceAlert } from '../../../models/PriceAlert';
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
export declare class PriceAlertService {
    private static instance;
    private subscriptions;
    private priceCheckInterval;
    private readonly checkIntervalMs;
    private readonly rateLimitDelayMs;
    private constructor();
    private getRepository;
    static getInstance(): PriceAlertService;
    start(): void;
    stop(): void;
    createAlert(alert: Omit<PriceAlert, 'id' | 'createdAt'>): Promise<PriceAlert>;
    getUserAlerts(userId: string): Promise<PriceAlert[]>;
    getAlert(alertId: string): Promise<PriceAlert | null>;
    updateAlert(alertId: string, updates: Partial<Omit<PriceAlert, 'id' | 'userId' | 'createdAt'>>): Promise<PriceAlert | null>;
    deleteAlert(alertId: string): Promise<boolean>;
    subscribe(userId: string, commodity: string, location?: string): void;
    unsubscribe(userId: string, commodity: string, location?: string): void;
    private checkPrices;
    private processAlerts;
    private pushPriceUpdate;
    private addSubscription;
    private removeSubscription;
    private getSubscriptionKey;
    getStats(): Promise<{
        alertCount: number;
        activeAlerts: number;
        subscriptionCount: number;
        subscriberCount: number;
    }>;
}
export declare const priceAlertService: PriceAlertService;
//# sourceMappingURL=PriceAlertService.d.ts.map