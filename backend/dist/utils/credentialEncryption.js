"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptCredential = encryptCredential;
exports.decryptCredential = decryptCredential;
exports.encryptAuthConfig = encryptAuthConfig;
exports.decryptAuthConfig = decryptAuthConfig;
const crypto = __importStar(require("node:crypto"));
const logger_1 = require("./logger");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const getPbkdf2Salt = () => {
    const salt = process.env.CREDENTIAL_ENCRYPTION_SALT;
    if (salt) {
        return salt;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('CREDENTIAL_ENCRYPTION_SALT must be set in production');
    }
    const fallback = process.env.JWT_SECRET;
    if (!fallback) {
        throw new Error('CREDENTIAL_ENCRYPTION_SALT or JWT_SECRET must be set for credential encryption');
    }
    logger_1.logger.warn('Using JWT_SECRET as CREDENTIAL_ENCRYPTION_SALT fallback. Set CREDENTIAL_ENCRYPTION_SALT in production.');
    return fallback;
};
let cachedKey = null;
let cachedSecret = null;
function getEncryptionKey() {
    const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CREDENTIAL_ENCRYPTION_KEY must be set in production for credential encryption. ' +
                'Do not reuse JWT_SECRET as it couples two security domains and can cause ' +
                'credential decryption failures on JWT key rotation.');
        }
        const fallback = process.env.JWT_SECRET;
        if (!fallback) {
            throw new Error('CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET must be set for credential encryption');
        }
        logger_1.logger.warn('Using JWT_SECRET as CREDENTIAL_ENCRYPTION_KEY fallback. ' +
            'This is only allowed in development. Set CREDENTIAL_ENCRYPTION_KEY in production.');
        if (cachedKey && cachedSecret === fallback) {
            return cachedKey;
        }
        const salt = getPbkdf2Salt();
        cachedSecret = fallback;
        cachedKey = crypto.pbkdf2Sync(fallback, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
        return cachedKey;
    }
    if (cachedKey && cachedSecret === secret) {
        return cachedKey;
    }
    const salt = getPbkdf2Salt();
    cachedSecret = secret;
    cachedKey = crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
    return cachedKey;
}
function encryptCredential(plaintext) {
    if (!plaintext) {
        return plaintext;
    }
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    }
    catch (error) {
        logger_1.logger.error('Failed to encrypt credential', { error });
        throw new Error('Credential encryption failed');
    }
}
function decryptCredential(encrypted) {
    if (!encrypted) {
        return encrypted;
    }
    if (!encrypted.includes(':')) {
        logger_1.logger.debug('Found unencrypted credential — returning as-is (legacy data)');
        return encrypted;
    }
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
        logger_1.logger.debug('Credential has colons but not in encrypted format (3 parts) — treating as legacy');
        return encrypted;
    }
    try {
        const [ivB64, authTagB64, ciphertext] = parts;
        const key = getEncryptionKey();
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        if (iv.length !== IV_LENGTH) {
            throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
        }
        if (authTag.length !== AUTH_TAG_LENGTH) {
            throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
        }
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        logger_1.logger.error('Failed to decrypt credential in expected format — possible tampering or wrong key', { error });
        throw error;
    }
}
function encryptAuthConfig(config) {
    if (!config) {
        return config;
    }
    const encrypted = { ...config };
    const sensitiveFields = ['password', 'token', 'apiKey'];
    for (const field of sensitiveFields) {
        if (encrypted[field] && typeof encrypted[field] === 'string') {
            encrypted[field] = encryptCredential(encrypted[field]);
        }
    }
    const oauth2Config = encrypted.oauth2Config;
    if (oauth2Config?.clientSecret && typeof oauth2Config.clientSecret === 'string') {
        encrypted.oauth2Config = {
            ...oauth2Config,
            clientSecret: encryptCredential(oauth2Config.clientSecret),
        };
    }
    return encrypted;
}
function decryptAuthConfig(config) {
    if (!config) {
        return config;
    }
    const decrypted = { ...config };
    const sensitiveFields = ['password', 'token', 'apiKey'];
    for (const field of sensitiveFields) {
        if (decrypted[field] && typeof decrypted[field] === 'string') {
            decrypted[field] = decryptCredential(decrypted[field]);
        }
    }
    const oauth2Config = decrypted.oauth2Config;
    if (oauth2Config?.clientSecret && typeof oauth2Config.clientSecret === 'string') {
        decrypted.oauth2Config = {
            ...oauth2Config,
            clientSecret: decryptCredential(oauth2Config.clientSecret),
        };
    }
    return decrypted;
}
//# sourceMappingURL=credentialEncryption.js.map