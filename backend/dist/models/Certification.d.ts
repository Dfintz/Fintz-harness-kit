import { TenantEntity } from './base/TenantEntity';
import { UserCertification } from './UserCertification';
export declare class Certification extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    requirements?: string;
    createdBy: string;
    holders?: UserCertification[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Certification.d.ts.map