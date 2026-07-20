import { Organization } from './Organization';
import { TradingRoute } from './TradingRoute';
export declare enum TradeTransactionStatus {
    COMPLETED = "completed",
    FAILED = "failed",
    ABORTED = "aborted"
}
export declare class TradeTransaction {
    id: string;
    routeId: string;
    route?: TradingRoute;
    userId: string;
    fleetId?: string;
    organizationId: string;
    organization?: Organization;
    successStatus: TradeTransactionStatus;
    estimatedProfit: number;
    actualProfit: number;
    durationMinutes: number;
    executedAt: Date;
    completedAt?: Date;
    getEstimateAccuracy(): number;
}
//# sourceMappingURL=TradeTransaction.d.ts.map