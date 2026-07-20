"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataObfuscationService = exports.ObfuscationLevel = void 0;
const crypto_1 = __importDefault(require("crypto"));
const apiErrors_1 = require("../../utils/apiErrors");
const encryption_1 = require("../../utils/encryption");
const logger_1 = require("../../utils/logger");
const isProduction = process.env.NODE_ENV === 'production';
let useValidKey = true;
if (isProduction && !process.env.ADMIN_ENCRYPTION_KEY) {
    logger_1.logger.error('ADMIN_ENCRYPTION_KEY is required in production environment for secure data obfuscation');
    logger_1.logger.warn('⚠️  Admin data obfuscation will use temporary key - server running in degraded mode');
    useValidKey = false;
}
if (process.env.ADMIN_ENCRYPTION_KEY) {
    const key = process.env.ADMIN_ENCRYPTION_KEY;
    if (!(0, encryption_1.isValidEncryptionKeyFormat)(key, 64)) {
        logger_1.logger.error('ADMIN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)');
        logger_1.logger.warn('Generate with: openssl rand -hex 32');
        logger_1.logger.warn('⚠️  Admin data obfuscation will use temporary key due to invalid format - server running in degraded mode');
        useValidKey = false;
    }
}
const ENCRYPTION_KEY = useValidKey && process.env.ADMIN_ENCRYPTION_KEY
    ? Buffer.from(process.env.ADMIN_ENCRYPTION_KEY, 'hex')
    : crypto_1.default.randomBytes(32);
const ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_AUTH_TAG_LENGTH = 16;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
var ObfuscationLevel;
(function (ObfuscationLevel) {
    ObfuscationLevel["NONE"] = "none";
    ObfuscationLevel["PARTIAL"] = "partial";
    ObfuscationLevel["FULL"] = "full";
    ObfuscationLevel["HASHED"] = "hashed";
    ObfuscationLevel["ENCRYPTED"] = "encrypted";
})(ObfuscationLevel || (exports.ObfuscationLevel = ObfuscationLevel = {}));
const DEFAULT_OBFUSCATION = {
    username: ObfuscationLevel.NONE,
    displayName: ObfuscationLevel.NONE,
    email: ObfuscationLevel.PARTIAL,
    password: ObfuscationLevel.FULL,
    passwordHash: ObfuscationLevel.FULL,
    apiKey: ObfuscationLevel.FULL,
    token: ObfuscationLevel.FULL,
    secret: ObfuscationLevel.FULL,
    description: ObfuscationLevel.ENCRYPTED,
    notes: ObfuscationLevel.ENCRYPTED,
    message: ObfuscationLevel.ENCRYPTED,
    content: ObfuscationLevel.ENCRYPTED,
    userId: ObfuscationLevel.NONE,
    organizationId: ObfuscationLevel.NONE,
    createdAt: ObfuscationLevel.NONE,
    updatedAt: ObfuscationLevel.NONE,
    status: ObfuscationLevel.NONE,
    role: ObfuscationLevel.NONE,
};
class DataObfuscationService {
    static encrypt(text) {
        const iv = crypto_1.default.randomBytes(ENCRYPTION_IV_LENGTH);
        const cipher = crypto_1.default.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }
    static decrypt(encryptedText) {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) {
            throw new apiErrors_1.ValidationError('Invalid encrypted data format');
        }
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        if (iv.length !== ENCRYPTION_IV_LENGTH) {
            throw new apiErrors_1.ValidationError(`Invalid IV length: expected ${ENCRYPTION_IV_LENGTH} bytes, got ${iv.length}`);
        }
        if (authTag.length !== ENCRYPTION_AUTH_TAG_LENGTH) {
            throw new apiErrors_1.ValidationError(`Invalid auth tag length: expected ${ENCRYPTION_AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
        }
        const decipher = crypto_1.default.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv, { authTagLength: ENCRYPTION_AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    static hash(value) {
        return crypto_1.default.createHash('sha256').update(value).digest('hex').substring(0, 16);
    }
    static partialMask(value, type = 'generic') {
        if (!value) {
            return '[EMPTY]';
        }
        if (type === 'email') {
            const [local, domain] = value.split('@');
            if (!domain) {
                return this.partialMask(value, 'generic');
            }
            const maskedLocal = local.length > 2
                ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
                : `${local[0]}*`;
            return `${maskedLocal}@${domain}`;
        }
        if (type === 'username') {
            if (value.length <= 3) {
                return value[0] + '*'.repeat(value.length - 1);
            }
            return (value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2));
        }
        if (value.length <= 4) {
            return '*'.repeat(value.length);
        }
        return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }
    static obfuscateField(fieldName, value, config = DEFAULT_OBFUSCATION) {
        if (value === null || value === undefined) {
            return value;
        }
        const level = config[fieldName] || ObfuscationLevel.NONE;
        const stringValue = String(value);
        switch (level) {
            case ObfuscationLevel.NONE:
                return value;
            case ObfuscationLevel.PARTIAL:
                if (fieldName.toLowerCase().includes('email')) {
                    return this.partialMask(stringValue, 'email');
                }
                else if (fieldName.toLowerCase().includes('username') ||
                    fieldName.toLowerCase().includes('name')) {
                    return this.partialMask(stringValue, 'username');
                }
                return this.partialMask(stringValue, 'generic');
            case ObfuscationLevel.FULL:
                return '[REDACTED]';
            case ObfuscationLevel.HASHED:
                return this.hash(stringValue);
            case ObfuscationLevel.ENCRYPTED:
                return '[ENCRYPTED]';
            default:
                return value;
        }
    }
    static obfuscateObject(obj, config = DEFAULT_OBFUSCATION) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.obfuscateObject(item, config));
        }
        const obfuscated = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                obfuscated[key] = this.obfuscateObject(value, config);
            }
            else {
                obfuscated[key] = this.obfuscateField(key, value, config);
            }
        }
        return obfuscated;
    }
    static obfuscateArray(items, config = DEFAULT_OBFUSCATION) {
        return items.map(item => this.obfuscateObject(item, config));
    }
    static createSummary(data) {
        const stringData = JSON.stringify(data);
        const preview = stringData.length > 50 ? `${stringData.substring(0, 50)}...` : stringData;
        return {
            type: typeof data,
            size: stringData.length,
            hash: this.hash(stringData),
            preview: this.partialMask(preview, 'generic'),
        };
    }
    static obfuscateMetrics(metrics) {
        return {
            totalUsers: metrics.totalUsers,
            totalOrganizations: metrics.totalOrganizations,
            totalActivities: metrics.totalActivities,
            userBreakdown: metrics.userBreakdown ? 'AGGREGATED_DATA' : undefined,
            topUsers: metrics.topUsers
                ? metrics.topUsers.map(u => ({
                    id: this.hash(String(u.id)),
                    count: u.count,
                }))
                : undefined,
            dailyStats: metrics.dailyStats,
            weeklyStats: metrics.weeklyStats,
            errorRate: metrics.errorRate,
            errorCount: metrics.errorCount,
        };
    }
}
exports.DataObfuscationService = DataObfuscationService;
//# sourceMappingURL=DataObfuscationService.js.map