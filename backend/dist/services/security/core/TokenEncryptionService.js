"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenEncryptionService = exports.TokenEncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const errorHandler_1 = require("../../../utils/errorHandler");
const logger_1 = require("../../../utils/logger");
class TokenEncryptionService {
    algorithm = 'aes-256-gcm';
    ivLength = 16;
    authTagLength = 16;
    key;
    constructor() {
        const secret = process.env.TOKEN_ENCRYPTION_KEY;
        const isProduction = process.env.NODE_ENV === 'production';
        if (!secret) {
            if (isProduction) {
                throw new Error('TOKEN_ENCRYPTION_KEY is required in production environment. ' +
                    'Set this environment variable to a secure 32+ character value.');
            }
            else {
                logger_1.logger.warn('TOKEN_ENCRYPTION_KEY not set - generated random development key (INSECURE, not persistent)');
                this.key = crypto_1.default.randomBytes(32);
            }
        }
        else {
            if (secret.length < 32) {
                if (isProduction) {
                    throw new Error(`TOKEN_ENCRYPTION_KEY must be at least 32 characters in production. ` +
                        `Current length: ${secret.length}. ` +
                        `Generate a secure key with: openssl rand -hex 32`);
                }
                else {
                    logger_1.logger.warn('TOKEN_ENCRYPTION_KEY is shorter than recommended 32 characters');
                }
            }
            const salt = process.env.TOKEN_ENCRYPTION_SALT;
            if (!salt) {
                if (isProduction) {
                    throw new Error('TOKEN_ENCRYPTION_SALT is required in production environment. ' +
                        'Set this environment variable to a stable hex string (e.g., 32 hex chars). ' +
                        'Without a stable salt, encrypted data becomes unreadable after restarts.');
                }
                logger_1.logger.warn('TOKEN_ENCRYPTION_SALT not set - generated random development salt (INSECURE, not persistent)');
            }
            const effectiveSalt = salt || crypto_1.default.randomBytes(16).toString('hex');
            this.key = crypto_1.default.scryptSync(secret, effectiveSalt, 32);
        }
        logger_1.logger.info('TokenEncryptionService initialized');
    }
    encrypt(token) {
        try {
            const iv = crypto_1.default.randomBytes(this.ivLength);
            const cipher = crypto_1.default.createCipheriv(this.algorithm, this.key, iv);
            let encrypted = cipher.update(token, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();
            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
            };
        }
        catch (error) {
            logger_1.logger.error('Token encryption failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw new Error('Failed to encrypt token');
        }
    }
    decrypt(encrypted, iv, authTag) {
        try {
            const ivBuffer = Buffer.from(iv, 'hex');
            const authTagBuffer = Buffer.from(authTag, 'hex');
            if (ivBuffer.length !== this.ivLength) {
                throw new Error(`Invalid IV length: expected ${this.ivLength} bytes, got ${ivBuffer.length}`);
            }
            if (authTagBuffer.length !== this.authTagLength) {
                throw new Error(`Invalid auth tag length: expected ${this.authTagLength} bytes, got ${authTagBuffer.length}`);
            }
            const decipher = crypto_1.default.createDecipheriv(this.algorithm, this.key, ivBuffer, {
                authTagLength: this.authTagLength,
            });
            decipher.setAuthTag(authTagBuffer);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            logger_1.logger.error('Token decryption failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw new Error('Failed to decrypt token');
        }
    }
    test() {
        try {
            const testToken = `test-token-${crypto_1.default.randomBytes(32).toString('hex')}`;
            const { encrypted, iv, authTag } = this.encrypt(testToken);
            const decrypted = this.decrypt(encrypted, iv, authTag);
            return testToken === decrypted;
        }
        catch (_error) {
            return false;
        }
    }
}
exports.TokenEncryptionService = TokenEncryptionService;
let instance = null;
const getTokenEncryptionService = () => {
    if (!instance) {
        instance = new TokenEncryptionService();
        if (!instance.test()) {
            logger_1.logger.error('Token encryption service test failed!');
            logger_1.logger.warn('⚠️  Token encryption may not work correctly - server running in degraded mode');
        }
    }
    return instance;
};
exports.getTokenEncryptionService = getTokenEncryptionService;
//# sourceMappingURL=TokenEncryptionService.js.map