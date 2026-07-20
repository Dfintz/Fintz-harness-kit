"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCASConfig = loadCASConfig;
exports.scoreToCasTier = scoreToCasTier;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
async function loadCASConfig(organizationId) {
    const org = await data_source_1.AppDataSource.getRepository(Organization_1.Organization).findOne({
        where: { id: organizationId },
        select: ['settings'],
    });
    const overrides = org?.settings?.casConfig;
    if (!overrides) {
        return { ...shared_types_1.DEFAULT_CAS_CONFIG };
    }
    return {
        onlinePresenceTarget: overrides.onlinePresenceTarget ?? shared_types_1.DEFAULT_CAS_CONFIG.onlinePresenceTarget,
        engagementTarget: overrides.engagementTarget ?? shared_types_1.DEFAULT_CAS_CONFIG.engagementTarget,
        consistencyTarget: overrides.consistencyTarget ?? shared_types_1.DEFAULT_CAS_CONFIG.consistencyTarget,
        voiceTarget: overrides.voiceTarget ?? shared_types_1.DEFAULT_CAS_CONFIG.voiceTarget,
        siteActivityTarget: overrides.siteActivityTarget ?? shared_types_1.DEFAULT_CAS_CONFIG.siteActivityTarget,
        weights: {
            onlinePresence: overrides.weights?.onlinePresence ?? shared_types_1.DEFAULT_CAS_CONFIG.weights.onlinePresence,
            engagement: overrides.weights?.engagement ?? shared_types_1.DEFAULT_CAS_CONFIG.weights.engagement,
            consistency: overrides.weights?.consistency ?? shared_types_1.DEFAULT_CAS_CONFIG.weights.consistency,
            voice: overrides.weights?.voice ?? shared_types_1.DEFAULT_CAS_CONFIG.weights.voice,
            site: overrides.weights?.site ?? shared_types_1.DEFAULT_CAS_CONFIG.weights.site,
        },
        heatmapLogScale: overrides.heatmapLogScale ?? shared_types_1.DEFAULT_CAS_CONFIG.heatmapLogScale,
    };
}
function scoreToCasTier(score) {
    if (score >= 85) {
        return 'VERY_ACTIVE';
    }
    if (score >= 65) {
        return 'ACTIVE';
    }
    if (score >= 45) {
        return 'MODERATE';
    }
    if (score >= 20) {
        return 'QUIET';
    }
    return 'DORMANT';
}
//# sourceMappingURL=CASConfig.js.map