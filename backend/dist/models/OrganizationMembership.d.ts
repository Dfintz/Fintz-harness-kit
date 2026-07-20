import { Organization } from './Organization';
import { Role } from './Role';
import { User } from './User';
export type MembershipAcquisitionSource = 'application' | 'invitation' | 'founder' | 'manual' | 'sync' | 'recruitment';
export declare class OrganizationMembership {
    id: string;
    userId: string;
    user: User;
    organizationId: string;
    organization: Organization;
    roleId: string;
    role: Role;
    securityLevel: number;
    title?: string;
    isActive: boolean;
    joinedAt?: Date;
    leftAt?: Date;
    permissions?: string[];
    metadata?: Record<string, unknown>;
    acquisitionSource?: MembershipAcquisitionSource;
    acquisitionRefId?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=OrganizationMembership.d.ts.map