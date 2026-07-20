"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebAuthnService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const server_1 = require("@simplewebauthn/server");
const urls_1 = require("../../config/urls");
const data_source_1 = require("../../data-source");
const User_1 = require("../../models/User");
const WebAuthnCredential_1 = require("../../models/WebAuthnCredential");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
class WebAuthnService {
    credentialRepository;
    userRepository;
    config;
    static CHALLENGE_KEY_PREFIX = 'webauthn:challenge:';
    fallbackChallenges = new Map();
    challengeCleanupInterval = null;
    constructor() {
        this.credentialRepository = data_source_1.AppDataSource.getRepository(WebAuthnCredential_1.WebAuthnCredential);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.config = {
            rpName: process.env.WEBAUTHN_RP_NAME || 'Star Citizen Fleet Manager',
            rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
            origin: process.env.WEBAUTHN_ORIGIN || (0, urls_1.getFrontendUrl)(),
            timeout: parseInt(process.env.WEBAUTHN_TIMEOUT || '60000'),
            challengeTTL: parseInt(process.env.WEBAUTHN_CHALLENGE_TTL || '300'),
        };
        this.challengeCleanupInterval = setInterval(() => this.cleanupExpiredFallbackChallenges(), 60000);
        const redisStatus = redis_1.cache.getStatus();
        logger_1.logger.info('WebAuthnService initialized', {
            rpName: this.config.rpName,
            rpId: this.config.rpId,
            origin: this.config.origin,
            redisConnected: redisStatus.connected,
            redisEnabled: redisStatus.enabled,
        });
    }
    async generateRegistrationOptions(userId, userName) {
        const existingCredentials = await this.credentialRepository.find({
            where: { userId, isActive: true },
        });
        const excludeCredentials = existingCredentials.map(cred => ({
            id: cred.credentialId,
            type: 'public-key',
            transports: (cred.transports || []),
        }));
        const options = await (0, server_1.generateRegistrationOptions)({
            rpName: this.config.rpName,
            rpID: this.config.rpId,
            userName,
            userDisplayName: userName,
            userID: new TextEncoder().encode(userId),
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: undefined,
            },
            excludeCredentials,
            timeout: this.config.timeout,
        });
        await this.storeChallenge(userId, options.challenge);
        logger_1.logger.info('WebAuthn registration options generated', {
            userId,
            excludedCredentials: excludeCredentials.length,
        });
        return options;
    }
    async verifyRegistration(userId, response, deviceName, metadata) {
        const storedChallenge = await this.getChallenge(userId);
        if (!storedChallenge) {
            throw new apiErrors_1.ValidationError('Registration challenge not found or expired');
        }
        let verification;
        try {
            verification = await (0, server_1.verifyRegistrationResponse)({
                response,
                expectedChallenge: storedChallenge,
                expectedOrigin: this.config.origin,
                expectedRPID: this.config.rpId,
            });
        }
        catch (error) {
            logger_1.logger.error('WebAuthn registration verification failed', {
                userId,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            throw new apiErrors_1.ValidationError(`Registration verification failed: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
        await this.clearChallenge(userId);
        if (!verification.verified || !verification.registrationInfo) {
            throw new apiErrors_1.ValidationError('Registration verification failed');
        }
        const { registrationInfo } = verification;
        const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
        const existingCredential = await this.credentialRepository.findOne({
            where: { credentialId: credential.id },
        });
        if (existingCredential) {
            throw new apiErrors_1.ValidationError('Credential already registered');
        }
        const webAuthnCredential = this.credentialRepository.create({
            id: crypto_1.default.randomUUID(),
            userId,
            credentialId: credential.id,
            credentialPublicKey: Buffer.from(credential.publicKey).toString('base64url'),
            counter: Number(credential.counter),
            aaguid: registrationInfo.aaguid,
            credentialType: registrationInfo.credentialType,
            deviceName: deviceName || this.guessDeviceName(metadata?.userAgent),
            transports: response.response.transports,
            backedUp: credentialBackedUp,
            backupEligible: credentialDeviceType === 'multiDevice',
            attestationFormat: registrationInfo.fmt,
            isActive: true,
            registrationIp: metadata?.ipAddress,
            registrationUserAgent: metadata?.userAgent,
        });
        await this.credentialRepository.save(webAuthnCredential);
        logger_1.logger.info('WebAuthn credential registered', {
            userId,
            credentialId: webAuthnCredential.id,
            deviceName: webAuthnCredential.deviceName,
            backedUp: credentialBackedUp,
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
            userId,
            resource: 'auth.webauthn',
            action: 'credential_registered',
            message: `WebAuthn passkey registered for user ${userId} (device: ${webAuthnCredential.deviceName})`,
            metadata: {
                credentialId: webAuthnCredential.id,
                deviceName: webAuthnCredential.deviceName,
                backedUp: credentialBackedUp,
            },
        });
        return {
            credentialId: webAuthnCredential.id,
            verified: true,
            deviceName: webAuthnCredential.deviceName,
        };
    }
    async generateAuthenticationOptions(userId) {
        let allowCredentials;
        if (userId) {
            const credentials = await this.credentialRepository.find({
                where: { userId, isActive: true },
            });
            if (credentials.length === 0) {
                throw new apiErrors_1.NotFoundError('No WebAuthn credentials registered for this user');
            }
            allowCredentials = credentials.map(cred => ({
                id: cred.credentialId,
                type: 'public-key',
                transports: (cred.transports || []),
            }));
        }
        const options = await (0, server_1.generateAuthenticationOptions)({
            rpID: this.config.rpId,
            allowCredentials,
            userVerification: 'preferred',
            timeout: this.config.timeout,
        });
        const challengeKey = userId || `temp-${crypto_1.default.randomUUID()}`;
        await this.storeChallenge(challengeKey, options.challenge);
        const response = {
            ...options,
        };
        if (!userId) {
            response._challengeKey = challengeKey;
        }
        logger_1.logger.info('WebAuthn authentication options generated', {
            userId,
            allowedCredentials: allowCredentials?.length || 'any',
        });
        return response;
    }
    async verifyAuthentication(response, challengeKey) {
        const storedChallenge = await this.getChallenge(challengeKey);
        if (!storedChallenge) {
            throw new apiErrors_1.ValidationError('Authentication challenge not found or expired');
        }
        const credentialId = response.id;
        const credential = await this.credentialRepository.findOne({
            where: { credentialId, isActive: true },
        });
        if (!credential) {
            throw new apiErrors_1.NotFoundError('Credential');
        }
        let verification;
        try {
            verification = await (0, server_1.verifyAuthenticationResponse)({
                response,
                expectedChallenge: storedChallenge,
                expectedOrigin: this.config.origin,
                expectedRPID: this.config.rpId,
                credential: {
                    id: credential.credentialId,
                    publicKey: Buffer.from(credential.credentialPublicKey, 'base64url'),
                    counter: credential.counter,
                    transports: (credential.transports || []),
                },
            });
        }
        catch (error) {
            logger_1.logger.error('WebAuthn authentication verification failed', {
                credentialId: credential.id,
                userId: credential.userId,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            throw new apiErrors_1.ValidationError(`Authentication verification failed: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
        await this.clearChallenge(challengeKey);
        if (!verification.verified) {
            throw new apiErrors_1.ValidationError('Authentication verification failed');
        }
        const { authenticationInfo } = verification;
        credential.counter = authenticationInfo.newCounter;
        credential.lastUsedAt = new Date();
        credential.useCount += 1;
        await this.credentialRepository.save(credential);
        logger_1.logger.info('WebAuthn authentication successful', {
            userId: credential.userId,
            credentialId: credential.id,
            newCounter: authenticationInfo.newCounter,
        });
        return {
            userId: credential.userId,
            credentialId: credential.id,
            verified: true,
            newCounter: authenticationInfo.newCounter,
        };
    }
    async getUserCredentials(userId) {
        const credentials = await this.credentialRepository.find({
            where: { userId, isActive: true },
            order: { lastUsedAt: 'DESC' },
        });
        return credentials.map(cred => ({
            id: cred.id,
            deviceName: cred.deviceName,
            createdAt: cred.createdAt,
            lastUsedAt: cred.lastUsedAt,
            useCount: cred.useCount,
            backedUp: cred.backedUp,
            transports: cred.transports,
        }));
    }
    async updateCredentialName(userId, credentialId, deviceName) {
        const credential = await this.credentialRepository.findOne({
            where: { id: credentialId, userId, isActive: true },
        });
        if (!credential) {
            throw new apiErrors_1.NotFoundError('Credential');
        }
        credential.deviceName = deviceName;
        await this.credentialRepository.save(credential);
        logger_1.logger.info('WebAuthn credential name updated', {
            userId,
            credentialId,
            deviceName,
        });
    }
    async removeCredential(userId, credentialId) {
        const credential = await this.credentialRepository.findOne({
            where: { id: credentialId, userId, isActive: true },
        });
        if (!credential) {
            throw new apiErrors_1.NotFoundError('Credential');
        }
        credential.isActive = false;
        await this.credentialRepository.save(credential);
        logger_1.logger.info('WebAuthn credential removed', {
            userId,
            credentialId,
        });
    }
    async removeAllCredentials(userId) {
        const result = await this.credentialRepository.update({ userId, isActive: true }, { isActive: false });
        const removedCount = result.affected || 0;
        logger_1.logger.info('All WebAuthn credentials removed', {
            userId,
            removedCount,
        });
        return removedCount;
    }
    async hasCredentials(userId) {
        const count = await this.credentialRepository.count({
            where: { userId, isActive: true },
        });
        return count > 0;
    }
    async storeChallenge(key, challenge) {
        const redisKey = `${WebAuthnService.CHALLENGE_KEY_PREFIX}${key}`;
        const ttlSeconds = this.config.challengeTTL;
        const stored = await redis_1.cache.set(redisKey, { challenge }, ttlSeconds);
        if (!stored) {
            const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
            this.fallbackChallenges.set(key, { challenge, expiresAt });
            const redisStatus = redis_1.cache.getStatus();
            logger_1.logger.debug('WebAuthn challenge stored in fallback memory', {
                key,
                reason: !redisStatus.enabled
                    ? 'Redis disabled'
                    : !redisStatus.connected
                        ? 'Redis not connected'
                        : 'Redis operation failed',
            });
        }
        else {
            logger_1.logger.debug('WebAuthn challenge stored in Redis', { key, ttlSeconds });
        }
    }
    async getChallenge(key) {
        const redisKey = `${WebAuthnService.CHALLENGE_KEY_PREFIX}${key}`;
        const redisStored = await redis_1.cache.get(redisKey);
        if (redisStored) {
            return redisStored.challenge;
        }
        const memoryStored = this.fallbackChallenges.get(key);
        if (!memoryStored) {
            return null;
        }
        if (new Date() > memoryStored.expiresAt) {
            this.fallbackChallenges.delete(key);
            return null;
        }
        return memoryStored.challenge;
    }
    async clearChallenge(key) {
        const redisKey = `${WebAuthnService.CHALLENGE_KEY_PREFIX}${key}`;
        await redis_1.cache.del(redisKey);
        this.fallbackChallenges.delete(key);
    }
    cleanupExpiredFallbackChallenges() {
        const now = new Date();
        let cleaned = 0;
        for (const [key, value] of this.fallbackChallenges.entries()) {
            if (now > value.expiresAt) {
                this.fallbackChallenges.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger_1.logger.debug('Cleaned up expired WebAuthn fallback challenges', { count: cleaned });
        }
    }
    guessDeviceName(userAgent) {
        if (!userAgent) {
            return 'Security Key';
        }
        const ua = userAgent.toLowerCase();
        if (ua.includes('mac') && (ua.includes('safari') || ua.includes('chrome'))) {
            return 'MacBook Touch ID';
        }
        if (ua.includes('iphone') || ua.includes('ipad')) {
            return 'iPhone/iPad Face ID';
        }
        if (ua.includes('windows')) {
            return 'Windows Hello';
        }
        if (ua.includes('android')) {
            return 'Android Device';
        }
        return 'Security Key';
    }
    getConfig() {
        return {
            rpName: this.config.rpName,
            rpId: this.config.rpId,
            origin: this.config.origin,
            timeout: this.config.timeout,
        };
    }
    destroy() {
        if (this.challengeCleanupInterval) {
            clearInterval(this.challengeCleanupInterval);
            this.challengeCleanupInterval = null;
        }
        this.fallbackChallenges.clear();
    }
}
exports.WebAuthnService = WebAuthnService;
//# sourceMappingURL=WebAuthnService.js.map