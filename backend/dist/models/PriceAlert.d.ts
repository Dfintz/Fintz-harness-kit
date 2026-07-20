export declare enum PriceAlertCondition {
    ABOVE = "above",
    BELOW = "below",
    CHANGE_PERCENT = "change_percent"
}
export declare class PriceAlert {
    id: string;
    userId: string;
    commodity: string;
    location?: string;
    condition: PriceAlertCondition;
    threshold: number;
    enabled: boolean;
    lastTriggered?: Date;
    createdAt: Date;
}
//# sourceMappingURL=PriceAlert.d.ts.map