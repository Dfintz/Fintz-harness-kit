import { Organization } from '../models/Organization';
export interface ObfuscatedUserData {
    username: string;
    email: string;
    id: string;
}
export declare function obfuscateUserData(user: {
    username: string;
    email: string;
    id: string;
}): ObfuscatedUserData;
export interface ObfuscatedRequestData {
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}
export declare function obfuscateRequestData(req: {
    ip?: string;
    headers?: {
        'user-agent'?: string;
    };
}): ObfuscatedRequestData;
export declare function isEncryptionEnabled(): boolean;
export declare function getDataRetentionDays(): number;
export declare function shouldDeleteData(createdAt: Date): boolean;
export declare enum GDPRDataCategory {
    PERSONAL_IDENTIFIABLE = "personal_identifiable",
    AUTHENTICATION = "authentication",
    BEHAVIORAL = "behavioral",
    TECHNICAL = "technical",
    PROFILE = "profile",
    SENSITIVE = "sensitive"
}
export declare function classifyDataField(fieldName: string): GDPRDataCategory;
export declare function requiresEncryption(category: GDPRDataCategory): boolean;
export declare function requiresObfuscation(category: GDPRDataCategory): boolean;
export declare function getUserPrimaryOrganization(userId: string): Promise<Organization | null>;
//# sourceMappingURL=gdprUtils.d.ts.map