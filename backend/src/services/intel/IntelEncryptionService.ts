import { IntelClassification } from '../../models/IntelEntry';
import { encrypt, decrypt } from '../../utils/encryption';
import { logger } from '../../utils/logger';

/**
 * Intel metadata structure for type safety
 */
export interface IntelMetadata {
    attachments?: string[];
    relatedEntries?: string[];
    sources?: string[];
    reliability?: number;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    expirationDate?: Date;
    customFields?: Record<string, string | number | boolean>;
    // Aging metadata
    agingHistory?: {
        date: Date;
        action: string;
        fromClassification?: IntelClassification;
        toClassification?: IntelClassification;
        performedBy?: string;
        reason?: string;
    }[];
    // Sharing metadata
    shareHistory?: {
        date: Date;
        action: string;
        targetOrgId?: string;
        performedBy?: string;
    }[];
}

/**
 * Intel Content Encryption Service
 * 
 * Provides encryption at rest for sensitive Intel vault content.
 * Encryption is applied based on classification level:
 * - PUBLIC: No encryption
 * - RESTRICTED: Optional encryption
 * - CONFIDENTIAL+: Mandatory encryption
 * 
 * Environment Configuration:
 * - INTEL_ENCRYPTION_ENABLED: Enable/disable encryption (default: true in production)
 * - INTEL_ENCRYPTION_MIN_LEVEL: Minimum classification for encryption (default: confidential)
 */
export class IntelEncryptionService {
    private static readonly ENCRYPTION_PREFIX = 'ENC:';
    
    /**
     * Check if encryption is enabled
     */
    static isEncryptionEnabled(): boolean {
        const enabled = process.env.INTEL_ENCRYPTION_ENABLED;
        
        // Default to enabled in production
        if (enabled === undefined) {
            return process.env.NODE_ENV === 'production';
        }
        
        return enabled === 'true';
    }
    
    /**
     * Get minimum classification level that requires encryption
     */
    static getMinimumEncryptionLevel(): IntelClassification {
        const level = process.env.INTEL_ENCRYPTION_MIN_LEVEL?.toLowerCase();
        
        switch (level) {
            case 'public':
                return IntelClassification.PUBLIC;
            case 'restricted':
                return IntelClassification.RESTRICTED;
            case 'confidential':
                return IntelClassification.CONFIDENTIAL;
            case 'secret':
                return IntelClassification.SECRET;
            case 'top_secret':
                return IntelClassification.TOP_SECRET;
            default:
                // Default to CONFIDENTIAL (encrypt CONFIDENTIAL, SECRET, TOP_SECRET)
                return IntelClassification.CONFIDENTIAL;
        }
    }
    
    /**
     * Check if a classification level requires encryption
     */
    static requiresEncryption(classification: IntelClassification): boolean {
        if (!this.isEncryptionEnabled()) {
            return false;
        }
        
        const levelOrder: Record<IntelClassification, number> = {
            [IntelClassification.PUBLIC]: 0,
            [IntelClassification.RESTRICTED]: 1,
            [IntelClassification.CONFIDENTIAL]: 2,
            [IntelClassification.SECRET]: 3,
            [IntelClassification.TOP_SECRET]: 4,
        };
        
        const minLevel = this.getMinimumEncryptionLevel();
        
        return levelOrder[classification] >= levelOrder[minLevel];
    }
    
    /**
     * Encrypt Intel entry content if required by classification
     * Returns the content with prefix if encrypted
     */
    static encryptContent(content: string, classification: IntelClassification): string {
        if (!content) {
            return content;
        }
        
        // Check if already encrypted
        if (content.startsWith(this.ENCRYPTION_PREFIX)) {
            logger.warn('Content is already encrypted');
            return content;
        }
        
        // Check if encryption is required for this classification
        if (!this.requiresEncryption(classification)) {
            return content;
        }
        
        try {
            const encrypted = encrypt(content);
            logger.debug('Intel content encrypted', { classification });
            return `${this.ENCRYPTION_PREFIX}${encrypted}`;
        } catch (error: unknown) {
            logger.error('Failed to encrypt Intel content:', error);
            throw new Error('Failed to encrypt sensitive content');
        }
    }
    
    /**
     * Decrypt Intel entry content if encrypted
     * Handles both encrypted and plain content transparently
     */
    static decryptContent(content: string): string {
        if (!content) {
            return content;
        }
        
        // Check if content is encrypted
        if (!content.startsWith(this.ENCRYPTION_PREFIX)) {
            return content;
        }
        
        try {
            const encryptedData = content.substring(this.ENCRYPTION_PREFIX.length);
            const decrypted = decrypt(encryptedData);
            logger.debug('Intel content decrypted');
            return decrypted;
        } catch (error: unknown) {
            logger.error('Failed to decrypt Intel content:', error);
            throw new Error('Failed to decrypt sensitive content');
        }
    }
    
    /**
     * Check if content is encrypted
     */
    static isEncrypted(content: string): boolean {
        return content?.startsWith(this.ENCRYPTION_PREFIX) ?? false;
    }
    
    /**
     * Re-encrypt content when classification level changes
     * Handles upgrading from plain to encrypted or downgrading
     */
    static handleClassificationChange(
        content: string,
        oldClassification: IntelClassification,
        newClassification: IntelClassification
    ): string {
        const wasEncrypted = this.isEncrypted(content);
        const needsEncryption = this.requiresEncryption(newClassification);
        
        // No change needed
        if (wasEncrypted === needsEncryption) {
            return content;
        }
        
        // Upgrade: encrypt content
        if (!wasEncrypted && needsEncryption) {
            logger.info('Upgrading Intel content encryption', {
                from: oldClassification,
                to: newClassification
            });
            return this.encryptContent(content, newClassification);
        }
        
        // Downgrade: decrypt content (remove encryption)
        if (wasEncrypted && !needsEncryption) {
            logger.info('Downgrading Intel content encryption', {
                from: oldClassification,
                to: newClassification
            });
            return this.decryptContent(content);
        }
        
        return content;
    }
    
    /**
     * Encrypt multiple fields in Intel metadata
     */
    static encryptMetadata(
        metadata: IntelMetadata | undefined,
        classification: IntelClassification
    ): IntelMetadata | undefined {
        if (!metadata || !this.requiresEncryption(classification)) {
            return metadata;
        }
        
        // Only encrypt sensitive metadata fields
        const encryptedMetadata: IntelMetadata = { ...metadata };
        
        // Encrypt sources (sensitive information about intelligence sources)
        if (encryptedMetadata.sources && Array.isArray(encryptedMetadata.sources)) {
            encryptedMetadata.sources = encryptedMetadata.sources.map(
                (source: string) => this.encryptContent(source, classification)
            );
        }
        
        // Encrypt custom fields
        if (encryptedMetadata.customFields && typeof encryptedMetadata.customFields === 'object') {
            const encryptedCustomFields: Record<string, string | number | boolean> = {};
            for (const [key, value] of Object.entries(encryptedMetadata.customFields)) {
                if (typeof value === 'string') {
                    encryptedCustomFields[key] = this.encryptContent(value, classification);
                } else {
                    encryptedCustomFields[key] = value;
                }
            }
            encryptedMetadata.customFields = encryptedCustomFields;
        }
        
        return encryptedMetadata;
    }
    
    /**
     * Decrypt multiple fields in Intel metadata
     */
    static decryptMetadata(
        metadata: IntelMetadata | undefined
    ): IntelMetadata | undefined {
        if (!metadata) {
            return metadata;
        }
        
        const decryptedMetadata: IntelMetadata = { ...metadata };
        
        // Decrypt sources
        if (decryptedMetadata.sources && Array.isArray(decryptedMetadata.sources)) {
            decryptedMetadata.sources = decryptedMetadata.sources.map(
                (source: string) => this.decryptContent(source)
            );
        }
        
        // Decrypt custom fields
        if (decryptedMetadata.customFields && typeof decryptedMetadata.customFields === 'object') {
            const decryptedCustomFields: Record<string, string | number | boolean> = {};
            for (const [key, value] of Object.entries(decryptedMetadata.customFields)) {
                if (typeof value === 'string') {
                    decryptedCustomFields[key] = this.decryptContent(value);
                } else {
                    decryptedCustomFields[key] = value;
                }
            }
            decryptedMetadata.customFields = decryptedCustomFields;
        }
        
        return decryptedMetadata;
    }
    
    /**
     * Get encryption statistics
     */
    static getStatistics(): {
        encryptionEnabled: boolean;
        minimumLevel: IntelClassification;
        encryptedLevels: IntelClassification[];
    } {
        const enabled = this.isEncryptionEnabled();
        const minLevel = this.getMinimumEncryptionLevel();
        
        const allLevels = Object.values(IntelClassification);
        const encryptedLevels = enabled 
            ? allLevels.filter(level => this.requiresEncryption(level))
            : [];
        
        return {
            encryptionEnabled: enabled,
            minimumLevel: minLevel,
            encryptedLevels
        };
    }
}

