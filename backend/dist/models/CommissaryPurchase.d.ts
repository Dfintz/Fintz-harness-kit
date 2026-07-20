import { TenantEntity } from './base/TenantEntity';
import type { CommissaryItem } from './CommissaryItem';
import type { CreditTransaction } from './CreditTransaction';
export declare class CommissaryPurchase extends TenantEntity {
    id: string;
    itemId: string;
    buyerId: string;
    quantity: number;
    totalPrice: number;
    transactionId: string;
    item?: CommissaryItem;
    transaction?: CreditTransaction;
    createdAt: Date;
}
//# sourceMappingURL=CommissaryPurchase.d.ts.map