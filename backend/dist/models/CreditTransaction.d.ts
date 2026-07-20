import { TenantEntity } from './base/TenantEntity';
import type { CreditPool } from './CreditPool';
export declare enum TransactionType {
    INCOME = "income",
    EXPENSE = "expense",
    TRANSFER = "transfer",
    DUES = "dues",
    REWARD = "reward",
    PURCHASE = "purchase"
}
export declare class CreditTransaction extends TenantEntity {
    id: string;
    creditPoolId: string;
    type: TransactionType;
    amount: number;
    balance: number;
    description: string;
    category?: string;
    fromUserId?: string;
    toUserId?: string;
    metadata?: Record<string, unknown>;
    createdBy: string;
    creditPool?: CreditPool;
    createdAt: Date;
}
//# sourceMappingURL=CreditTransaction.d.ts.map