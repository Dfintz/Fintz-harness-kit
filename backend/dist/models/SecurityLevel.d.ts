import { Organization } from './Organization';
export declare class SecurityLevel {
    id: string;
    sourceOrgId: string;
    sourceOrganization: Organization;
    targetOrgId: string;
    targetOrganization: Organization;
    level: number;
    resourceType: string;
    accessLevel: string;
    restrictions?: Record<string, unknown>;
    notes?: string;
    isActive: boolean;
    expiresAt?: Date;
    approvedBy?: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
    grantsAccess(requiredLevel: number, requiredAccessLevel?: string): boolean;
}
//# sourceMappingURL=SecurityLevel.d.ts.map