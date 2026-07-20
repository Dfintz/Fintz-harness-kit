import { SharedAccount } from '../../models/SharedAccount';
export declare class SharedAccountService {
    private sharedAccountRepository;
    private keyVaultService;
    constructor();
    createSharedAccount(accountName: string, accountUsername: string, password: string, organizationId: string, createdBy: string, description?: string, passwordExpiresAt?: Date, categories?: string[], tags?: string[], twoFactorSecret?: string): Promise<SharedAccount | null>;
    getSharedAccountsByOrganization(organizationId: string): Promise<SharedAccount[]>;
    getSharedAccountById(id: string): Promise<SharedAccount | null>;
    getSharedAccountPassword(id: string): Promise<string | null>;
    updateSharedAccount(id: string, updates: {
        accountName?: string;
        accountUsername?: string;
        description?: string;
        passwordExpiresAt?: Date;
        categories?: string[];
        tags?: string[];
    }): Promise<SharedAccount | null>;
    updateSharedAccountPassword(id: string, newPassword: string): Promise<boolean>;
    deleteSharedAccount(id: string): Promise<boolean>;
    getSharedAccount2FASecret(id: string): Promise<string | null>;
    updateSharedAccount2FASecret(id: string, twoFactorSecret: string): Promise<boolean>;
    updateLastAccess(id: string, userId: string): Promise<boolean>;
    getAccountsByCategory(organizationId: string, category: string): Promise<SharedAccount[]>;
    getAccountsByTag(organizationId: string, tag: string): Promise<SharedAccount[]>;
    getAccountsWithExpiredPasswords(organizationId: string): Promise<SharedAccount[]>;
    getAccountsExpiringSoon(organizationId: string, daysThreshold?: number): Promise<SharedAccount[]>;
}
//# sourceMappingURL=SharedAccountService.d.ts.map