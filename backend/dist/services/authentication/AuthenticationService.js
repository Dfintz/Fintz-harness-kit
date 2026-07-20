"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_cache_1 = __importDefault(require("node-cache"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const RefreshToken_1 = require("../../models/RefreshToken");
const TokenBlacklist_1 = require("../../models/TokenBlacklist");
const User_1 = require("../../models/User");
const UserSession_1 = require("../../models/UserSession");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const security_1 = require("../security");
class AuthenticationService {
    refreshTokenRepository;
    sessionRepository;
    blacklistRepository;
    userRepository;
    encryptionService;
    blacklistCache;
    config;
    static devAccessTokenSecret = null;
    static devSecretWarningLogged = false;
    constructor() {
        this.refreshTokenRepository = data_source_1.AppDataSource.getRepository(RefreshToken_1.RefreshToken);
        this.sessionRepository = data_source_1.AppDataSource.getRepository(UserSession_1.UserSession);
        this.blacklistRepository = data_source_1.AppDataSource.getRepository(TokenBlacklist_1.TokenBlacklist);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.encryptionService = (0, security_1.getTokenEncryptionService)();
        this.config = {
            accessTokenSecret: this.getAccessTokenSecret(),
            accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '1h',
            refreshTokenExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7'),
            sessionAbsoluteTimeout: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '604800000'),
            sessionIdleTimeout: parseInt(process.env.SESSION_IDLE_TIMEOUT || '14400000'),
            blacklistCacheTTL: parseInt(process.env.BLACKLIST_CACHE_TTL || '3600'),
            blacklistCacheCheckPeriod: parseInt(process.env.BLACKLIST_CACHE_CHECK_PERIOD || '600'),
        };
        this.blacklistCache = new node_cache_1.default({
            stdTTL: this.config.blacklistCacheTTL,
            checkperiod: this.config.blacklistCacheCheckPeriod,
            useClones: false,
        });
        logger_1.logger.info('AuthenticationService initialized', {
            accessTokenExpiry: this.config.accessTokenExpiry,
            refreshTokenExpiryDays: this.config.refreshTokenExpiryDays,
            sessionAbsoluteTimeout: `${this.config.sessionAbsoluteTimeout / 1000 / 60 / 60} hours`,
            sessionIdleTimeout: `${this.config.sessionIdleTimeout / 1000 / 60} minutes`,
            blacklistCacheTTL: `${this.config.blacklistCacheTTL}s`,
        });
    }
    getAccessTokenSecret() {
        const envSecret = process.env.JWT_SECRET;
        if (envSecret) {
            return envSecret;
        }
        if (process.env.NODE_ENV === 'production') {
            throw new apiErrors_1.ValidationError('JWT_SECRET is required in production environment');
        }
        if (!AuthenticationService.devAccessTokenSecret) {
            AuthenticationService.devAccessTokenSecret = crypto_1.default.randomBytes(32).toString('hex');
            if (!AuthenticationService.devSecretWarningLogged) {
                AuthenticationService.devSecretWarningLogged = true;
                logger_1.logger.warn('⚠️  SECURITY WARNING: JWT_SECRET environment variable not set!');
                logger_1.logger.warn('⚠️  Generated random development JWT secret (this is INSECURE and not persistent)');
                logger_1.logger.warn('⚠️  All tokens will be invalidated on server restart');
                logger_1.logger.warn('⚠️  To fix: Set JWT_SECRET environment variable with a secure 32+ character value');
            }
        }
        return AuthenticationService.devAccessTokenSecret;
    }
    generateAccessToken(payload, sessionBinding) {
        const jti = crypto_1.default.randomUUID();
        const fullPayload = { ...payload };
        if (sessionBinding) {
            fullPayload.sessionBinding = sessionBinding;
        }
        return jsonwebtoken_1.default.sign(fullPayload, this.config.accessTokenSecret, {
            algorithm: 'HS256',
            expiresIn: this.config.accessTokenExpiry,
            jwtid: jti,
        });
    }
    async generateTokens(user, metadata) {
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
        };
        const accessToken = this.generateAccessToken(payload, metadata?.sessionBinding);
        const { token: refreshToken } = await this.generateRefreshToken(user.id, metadata?.ipAddress, metadata?.userAgent, undefined, metadata?.location);
        const decoded = jsonwebtoken_1.default.decode(accessToken);
        const expiresIn = decoded.exp - decoded.iat;
        logger_1.logger.info('Token pair generated', {
            userId: user.id,
            jti: decoded.jti,
            expiresIn,
        });
        return {
            accessToken,
            refreshToken,
            expiresIn,
        };
    }
    async validateAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.config.accessTokenSecret, {
                algorithms: ['HS256'],
            });
            if (await this.isTokenBlacklisted(decoded.jti)) {
                throw new apiErrors_1.UnauthorizedError('Token has been revoked');
            }
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new apiErrors_1.UnauthorizedError('Token expired');
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new apiErrors_1.UnauthorizedError('Invalid token');
            }
            throw error;
        }
    }
    async refreshTokens(refreshToken, metadata) {
        const rotationResult = await this.rotateRefreshToken(refreshToken, metadata?.ipAddress, metadata?.userAgent, metadata?.location);
        if (!rotationResult) {
            throw new apiErrors_1.UnauthorizedError('Invalid or expired refresh token');
        }
        const { token: newRefreshToken, refreshTokenRecord } = rotationResult;
        const userId = refreshTokenRecord.userId;
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        const payload = {
            id: userId,
            username: user.username,
            role: user.role,
        };
        const accessToken = this.generateAccessToken(payload, metadata?.sessionBinding);
        const decoded = jsonwebtoken_1.default.decode(accessToken);
        const expiresIn = decoded.exp - decoded.iat;
        logger_1.logger.info('Tokens refreshed', {
            userId,
            jti: decoded.jti,
        });
        return {
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn,
        };
    }
    async revokeAccessToken(token, reason, metadata) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded?.jti) {
                throw new apiErrors_1.ValidationError('Invalid token format');
            }
            const jti = decoded.jti;
            if (await this.isTokenBlacklisted(jti)) {
                logger_1.logger.debug('Token already blacklisted', { jti });
                return;
            }
            const expiresAt = new Date(decoded.exp * 1000);
            const blacklistEntry = this.blacklistRepository.create({
                tokenJti: jti,
                userId: decoded.sub,
                expiresAt,
                reason: reason || 'User logout',
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent,
            });
            await this.blacklistRepository.save(blacklistEntry);
            this.blacklistCache.set(jti, true, this.config.blacklistCacheTTL);
            logger_1.logger.info('Access token revoked', {
                jti,
                reason,
                expiresAt,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke access token', { error });
            throw error;
        }
    }
    async isTokenBlacklisted(jti) {
        const cached = this.blacklistCache.get(jti);
        if (cached !== undefined) {
            return cached;
        }
        const blacklisted = await this.blacklistRepository.findOne({
            where: { tokenJti: jti },
        });
        const isBlacklisted = !!blacklisted;
        this.blacklistCache.set(jti, isBlacklisted, this.config.blacklistCacheTTL);
        return isBlacklisted;
    }
    async generateRefreshToken(userId, ipAddress, userAgent, parentToken, location) {
        const token = crypto_1.default.randomBytes(64).toString('hex');
        const tokenHash = this.hashToken(token);
        const { encrypted, iv, authTag } = this.encryptionService.encrypt(token);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.config.refreshTokenExpiryDays);
        const familyId = parentToken?.familyId || crypto_1.default.randomUUID();
        const refreshTokenRecord = this.refreshTokenRepository.create({
            userId,
            tokenHash,
            tokenEncrypted: encrypted,
            encryptionIv: iv,
            encryptionAuthTag: authTag,
            familyId,
            parentTokenId: parentToken?.id,
            expiresAt,
            ipAddress,
            userAgent,
            location,
            revoked: false,
        });
        await this.refreshTokenRepository.save(refreshTokenRecord);
        logger_1.logger.info('Refresh token generated', {
            userId,
            familyId,
            hasParent: !!parentToken,
        });
        return { token, refreshTokenRecord };
    }
    async verifyRefreshToken(token) {
        const tokenHash = this.hashToken(token);
        const refreshToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash },
        });
        if (!refreshToken) {
            return null;
        }
        if (refreshToken.revoked) {
            return null;
        }
        if (new Date() > refreshToken.expiresAt) {
            return null;
        }
        return refreshToken;
    }
    async rotateRefreshToken(oldToken, ipAddress, userAgent, location) {
        const tokenHash = this.hashToken(oldToken);
        const oldRefreshToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash },
        });
        if (!oldRefreshToken) {
            return null;
        }
        if (oldRefreshToken.revoked && oldRefreshToken.familyId) {
            logger_1.logger.error('Token reuse detected - possible security breach!', {
                userId: oldRefreshToken.userId,
                familyId: oldRefreshToken.familyId,
                tokenId: oldRefreshToken.id,
                ipAddress,
            });
            await this.revokeTokenFamily(oldRefreshToken.familyId);
            throw new apiErrors_1.ForbiddenError('Token reuse detected - all tokens in family have been revoked for security');
        }
        if (new Date() > oldRefreshToken.expiresAt) {
            return null;
        }
        oldRefreshToken.lastUsedAt = new Date();
        const { token: newToken, refreshTokenRecord: newRefreshToken } = await this.generateRefreshToken(oldRefreshToken.userId, ipAddress, userAgent, oldRefreshToken, location);
        oldRefreshToken.revoked = true;
        oldRefreshToken.revokedAt = new Date();
        oldRefreshToken.replacedByToken = newRefreshToken.id;
        await this.refreshTokenRepository.save(oldRefreshToken);
        logger_1.logger.info('Refresh token rotated', {
            userId: oldRefreshToken.userId,
            familyId: oldRefreshToken.familyId,
            oldTokenId: oldRefreshToken.id,
            newTokenId: newRefreshToken.id,
        });
        return { token: newToken, refreshTokenRecord: newRefreshToken };
    }
    async revokeTokenFamily(familyId) {
        const result = await this.refreshTokenRepository.update({ familyId, revoked: false }, { revoked: true, revokedAt: new Date() });
        const revokedCount = result.affected || 0;
        logger_1.logger.warn('Token family revoked due to breach detection', {
            familyId,
            revokedCount,
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
            resource: 'auth.tokenFamily',
            action: 'revoke_family',
            message: `Token family revoked (breach detection): familyId=${familyId}, count=${revokedCount}`,
            metadata: { familyId, revokedCount },
        });
        return revokedCount;
    }
    async revokeRefreshToken(token) {
        const tokenHash = this.hashToken(token);
        const refreshToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash },
        });
        if (!refreshToken || refreshToken.revoked) {
            return false;
        }
        refreshToken.revoked = true;
        refreshToken.revokedAt = new Date();
        await this.refreshTokenRepository.save(refreshToken);
        logger_1.logger.info('Refresh token revoked', {
            userId: refreshToken.userId,
            tokenId: refreshToken.id,
        });
        return true;
    }
    async revokeRefreshTokenById(tokenId, userId) {
        const refreshToken = await this.refreshTokenRepository.findOne({
            where: { id: tokenId, userId },
        });
        if (!refreshToken || refreshToken.revoked) {
            return false;
        }
        refreshToken.revoked = true;
        refreshToken.revokedAt = new Date();
        await this.refreshTokenRepository.save(refreshToken);
        logger_1.logger.info('Refresh token revoked by ID', {
            userId,
            tokenId,
        });
        return true;
    }
    async revokeAllUserTokens(userId) {
        const result = await this.refreshTokenRepository.update({ userId, revoked: false }, { revoked: true, revokedAt: new Date() });
        const revokedCount = result.affected || 0;
        logger_1.logger.info('All user refresh tokens revoked', {
            userId,
            revokedCount,
        });
        return revokedCount;
    }
    async getUserRefreshTokens(userId) {
        const tokens = await this.refreshTokenRepository.find({
            where: { userId, revoked: false, expiresAt: (0, typeorm_1.MoreThan)(new Date()) },
            order: { createdAt: 'DESC' },
        });
        return tokens.map(token => ({
            id: token.id,
            familyId: token.familyId || '',
            createdAt: token.createdAt,
            expiresAt: token.expiresAt,
            lastUsedAt: token.lastUsedAt,
            ipAddress: token.ipAddress,
            userAgent: token.userAgent,
        }));
    }
    async detectTokenReuse(token) {
        const refreshToken = await this.verifyRefreshToken(token);
        return refreshToken?.revoked || false;
    }
    async createSession(userId, sessionToken, discordTokens, metadata) {
        const now = new Date();
        const session = this.sessionRepository.create({
            userId,
            sessionToken,
            discordAccessToken: discordTokens.access_token,
            discordRefreshToken: discordTokens.refresh_token,
            discordTokenExpiry: new Date(now.getTime() + discordTokens.expires_in * 1000),
            lastActivity: now,
            expiresAt: new Date(now.getTime() + this.config.sessionAbsoluteTimeout),
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
        });
        await this.sessionRepository.save(session);
        logger_1.logger.info('Session created', {
            userId,
            sessionToken: `${sessionToken.substring(0, 10)}...`,
            expiresAt: session.expiresAt,
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.AUTH_SUCCESS,
            userId: String(userId),
            resource: 'auth.session',
            action: 'create',
            message: `Session created for user ${userId}`,
            metadata: { ipAddress: metadata?.ipAddress, userAgent: metadata?.userAgent },
        });
        return session;
    }
    async getSession(sessionToken) {
        return this.sessionRepository.findOne({
            where: { sessionToken, isActive: true },
        });
    }
    async getUserSessions(userId) {
        const sessions = await this.sessionRepository.find({
            where: { userId, isActive: true },
            order: { lastActivity: 'DESC' },
        });
        return sessions.map(session => ({
            id: session.id,
            sessionToken: session.sessionToken,
            userId: session.userId,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            isActive: session.isActive,
        }));
    }
    async updateActivity(sessionToken) {
        const session = await this.getSession(sessionToken);
        if (session) {
            session.lastActivity = new Date();
            await this.sessionRepository.save(session);
        }
    }
    async updateDiscordTokens(sessionToken, accessToken, refreshToken, expiresIn) {
        const session = await this.getSession(sessionToken);
        if (session) {
            session.discordAccessToken = accessToken;
            session.discordRefreshToken = refreshToken;
            session.discordTokenExpiry = new Date(Date.now() + expiresIn * 1000);
            await this.sessionRepository.save(session);
            logger_1.logger.info('Discord tokens updated in session', {
                sessionToken: `${sessionToken.substring(0, 10)}...`,
            });
        }
    }
    isSessionValid(session) {
        const now = new Date();
        if (session.expiresAt < now) {
            logger_1.logger.info('Session expired (absolute timeout)', {
                sessionToken: `${session.sessionToken.substring(0, 10)}...`,
                expiresAt: session.expiresAt,
            });
            return false;
        }
        const idleTime = now.getTime() - session.lastActivity.getTime();
        if (idleTime > this.config.sessionIdleTimeout) {
            logger_1.logger.info('Session expired (idle timeout)', {
                sessionToken: `${session.sessionToken.substring(0, 10)}...`,
                idleMinutes: Math.round(idleTime / 1000 / 60),
            });
            return false;
        }
        return true;
    }
    async terminateSession(sessionToken) {
        await this.sessionRepository.update({ sessionToken }, { isActive: false });
        logger_1.logger.info('Session terminated', {
            sessionToken: `${sessionToken.substring(0, 10)}...`,
        });
    }
    async terminateSessionById(sessionId, userId) {
        const session = await this.sessionRepository.findOne({
            where: { id: sessionId, userId, isActive: true },
        });
        if (!session) {
            return false;
        }
        session.isActive = false;
        await this.sessionRepository.save(session);
        logger_1.logger.info('Session terminated by ID', {
            userId,
            sessionId,
        });
        return true;
    }
    async terminateAllUserSessions(userId) {
        const result = await this.sessionRepository.update({ userId, isActive: true }, { isActive: false });
        const terminatedCount = result.affected || 0;
        logger_1.logger.info('All user sessions terminated', {
            userId,
            terminatedCount,
        });
        return terminatedCount;
    }
    async cleanupExpiredTokens() {
        const now = new Date();
        const result = await this.refreshTokenRepository
            .createQueryBuilder()
            .delete()
            .where('expiresAt < :now', { now })
            .execute();
        const cleanedCount = result.affected || 0;
        if (cleanedCount > 0) {
            logger_1.logger.info('Cleaned up expired refresh tokens', { count: cleanedCount });
        }
        return cleanedCount;
    }
    async cleanupExpiredSessions() {
        const now = new Date();
        const idleThreshold = new Date(now.getTime() - this.config.sessionIdleTimeout);
        const result = await this.sessionRepository
            .createQueryBuilder()
            .update()
            .set({ isActive: false })
            .where('isActive = :isActive', { isActive: true })
            .andWhere('(expiresAt < :now OR lastActivity < :idleThreshold)', { now, idleThreshold })
            .execute();
        const cleanedCount = result.affected || 0;
        if (cleanedCount > 0) {
            logger_1.logger.info('Cleaned up expired sessions', { count: cleanedCount });
        }
        return cleanedCount;
    }
    async cleanupExpiredBlacklist() {
        const now = new Date();
        const result = await this.blacklistRepository
            .createQueryBuilder()
            .delete()
            .where('expiresAt < :now', { now })
            .execute();
        const cleanedCount = result.affected || 0;
        if (cleanedCount > 0) {
            logger_1.logger.info('Cleaned up expired blacklist entries', { count: cleanedCount });
            this.blacklistCache.flushAll();
        }
        return cleanedCount;
    }
    hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
    async getStats() {
        const activeSessions = await this.sessionRepository.count({
            where: { isActive: true },
        });
        const activeRefreshTokens = await this.refreshTokenRepository.count({
            where: { revoked: false },
        });
        const blacklistedTokens = await this.blacklistRepository.count();
        const cacheSize = this.blacklistCache.keys().length;
        return {
            activeSessions,
            activeRefreshTokens,
            blacklistedTokens,
            cacheSize,
        };
    }
}
exports.AuthenticationService = AuthenticationService;
//# sourceMappingURL=AuthenticationService.js.map