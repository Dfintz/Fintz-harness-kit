import { CreditPool } from '../../models/CreditPool';
import { CreditTransaction, TransactionType } from '../../models/CreditTransaction';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export declare enum TreasuryAuditAction {
    POOL_CREATED = "pool_created",
    CREDIT_EARNED = "credit_earned",
    CREDIT_SPENT = "credit_spent",
    CREDIT_TRANSFERRED = "credit_transferred",
    DUES_COLLECTED = "dues_collected"
}
export interface EarnCreditsDTO {
    amount: number;
    source: string;
    category?: string;
    metadata?: Record<string, unknown>;
}
export interface SpendCreditsDTO {
    amount: number;
    purpose: string;
    category?: string;
    metadata?: Record<string, unknown>;
}
export interface TransferCreditsDTO {
    toUserId: string;
    amount: number;
    note?: string;
}
export interface TransactionFilters {
    type?: TransactionType;
    category?: string;
    fromUserId?: string;
    toUserId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export interface TreasuryStatistics {
    balance: number;
    currency: string;
    totalIncome: number;
    totalExpenses: number;
    transactionCount: number;
    recentTransactions: CreditTransaction[];
}
export declare class TreasuryService extends TenantService<CreditPool> {
    private readonly transactionRepo;
    constructor();
    private audit;
    getOrCreatePool(organizationId: string, createdBy?: string): Promise<CreditPool>;
    getBalance(organizationId: string): Promise<{
        balance: number;
        currency: string;
    }>;
    earnCredits(organizationId: string, userId: string, dto: EarnCreditsDTO): Promise<CreditTransaction>;
    spendCredits(organizationId: string, userId: string, dto: SpendCreditsDTO): Promise<CreditTransaction>;
    transferCredits(organizationId: string, fromUserId: string, dto: TransferCreditsDTO): Promise<CreditTransaction>;
    private recordTransaction;
    getTransactions(organizationId: string, pagination: PaginationOptions, filters?: TransactionFilters): Promise<PaginatedResponse<CreditTransaction>>;
    getStatistics(organizationId: string, period?: string): Promise<TreasuryStatistics>;
    getLeaderboard(organizationId: string, limit?: number): Promise<Array<{
        userId: string;
        totalContributed: number;
        transactionCount: number;
    }>>;
    private getPeriodStartDate;
}
export declare function getTreasuryService(): TreasuryService;
//# sourceMappingURL=TreasuryService.d.ts.map