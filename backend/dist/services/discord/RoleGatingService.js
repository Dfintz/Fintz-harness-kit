"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleGatingService = exports.DEFAULT_ROLE_GATING = void 0;
const logger_1 = require("../../utils/logger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
exports.DEFAULT_ROLE_GATING = {
    enabled: false,
    rules: [],
};
class RoleGatingService {
    static instance;
    settingsService = new DiscordSettingsService_1.DiscordSettingsService();
    static getInstance() {
        if (!RoleGatingService.instance) {
            RoleGatingService.instance = new RoleGatingService();
        }
        return RoleGatingService.instance;
    }
    async checkGate(guildId, member, action) {
        try {
            const settings = await this.settingsService.getSettingsByGuildId(guildId);
            const gating = settings?.[0]?.roleGatingSettings;
            if (!gating?.enabled || !gating.rules || gating.rules.length === 0) {
                return { allowed: true };
            }
            const rule = gating.rules.find(r => r.action === action);
            if (!rule) {
                return { allowed: true };
            }
            if (rule.restrictedRoleIds.length > 0) {
                const hasRestricted = rule.restrictedRoleIds.some(id => member.roles.cache.has(id));
                if (hasRestricted) {
                    return {
                        allowed: false,
                        reason: rule.denyMessage || 'You have a role that restricts this action.',
                    };
                }
            }
            if (rule.requiredRoleIds.length > 0) {
                const hasRequired = rule.requiredRoleIds.some(id => member.roles.cache.has(id));
                if (!hasRequired) {
                    return {
                        allowed: false,
                        reason: rule.denyMessage ||
                            `You need one of the required roles: ${rule.requiredRoleIds.map(id => `<@&${id}>`).join(', ')}`,
                    };
                }
            }
            return { allowed: true };
        }
        catch (error) {
            logger_1.logger.warn('Role gate check failed, allowing by default:', error);
            return { allowed: true };
        }
    }
}
exports.RoleGatingService = RoleGatingService;
//# sourceMappingURL=RoleGatingService.js.map