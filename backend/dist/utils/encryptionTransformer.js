"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conditionalEncryptionTransformer = exports.encryptionTransformer = void 0;
exports.resolveDecryptedDisplayText = resolveDecryptedDisplayText;
const applicationInsights_1 = require("../config/applicationInsights");
const encryption_1 = require("./encryption");
const logger_1 = require("./logger");
exports.encryptionTransformer = {
    to(value) {
        if (value === null || value === undefined || value === '') {
            return value;
        }
        try {
            return (0, encryption_1.encrypt)(value);
        }
        catch (error) {
            logger_1.logger.error('Error encrypting field value:', error);
            throw new Error('Failed to encrypt sensitive data');
        }
    },
    from(value) {
        if (value === null || value === undefined || value === '') {
            return value;
        }
        try {
            return (0, encryption_1.decrypt)(value);
        }
        catch (error) {
            logger_1.logger.info('Decryption failed for field value — returning as plaintext (likely legacy unencrypted data)', { error: error instanceof Error ? error.message : String(error) });
            (0, applicationInsights_1.trackMetric)('encryption_decryption_failure', 1);
            return value;
        }
    },
};
exports.conditionalEncryptionTransformer = {
    to(value) {
        if (value === null || value === undefined || value === '') {
            return value;
        }
        const encryptionEnabled = process.env.ENCRYPTION_ENABLED === 'true';
        if (!encryptionEnabled) {
            return value;
        }
        try {
            return (0, encryption_1.encrypt)(value);
        }
        catch (error) {
            logger_1.logger.error('Error encrypting field value:', error);
            throw new Error('Failed to encrypt sensitive data');
        }
    },
    from(value) {
        if (value === null || value === undefined || value === '') {
            return value;
        }
        const encryptionEnabled = process.env.ENCRYPTION_ENABLED === 'true';
        if (!encryptionEnabled) {
            return value;
        }
        try {
            return (0, encryption_1.decrypt)(value);
        }
        catch (error) {
            logger_1.logger.error('Error decrypting field value:', error);
            (0, applicationInsights_1.trackMetric)('encryption_decryption_failure', 1);
            return value;
        }
    },
};
const CIPHER_ENVELOPE_MIN_BYTES = 64;
const CIPHER_ENVELOPE_MIN_BASE64 = 88;
function looksLikeCipherEnvelope(value) {
    if (value.length < CIPHER_ENVELOPE_MIN_BASE64) {
        return false;
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        return false;
    }
    try {
        return Buffer.from(value, 'base64').length >= CIPHER_ENVELOPE_MIN_BYTES;
    }
    catch {
        return false;
    }
}
function resolveDecryptedDisplayText(value, placeholder = '[Encrypted message \u2013 unavailable]') {
    if (value === null || value === undefined || value === '') {
        return value ?? '';
    }
    if (!looksLikeCipherEnvelope(value)) {
        return value;
    }
    try {
        return (0, encryption_1.decrypt)(value);
    }
    catch {
        return placeholder;
    }
}
//# sourceMappingURL=encryptionTransformer.js.map