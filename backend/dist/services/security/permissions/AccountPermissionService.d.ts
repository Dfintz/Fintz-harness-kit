import { AccountPermission } from '../../../models/AccountPermission';
export declare class AccountPermissionService {
    private permissionRepository;
    private userOrgRepository;
    hasPermission(userId: string, organizationId: string, action: string, accountId?: string): Promise<boolean>;
    grantPermission(userId: string, organizationId: string, action: string, grantedBy: string, accountId?: string, expiresAt?: Date): Promise<AccountPermission | null>;
    revokePermission(permissionId: string): Promise<boolean>;
    getUserPermissions(userId: string, organizationId: string): Promise<AccountPermission[]>;
    getAccountPermissions(accountId: string): Promise<AccountPermission[]>;
    cleanupExpiredPermissions(): Promise<number>;
}
//# sourceMappingURL=AccountPermissionService.d.ts.map