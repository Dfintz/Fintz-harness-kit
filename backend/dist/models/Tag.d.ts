import { TenantEntity } from './base/TenantEntity';
import { TagAssignment } from './TagAssignment';
export declare class Tag extends TenantEntity {
    id: string;
    name: string;
    color: string;
    description?: string;
    createdBy: string;
    assignments?: TagAssignment[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Tag.d.ts.map