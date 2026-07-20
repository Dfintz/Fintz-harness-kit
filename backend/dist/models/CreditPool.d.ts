import { TenantEntity } from './base/TenantEntity';
export declare class CreditPool extends TenantEntity {
    id: string;
    balance: number;
    currency: string;
    lastTransactionAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
//# sourceMappingURL=CreditPool.d.ts.map