"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FocusService = void 0;
const database_1 = require("../../config/database");
const OrgFocusPreference_1 = require("../../models/OrgFocusPreference");
const UserFocusPreference_1 = require("../../models/UserFocusPreference");
const apiErrors_1 = require("../../utils/apiErrors");
const FOCUS_LIMITS = {
    user: { primary: 3, secondary: 3 },
    org: 2,
};
const focusList = [
    'Bounty Hunting',
    'Engineering',
    'Exploration',
    'Medical',
    'Piracy',
    'Infiltration',
    'Resources',
    'Scouting',
    'Security',
    'Smuggling',
    'Trading',
    'Transport',
];
class FocusService {
    get userRepo() {
        return database_1.AppDataSource.getRepository(UserFocusPreference_1.UserFocusPreference);
    }
    get orgRepo() {
        return database_1.AppDataSource.getRepository(OrgFocusPreference_1.OrgFocusPreference);
    }
    getFocusList() {
        return focusList;
    }
    async setUserFocus(userId, primary, secondary) {
        if (primary.length > FOCUS_LIMITS.user.primary ||
            secondary.length > FOCUS_LIMITS.user.secondary) {
            throw new apiErrors_1.ValidationError(`Users can set up to ${FOCUS_LIMITS.user.primary} primary and ${FOCUS_LIMITS.user.secondary} secondary focuses.`);
        }
        let record = await this.userRepo.findOneBy({ userId });
        if (record) {
            record.primaryFocuses = primary;
            record.secondaryFocuses = secondary;
        }
        else {
            record = this.userRepo.create({
                userId,
                primaryFocuses: primary,
                secondaryFocuses: secondary,
            });
        }
        await this.userRepo.save(record);
    }
    async setOrgFocus(orgId, focuses) {
        if (focuses.length > FOCUS_LIMITS.org) {
            throw new apiErrors_1.ValidationError(`Organizations can set up to ${FOCUS_LIMITS.org} focuses.`);
        }
        let record = await this.orgRepo.findOneBy({ orgId });
        if (record) {
            record.focuses = focuses;
        }
        else {
            record = this.orgRepo.create({ orgId, focuses });
        }
        await this.orgRepo.save(record);
    }
    async getUserFocus(userId) {
        const record = await this.userRepo.findOneBy({ userId });
        if (!record) {
            return undefined;
        }
        return {
            userId: record.userId,
            primaryFocuses: record.primaryFocuses,
            secondaryFocuses: record.secondaryFocuses,
        };
    }
    async getOrgFocus(orgId) {
        const record = await this.orgRepo.findOneBy({ orgId });
        if (!record) {
            return undefined;
        }
        return {
            orgId: record.orgId,
            focuses: record.focuses,
        };
    }
}
exports.FocusService = FocusService;
//# sourceMappingURL=FocusService.js.map