import { TenantEntity } from './base/TenantEntity';
export declare class CommissaryItem extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    stock: number;
    isActive: boolean;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=CommissaryItem.d.ts.map