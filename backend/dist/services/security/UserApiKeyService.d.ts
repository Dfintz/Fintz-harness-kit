import { UserApiKey } from '../../models/UserApiKey';
export declare const VALID_SCOPES: readonly ["read:activities", "write:activities", "read:fleet", "read:profile", "*"];
export interface CreateApiKeyDTO {
    name: string;
    scopes: string[];
    expiresInDays?: number;
}
export interface ApiKeyCreatedResult {
    rawKey: string;
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    expiresAt: string | null;
    createdAt: string;
}
export declare class UserApiKeyService {
    private readonly repo;
    constructor();
    createKey(userId: string, dto: CreateApiKeyDTO, ipAddress?: string): Promise<ApiKeyCreatedResult>;
    listKeys(userId: string): Promise<UserApiKey[]>;
    getKey(userId: string, keyId: string): Promise<UserApiKey>;
    updateKey(userId: string, keyId: string, updates: {
        name?: string;
        scopes?: string[];
    }): Promise<UserApiKey>;
    revokeKey(userId: string, keyId: string): Promise<void>;
    validateKey(rawKey: string, requiredScope?: string, ipAddress?: string): Promise<{
        userId: string;
        keyId: string;
        scopes: string[];
    } | null>;
}
//# sourceMappingURL=UserApiKeyService.d.ts.map