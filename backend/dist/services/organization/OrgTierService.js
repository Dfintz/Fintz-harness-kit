"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgTierService = exports.OrgTierService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const STANDARD_DASHBOARD_TTL_SECONDS = 300;
const MEGA_DASHBOARD_TTL_SECONDS = 600;
const ULTRA_DASHBOARD_TTL_SECONDS = 900;
class OrgTierService {
    static instance;
    static getInstance() {
        if (!OrgTierService.instance) {
            OrgTierService.instance = new OrgTierService();
        }
        return OrgTierService.instance;
    }
    getScaleTier(memberCount) {
        if (memberCount >= 10_000) {
            return shared_types_1.OrgScaleTier.ULTRA;
        }
        if (memberCount >= 2_000) {
            return shared_types_1.OrgScaleTier.MEGA;
        }
        if (memberCount >= 500) {
            return shared_types_1.OrgScaleTier.LARGE;
        }
        return shared_types_1.OrgScaleTier.STANDARD;
    }
    getScalingProfile(memberCount) {
        const normalizedMemberCount = Math.max(0, memberCount);
        const tier = this.getScaleTier(normalizedMemberCount);
        switch (tier) {
            case shared_types_1.OrgScaleTier.ULTRA:
                return {
                    tier,
                    memberCount: normalizedMemberCount,
                    dashboardCacheTtlSeconds: ULTRA_DASHBOARD_TTL_SECONDS,
                    recommendedPageSize: 50,
                };
            case shared_types_1.OrgScaleTier.MEGA:
                return {
                    tier,
                    memberCount: normalizedMemberCount,
                    dashboardCacheTtlSeconds: MEGA_DASHBOARD_TTL_SECONDS,
                    recommendedPageSize: 100,
                };
            case shared_types_1.OrgScaleTier.LARGE:
                return {
                    tier,
                    memberCount: normalizedMemberCount,
                    dashboardCacheTtlSeconds: STANDARD_DASHBOARD_TTL_SECONDS,
                    recommendedPageSize: 100,
                };
            case shared_types_1.OrgScaleTier.STANDARD:
            default:
                return {
                    tier,
                    memberCount: normalizedMemberCount,
                    dashboardCacheTtlSeconds: STANDARD_DASHBOARD_TTL_SECONDS,
                    recommendedPageSize: 200,
                };
        }
    }
}
exports.OrgTierService = OrgTierService;
exports.orgTierService = OrgTierService.getInstance();
//# sourceMappingURL=OrgTierService.js.map