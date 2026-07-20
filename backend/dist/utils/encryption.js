"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.obfuscateEmail = obfuscateEmail;
exports.obfuscateIP = obfuscateIP;
exports.obfuscateUsername = obfuscateUsername;
exports.obfuscateUserAgent = obfuscateUserAgent;
exports.hashValue = hashValue;
exports.isValidEncryptionKeyFormat = isValidEncryptionKeyFormat;
const node_crypto_1 = __importDefault(require("node:crypto"));
const logger_1 = require("./logger");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
let devEncryptionKey = null;
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('ENCRYPTION_KEY is required in production environment');
        }
        if (!devEncryptionKey) {
            devEncryptionKey = node_crypto_1.default.randomBytes(32).toString('hex');
            logger_1.logger.warn('ENCRYPTION_KEY not set - generated random development key (INSECURE, not persistent)');
        }
        return devEncryptionKey;
    }
    if (key.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
    return key;
}
function deriveKey(salt) {
    const key = getEncryptionKey();
    return node_crypto_1.default.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
}
function encrypt(plaintext) {
    if (!plaintext) {
        return plaintext;
    }
    try {
        const salt = node_crypto_1.default.randomBytes(SALT_LENGTH);
        const iv = node_crypto_1.default.randomBytes(IV_LENGTH);
        const key = deriveKey(salt);
        const cipher = node_crypto_1.default.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        const result = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'base64')]).toString('base64');
        return result;
    }
    catch (error) {
        logger_1.logger.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}
function decrypt(encryptedData) {
    if (!encryptedData) {
        return encryptedData;
    }
    try {
        const buffer = Buffer.from(encryptedData, 'base64');
        const minimumLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
        if (buffer.length < minimumLength) {
            throw new Error(`Invalid encrypted data length: expected at least ${minimumLength} bytes`);
        }
        const salt = buffer.subarray(0, SALT_LENGTH);
        const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const key = deriveKey(salt);
        if (iv.length !== IV_LENGTH) {
            throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
        }
        if (authTag.length !== AUTH_TAG_LENGTH) {
            throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
        }
        const decipher = node_crypto_1.default.createDecipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        logger_1.logger.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}
function obfuscateEmail(email) {
    if (!email?.includes('@')) {
        return '***';
    }
    try {
        const [localPart, domain] = email.split('@');
        if (!localPart || !domain) {
            return '***';
        }
        let obfuscatedLocal;
        if (localPart.length > 2) {
            obfuscatedLocal = `${localPart[0]}***${localPart.at(-1)}`;
        }
        else if (localPart.length === 2) {
            obfuscatedLocal = `${localPart[0]}*`;
        }
        else {
            obfuscatedLocal = '*';
        }
        const domainParts = domain.split('.');
        const obfuscatedDomain = domainParts
            .map(part => {
            if (part.length > 2) {
                return `${part[0]}***${part.at(-1)}`;
            }
            else if (part.length === 2) {
                return `${part[0]}*`;
            }
            else {
                return part;
            }
        })
            .join('.');
        return `${obfuscatedLocal}@${obfuscatedDomain}`;
    }
    catch {
        return '***';
    }
}
function obfuscateIP(ip) {
    if (!ip) {
        return '***';
    }
    try {
        if (ip.includes('.')) {
            const parts = ip.split('.');
            if (parts.length === 4) {
                return `${parts[0]}.${parts[1]}.***.***`;
            }
        }
        if (ip.includes(':')) {
            const parts = ip.split(':');
            if (parts.length >= 3) {
                return `${parts[0]}:${parts[1]}:${parts[2]}:****:****:****:****:****`;
            }
        }
        return '***';
    }
    catch {
        return '***';
    }
}
function obfuscateUsername(username) {
    if (!username) {
        return '***';
    }
    if (username.length <= 2) {
        return '*'.repeat(username.length);
    }
    return `${username[0]}***${username.at(-1)}`;
}
function obfuscateUserAgent(userAgent) {
    if (!userAgent) {
        return '***';
    }
    try {
        const browserMatch = /(Chrome|Firefox|Safari|Edge|Opera)/i.exec(userAgent);
        if (browserMatch) {
            return `${browserMatch[1]}/***`;
        }
        return 'Browser/***';
    }
    catch {
        return '***';
    }
}
function hashValue(value) {
    if (!value) {
        return '';
    }
    return node_crypto_1.default.createHash('sha256').update(value).digest('hex');
}
function isValidEncryptionKeyFormat(key, expectedLength = 64) {
    if (!key) {
        return false;
    }
    const hexPattern = new RegExp(`^[0-9a-fA-F]{${expectedLength}}$`);
    return hexPattern.test(key);
}
//# sourceMappingURL=encryption.js.map