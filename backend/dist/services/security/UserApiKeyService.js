"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserApiKeyService = exports.VALID_SCOPES = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_source_1 = require("../../data-source");
const UserApiKey_1 = require("../../models/UserApiKey");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
exports.VALID_SCOPES = [
    'read:activities',
    'write:activities',
    'read:fleet',
    'read:profile',
    '*',
];
const MAX_KEYS_PER_USER = 10;
const KEY_PREFIX = 'fc_';
class UserApiKeyService {
    repo;
    constructor() {
        this.repo = data_source_1.AppDataSource.getRepository(UserApiKey_1.UserApiKey);
    }
    async createKey(userId, dto, ipAddress) {
        for (const scope of dto.scopes) {
            if (!exports.VALID_SCOPES.includes(scope)) {
                throw new apiErrors_1.ValidationError(`Invalid scope: ${scope}`);
            }
        }
        const existingCount = await this.repo.count({
            where: { userId, revoked: false },
        });
        if (existingCount >= MAX_KEYS_PER_USER) {
            throw new apiErrors_1.ConflictError(`Maximum of ${MAX_KEYS_PER_USER} active API keys allowed`);
        }
        const existingName = await this.repo.findOne({
            where: { userId, name: dto.name, revoked: false },
        });
        if (existingName) {
            throw new apiErrors_1.ConflictError(`An active API key with the name "${dto.name}" already exists`);
        }
        const rawRandom = node_crypto_1.default.randomBytes(20).toString('hex');
        const rawKey = `${KEY_PREFIX}${rawRandom}`;
        const prefix = rawKey.slice(0, 12);
        const tokenHash = node_crypto_1.default.createHash('sha256').update(rawKey).digest('hex');
        let expiresAt;
        if (dto.expiresInDays) {
            expiresAt = new Date(Date.now() + dto.expiresInDays * 86400000);
        }
        const apiKey = this.repo.create({
            userId,
            name: dto.name,
            prefix,
            tokenHash,
            scopes: dto.scopes,
            expiresAt,
            createdByIp: ipAddress,
        });
        const saved = await this.repo.save(apiKey);
        logger_1.logger.info('UserApiKeyService.createKey: API key created', {
            userId,
            keyId: saved.id,
            prefix,
            scopes: dto.scopes,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.SECURITY,
            action: 'API_KEY_CREATED',
            message: `API key created for user ${userId}: ${prefix}... (${dto.scopes.join(', ')})`,
            userId,
            resource: `apikey/${saved.id}`,
            metadata: { prefix, scopes: dto.scopes, expiresInDays: dto.expiresInDays },
        });
        return {
            rawKey,
            id: saved.id,
            name: saved.name,
            prefix: saved.prefix,
            scopes: saved.scopes,
            expiresAt: saved.expiresAt?.toISOString() ?? null,
            createdAt: saved.createdAt.toISOString(),
        };
    }
    async listKeys(userId) {
        return this.repo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            select: [
                'id',
                'name',
                'prefix',
                'scopes',
                'expiresAt',
                'revoked',
                'revokedAt',
                'lastUsedAt',
                'createdAt',
            ],
        });
    }
    async getKey(userId, keyId) {
        const key = await this.repo.findOne({
            where: { id: keyId, userId },
            select: [
                'id',
                'name',
                'prefix',
                'scopes',
                'expiresAt',
                'revoked',
                'revokedAt',
                'lastUsedAt',
                'createdAt',
            ],
        });
        if (!key) {
            throw new apiErrors_1.NotFoundError('API key not found');
        }
        return key;
    }
    async updateKey(userId, keyId, updates) {
        const key = await this.repo.findOne({ where: { id: keyId, userId } });
        if (!key) {
            throw new apiErrors_1.NotFoundError('API key not found');
        }
        if (key.revoked) {
            throw new apiErrors_1.ValidationError('Cannot update a revoked API key');
        }
        if (updates.scopes) {
            for (const scope of updates.scopes) {
                if (!exports.VALID_SCOPES.includes(scope)) {
                    throw new apiErrors_1.ValidationError(`Invalid scope: ${scope}`);
                }
            }
            key.scopes = updates.scopes;
        }
        if (updates.name) {
            key.name = updates.name;
        }
        return this.repo.save(key);
    }
    async revokeKey(userId, keyId) {
        const key = await this.repo.findOne({ where: { id: keyId, userId } });
        if (!key) {
            throw new apiErrors_1.NotFoundError('API key not found');
        }
        if (key.revoked) {
            throw new apiErrors_1.ValidationError('API key is already revoked');
        }
        key.revoked = true;
        key.revokedAt = new Date();
        await this.repo.save(key);
        logger_1.logger.info('UserApiKeyService.revokeKey: API key revoked', {
            userId,
            keyId,
            prefix: key.prefix,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.SECURITY,
            action: 'API_KEY_REVOKED',
            message: `API key revoked for user ${userId}: ${key.prefix}...`,
            userId,
            resource: `apikey/${keyId}`,
            metadata: { prefix: key.prefix },
        });
    }
    async validateKey(rawKey, requiredScope, ipAddress) {
        const tokenHash = node_crypto_1.default.createHash('sha256').update(rawKey).digest('hex');
        const key = await this.repo.findOne({ where: { tokenHash } });
        if (!key) {
            return null;
        }
        if (!key.isValid()) {
            return null;
        }
        if (requiredScope && !key.hasScope(requiredScope)) {
            return null;
        }
        this.repo
            .update(key.id, {
            lastUsedAt: new Date(),
            lastUsedIp: ipAddress,
        })
            .catch(err => {
            logger_1.logger.error('Failed to update API key lastUsedAt', err);
        });
        return {
            userId: key.userId,
            keyId: key.id,
            scopes: key.scopes,
        };
    }
}
exports.UserApiKeyService = UserApiKeyService;
//# sourceMappingURL=UserApiKeyService.js.map