import { TenantEntity } from './base/TenantEntity';
import { Document } from './Document';
export declare class DocumentFolder extends TenantEntity {
    id: string;
    name: string;
    parentId?: string;
    sortOrder: number;
    createdBy: string;
    parent?: DocumentFolder;
    children?: DocumentFolder[];
    documents?: Document[];
    createdAt: Date;
}
//# sourceMappingURL=DocumentFolder.d.ts.map