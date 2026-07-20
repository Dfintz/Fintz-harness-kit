import { Organization } from './Organization';
export declare class Role {
    id: string;
    name: string;
    description?: string;
    organizationId?: string;
    isSystemRole: boolean;
    priority: number;
    permissions?: string[];
    createdAt: Date;
    updatedAt: Date;
    organization?: Organization;
}
//# sourceMappingURL=Role.d.ts.map