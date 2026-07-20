"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthLinkingService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
class OAuthLinkingService {
    userService;
    authService;
    constructor(userService, authService) {
        this.userService = userService;
        this.authService = authService;
    }
    async resolveExistingSessionUser(linkUserId, accessToken) {
        if (linkUserId) {
            const user = await this.userService.getUserById(linkUserId);
            if (user) {
                logger_1.logger.debug('Resolved linking user from OAuth state', { linkUserId });
                return user;
            }
        }
        if (accessToken) {
            try {
                const decoded = await this.authService.validateAccessToken(accessToken);
                if (decoded?.id) {
                    return await this.userService.getUserById(decoded.id);
                }
            }
            catch {
            }
        }
        return null;
    }
    async resolveOrCreateOAuthUser(opts) {
        const existingSessionUser = await this.resolveExistingSessionUser(opts.linkUserId, opts.accessToken);
        if (existingSessionUser) {
            const existingByProvider = await opts.lookupByProviderId();
            if (existingByProvider && existingByProvider.id !== existingSessionUser.id) {
                logger_1.logger.warn(`${opts.providerName} account already linked to another user`, {
                    providerId: opts.providerId,
                    targetUser: existingSessionUser.id,
                });
                return {
                    tag: 'duplicate_provider',
                    providerId: opts.providerId,
                    targetUserId: existingSessionUser.id,
                };
            }
            await this.userService.updateUser(existingSessionUser.id, {
                [opts.providerIdField]: opts.providerId,
                lastLoginAt: new Date(),
                lastLoginIp: opts.ipAddress,
            });
            logger_1.logger.info(`Linked ${opts.providerName} account to authenticated user: ${existingSessionUser.id}`);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.AUTH_SUCCESS,
                userId: existingSessionUser.id,
                resource: 'auth.oauth',
                action: 'link_provider',
                message: `${opts.providerName} account linked to user ${existingSessionUser.id}`,
                metadata: { provider: opts.providerName, providerId: opts.providerId },
            });
            return { tag: 'linked', user: existingSessionUser };
        }
        const existingByEmail = opts.email ? await this.userService.getUserByEmail(opts.email) : null;
        if (existingByEmail) {
            await this.userService.updateUser(existingByEmail.id, {
                [opts.providerIdField]: opts.providerId,
                lastLoginAt: new Date(),
                lastLoginIp: opts.ipAddress,
            });
            logger_1.logger.info(`Linked ${opts.providerName} account to existing user by email: ${existingByEmail.id}`);
            return { tag: 'linked', user: existingByEmail };
        }
        const user = await this.userService.createUser({
            id: node_crypto_1.default.randomUUID(),
            discordId: `${opts.providerName.toLowerCase()}:${opts.providerId}`,
            [opts.providerIdField]: opts.providerId,
            username: opts.username,
            email: opts.email ?? `${opts.providerId}@noemail.${opts.providerName.toLowerCase()}.local`,
            displayName: opts.displayName,
            avatar: opts.avatar,
            role: 'user',
            lastLoginAt: new Date(),
        });
        logger_1.logger.info(`New user created via ${opts.providerName} OAuth: ${user.id}`);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.AUTH_SUCCESS,
            userId: user.id,
            resource: 'auth.oauth',
            action: 'create_user',
            message: `New user ${user.id} created via ${opts.providerName} OAuth`,
            metadata: { provider: opts.providerName, providerId: opts.providerId },
        });
        return { tag: 'created', user };
    }
}
exports.OAuthLinkingService = OAuthLinkingService;
//# sourceMappingURL=OAuthLinkingService.js.map