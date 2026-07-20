"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiBotUserLookupService = exports.RsiBotUserLookupService = void 0;
const data_source_1 = require("../../data-source");
const User_1 = require("../../models/User");
class RsiBotUserLookupService {
    userRepository;
    constructor() {
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    }
    isAvailable() {
        return data_source_1.AppDataSource.isInitialized;
    }
    async getPlatformUserIdByDiscordId(discordUserId) {
        if (!this.isAvailable()) {
            return null;
        }
        const linkedUser = await this.userRepository
            .createQueryBuilder('user')
            .select('user.id', 'id')
            .where('user.discordId = :discordId', { discordId: discordUserId })
            .getRawOne();
        return linkedUser?.id ?? null;
    }
}
exports.RsiBotUserLookupService = RsiBotUserLookupService;
exports.rsiBotUserLookupService = new RsiBotUserLookupService();
//# sourceMappingURL=RsiBotUserLookupService.js.map