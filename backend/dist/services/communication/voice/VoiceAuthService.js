"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceAuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const data_source_1 = require("../../../data-source");
const Organization_1 = require("../../../models/Organization");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const apiErrors_1 = require("../../../utils/apiErrors");
const logger_1 = require("../../../utils/logger");
const redis_1 = require("../../../utils/redis");
const TOKEN_TTL_SECONDS = 4 * 60 * 60;
const TOKEN_CACHE_PREFIX = 'voice:auth:';
const DEFAULT_SERVER_SCOPE = 'platform';
class VoiceAuthService {
    static instance;
    membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    constructor() {
        logger_1.logger.info('VoiceAuthService initialized');
    }
    static getInstance() {
        if (!VoiceAuthService.instance) {
            VoiceAuthService.instance = new VoiceAuthService();
        }
        return VoiceAuthService.instance;
    }
    async generateToken(userId, username, connectUrl, serverScope = DEFAULT_SERVER_SCOPE) {
        const secret = this.getTokenSecret();
        const timestamp = Date.now();
        const payload = `${userId}:${timestamp}:${serverScope}`;
        const token = crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
        const expiresAt = new Date(timestamp + TOKEN_TTL_SECONDS * 1000).toISOString();
        await redis_1.cache.set(`${TOKEN_CACHE_PREFIX}${token}`, { userId, username, timestamp, serverScope }, TOKEN_TTL_SECONDS);
        const url = new URL(connectUrl);
        const authenticatedUrl = `mumble://${encodeURIComponent(username)}:${token}@${url.hostname}:${url.port || '64738'}/`;
        return {
            token,
            expiresAt,
            connectUrl: authenticatedUrl,
            username,
        };
    }
    async validateToken(token, mumbleUsername) {
        const cached = await redis_1.cache.get(`${TOKEN_CACHE_PREFIX}${token}`);
        if (!cached) {
            return { valid: false };
        }
        if (cached.username !== mumbleUsername) {
            logger_1.logger.warn('Voice auth token username mismatch', {
                expected: cached.username,
                got: mumbleUsername,
            });
            return { valid: false };
        }
        const membership = await this.membershipRepo.findOne({
            where: { userId: cached.userId, isActive: true },
            relations: ['role'],
        });
        if (!membership) {
            return {
                valid: true,
                userId: cached.userId,
                username: cached.username,
                groups: ['authenticated'],
            };
        }
        const org = await this.orgRepo.findOne({
            where: { id: membership.organizationId },
            select: ['id', 'name'],
        });
        const groups = this.mapRoleToGroups(membership.role?.name ?? 'member');
        return {
            valid: true,
            userId: cached.userId,
            username: cached.username,
            organizationId: membership.organizationId,
            organizationName: org?.name,
            role: membership.role?.name,
            groups,
        };
    }
    async revokeToken(token) {
        await redis_1.cache.del(`${TOKEN_CACHE_PREFIX}${token}`);
    }
    async revokeUserTokens(userId, serverScope) {
        const keys = await redis_1.cache.keys(`${TOKEN_CACHE_PREFIX}*`);
        let revoked = 0;
        for (const key of keys) {
            const data = await redis_1.cache.get(key);
            if (data?.userId !== userId) {
                continue;
            }
            if (serverScope && (data.serverScope ?? DEFAULT_SERVER_SCOPE) !== serverScope) {
                continue;
            }
            await redis_1.cache.del(key);
            revoked++;
        }
        if (revoked > 0) {
            logger_1.logger.info('Revoked voice auth tokens for user', { userId, serverScope, count: revoked });
        }
        return revoked;
    }
    async revokeServerTokens(serverScope) {
        const keys = await redis_1.cache.keys(`${TOKEN_CACHE_PREFIX}*`);
        let revoked = 0;
        for (const key of keys) {
            const data = await redis_1.cache.get(key);
            if ((data?.serverScope ?? DEFAULT_SERVER_SCOPE) !== serverScope) {
                continue;
            }
            await redis_1.cache.del(key);
            revoked++;
        }
        if (revoked > 0) {
            logger_1.logger.info('Revoked voice auth tokens for server', { serverScope, count: revoked });
        }
        return revoked;
    }
    mapRoleToGroups(roleName) {
        const groups = ['authenticated'];
        switch (roleName.toLowerCase()) {
            case 'owner':
            case 'founder':
                groups.push('admin', 'officer', 'member');
                break;
            case 'admin':
                groups.push('admin', 'officer', 'member');
                break;
            case 'officer':
            case 'fleet_commander':
                groups.push('officer', 'member');
                break;
            case 'member':
            default:
                groups.push('member');
                break;
        }
        return groups;
    }
    getTokenSecret() {
        const secret = process.env.VOICE_AUTH_TOKEN_SECRET;
        if (!secret) {
            throw new apiErrors_1.ValidationError('VOICE_AUTH_TOKEN_SECRET must be configured. Generate with: openssl rand -hex 32');
        }
        return secret;
    }
}
exports.VoiceAuthService = VoiceAuthService;
//# sourceMappingURL=VoiceAuthService.js.map