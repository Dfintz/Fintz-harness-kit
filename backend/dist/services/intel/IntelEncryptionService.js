"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelEncryptionService = void 0;
const IntelEntry_1 = require("../../models/IntelEntry");
const encryption_1 = require("../../utils/encryption");
const logger_1 = require("../../utils/logger");
class IntelEncryptionService {
    static ENCRYPTION_PREFIX = 'ENC:';
    static isEncryptionEnabled() {
        const enabled = process.env.INTEL_ENCRYPTION_ENABLED;
        if (enabled === undefined) {
            return process.env.NODE_ENV === 'production';
        }
        return enabled === 'true';
    }
    static getMinimumEncryptionLevel() {
        const level = process.env.INTEL_ENCRYPTION_MIN_LEVEL?.toLowerCase();
        switch (level) {
            case 'public':
                return IntelEntry_1.IntelClassification.PUBLIC;
            case 'restricted':
                return IntelEntry_1.IntelClassification.RESTRICTED;
            case 'confidential':
                return IntelEntry_1.IntelClassification.CONFIDENTIAL;
            case 'secret':
                return IntelEntry_1.IntelClassification.SECRET;
            case 'top_secret':
                return IntelEntry_1.IntelClassification.TOP_SECRET;
            default:
                return IntelEntry_1.IntelClassification.CONFIDENTIAL;
        }
    }
    static requiresEncryption(classification) {
        if (!this.isEncryptionEnabled()) {
            return false;
        }
        const levelOrder = {
            [IntelEntry_1.IntelClassification.PUBLIC]: 0,
            [IntelEntry_1.IntelClassification.RESTRICTED]: 1,
            [IntelEntry_1.IntelClassification.CONFIDENTIAL]: 2,
            [IntelEntry_1.IntelClassification.SECRET]: 3,
            [IntelEntry_1.IntelClassification.TOP_SECRET]: 4,
        };
        const minLevel = this.getMinimumEncryptionLevel();
        return levelOrder[classification] >= levelOrder[minLevel];
    }
    static encryptContent(content, classification) {
        if (!content) {
            return content;
        }
        if (content.startsWith(this.ENCRYPTION_PREFIX)) {
            logger_1.logger.warn('Content is already encrypted');
            return content;
        }
        if (!this.requiresEncryption(classification)) {
            return content;
        }
        try {
            const encrypted = (0, encryption_1.encrypt)(content);
            logger_1.logger.debug('Intel content encrypted', { classification });
            return `${this.ENCRYPTION_PREFIX}${encrypted}`;
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt Intel content:', error);
            throw new Error('Failed to encrypt sensitive content');
        }
    }
    static decryptContent(content) {
        if (!content) {
            return content;
        }
        if (!content.startsWith(this.ENCRYPTION_PREFIX)) {
            return content;
        }
        try {
            const encryptedData = content.substring(this.ENCRYPTION_PREFIX.length);
            const decrypted = (0, encryption_1.decrypt)(encryptedData);
            logger_1.logger.debug('Intel content decrypted');
            return decrypted;
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt Intel content:', error);
            throw new Error('Failed to decrypt sensitive content');
        }
    }
    static isEncrypted(content) {
        return content?.startsWith(this.ENCRYPTION_PREFIX) ?? false;
    }
    static handleClassificationChange(content, oldClassification, newClassification) {
        const wasEncrypted = this.isEncrypted(content);
        const needsEncryption = this.requiresEncryption(newClassification);
        if (wasEncrypted === needsEncryption) {
            return content;
        }
        if (!wasEncrypted && needsEncryption) {
            logger_1.logger.info('Upgrading Intel content encryption', {
                from: oldClassification,
                to: newClassification
            });
            return this.encryptContent(content, newClassification);
        }
        if (wasEncrypted && !needsEncryption) {
            logger_1.logger.info('Downgrading Intel content encryption', {
                from: oldClassification,
                to: newClassification
            });
            return this.decryptContent(content);
        }
        return content;
    }
    static encryptMetadata(metadata, classification) {
        if (!metadata || !this.requiresEncryption(classification)) {
            return metadata;
        }
        const encryptedMetadata = { ...metadata };
        if (encryptedMetadata.sources && Array.isArray(encryptedMetadata.sources)) {
            encryptedMetadata.sources = encryptedMetadata.sources.map((source) => this.encryptContent(source, classification));
        }
        if (encryptedMetadata.customFields && typeof encryptedMetadata.customFields === 'object') {
            const encryptedCustomFields = {};
            for (const [key, value] of Object.entries(encryptedMetadata.customFields)) {
                if (typeof value === 'string') {
                    encryptedCustomFields[key] = this.encryptContent(value, classification);
                }
                else {
                    encryptedCustomFields[key] = value;
                }
            }
            encryptedMetadata.customFields = encryptedCustomFields;
        }
        return encryptedMetadata;
    }
    static decryptMetadata(metadata) {
        if (!metadata) {
            return metadata;
        }
        const decryptedMetadata = { ...metadata };
        if (decryptedMetadata.sources && Array.isArray(decryptedMetadata.sources)) {
            decryptedMetadata.sources = decryptedMetadata.sources.map((source) => this.decryptContent(source));
        }
        if (decryptedMetadata.customFields && typeof decryptedMetadata.customFields === 'object') {
            const decryptedCustomFields = {};
            for (const [key, value] of Object.entries(decryptedMetadata.customFields)) {
                if (typeof value === 'string') {
                    decryptedCustomFields[key] = this.decryptContent(value);
                }
                else {
                    decryptedCustomFields[key] = value;
                }
            }
            decryptedMetadata.customFields = decryptedCustomFields;
        }
        return decryptedMetadata;
    }
    static getStatistics() {
        const enabled = this.isEncryptionEnabled();
        const minLevel = this.getMinimumEncryptionLevel();
        const allLevels = Object.values(IntelEntry_1.IntelClassification);
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
exports.IntelEncryptionService = IntelEncryptionService;
//# sourceMappingURL=IntelEncryptionService.js.map