import { Repository } from 'typeorm';
import { TradeTransaction, TradeTransactionStatus } from '../../../models/TradeTransaction';
import { TradeUserReputation } from '../../../models/TradeUserReputation';
export interface RecordTradeTransactionParams {
    routeId: string;
    userId: string;
    organizationId: string;
    fleetId?: string;
    estimatedProfit: number;
    actualProfit: number;
    durationMinutes: number;
    successStatus?: TradeTransactionStatus;
}
export interface TradeReputationLeaderboard {
    userId: string;
    overallScore: number;
    tier: string;
    totalRuns: number;
    successRate: number;
    avgProfit: number;
}
export declare class TradeReputationService {
    private readonly transactionRepository;
    private readonly reputationRepository;
    constructor(transactionRepository?: Repository<TradeTransaction>, reputationRepository?: Repository<TradeUserReputation>);
    recordTransaction(params: RecordTradeTransactionParams): Promise<TradeTransaction>;
    getUserTransactions(userId: string, organizationId: string, limit?: number): Promise<TradeTransaction[]>;
    getRouteTransactions(routeId: string, organizationId: string, limit?: number): Promise<TradeTransaction[]>;
    getUserReputation(userId: string): Promise<TradeUserReputation>;
    updateUserReputation(userId: string): Promise<TradeUserReputation>;
    getLeaderboard(limit?: number): Promise<TradeReputationLeaderboard[]>;
    private calculateConsistency;
}
export declare const tradeReputationService: TradeReputationService;
//# sourceMappingURL=TradeReputationService.d.ts.map