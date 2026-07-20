"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MumbleIceBridgeService = void 0;
const logger_1 = require("../../../utils/logger");
const ssrfProtection_1 = require("../../../utils/ssrfProtection");
class MumbleIceBridgeService {
    static instance;
    constructor() {
        logger_1.logger.info('MumbleIceBridgeService initialized');
    }
    static getInstance() {
        if (!MumbleIceBridgeService.instance) {
            MumbleIceBridgeService.instance = new MumbleIceBridgeService();
        }
        return MumbleIceBridgeService.instance;
    }
    async createChannel(config, name, parentId) {
        return this.callCvpBridge(config, 'POST', '/channels', {
            name,
            parentId: parentId ?? 0,
        });
    }
    async deleteChannel(config, channelId) {
        const result = await this.callCvpBridge(config, 'DELETE', `/channels/${channelId}`);
        return result?.success ?? false;
    }
    async setChannelACL(config, channelId, groups) {
        const result = await this.callCvpBridge(config, 'PUT', `/channels/${channelId}/acl`, { groups });
        return result?.success ?? false;
    }
    async muteUser(config, username, mute) {
        const result = await this.callCvpBridge(config, 'POST', '/users/mute', {
            username,
            mute,
        });
        return result?.success ?? false;
    }
    async kickUser(config, username, reason) {
        const result = await this.callCvpBridge(config, 'POST', '/users/kick', {
            username,
            reason: reason ?? 'Kicked by platform moderation',
        });
        return result?.success ?? false;
    }
    async banUser(config, username, reason, durationSeconds) {
        const result = await this.callCvpBridge(config, 'POST', '/users/ban', {
            username,
            reason: reason ?? 'Banned by platform moderation',
            durationSeconds,
        });
        return result?.success ?? false;
    }
    async callCvpBridge(config, method, path, body) {
        if (!config.iceHost) {
            logger_1.logger.debug('No ICE host configured, skipping CVP bridge call');
            return null;
        }
        if (await (0, ssrfProtection_1.isPrivateHostResolved)(config.iceHost)) {
            logger_1.logger.warn('Blocked CVP bridge call to private/internal host', { host: config.iceHost });
            return null;
        }
        const cvpPort = config.icePort ?? 8443;
        const url = `https://${config.iceHost}:${cvpPort}${path}`;
        try {
            const response = await fetch(url, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
                logger_1.logger.warn('CVP bridge call failed', {
                    method,
                    path,
                    status: response.status,
                });
                return null;
            }
            return (await response.json());
        }
        catch (error) {
            logger_1.logger.warn('CVP bridge unreachable', {
                method,
                path,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
}
exports.MumbleIceBridgeService = MumbleIceBridgeService;
//# sourceMappingURL=MumbleIceBridgeService.js.map