import { IntelClassification } from '../../models/IntelEntry';
export interface IntelMetadata {
    attachments?: string[];
    relatedEntries?: string[];
    sources?: string[];
    reliability?: number;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    expirationDate?: Date;
    customFields?: Record<string, string | number | boolean>;
    agingHistory?: {
        date: Date;
        action: string;
        fromClassification?: IntelClassification;
        toClassification?: IntelClassification;
        performedBy?: string;
        reason?: string;
    }[];
    shareHistory?: {
        date: Date;
        action: string;
        targetOrgId?: string;
        performedBy?: string;
    }[];
}
export declare class IntelEncryptionService {
    private static readonly ENCRYPTION_PREFIX;
    static isEncryptionEnabled(): boolean;
    static getMinimumEncryptionLevel(): IntelClassification;
    static requiresEncryption(classification: IntelClassification): boolean;
    static encryptContent(content: string, classification: IntelClassification): string;
    static decryptContent(content: string): string;
    static isEncrypted(content: string): boolean;
    static handleClassificationChange(content: string, oldClassification: IntelClassification, newClassification: IntelClassification): string;
    static encryptMetadata(metadata: IntelMetadata | undefined, classification: IntelClassification): IntelMetadata | undefined;
    static decryptMetadata(metadata: IntelMetadata | undefined): IntelMetadata | undefined;
    static getStatistics(): {
        encryptionEnabled: boolean;
        minimumLevel: IntelClassification;
        encryptedLevels: IntelClassification[];
    };
}
//# sourceMappingURL=IntelEncryptionService.d.ts.map