"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASActivityLevelBridge = void 0;
exports.mapCasTierToActivityLevel = mapCasTierToActivityLevel;
exports.getCASActivityLevelBridge = getCASActivityLevelBridge;
const data_source_1 = require("../../data-source");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const logger_1 = require("../../utils/logger");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const CAS_TIER_TO_ACTIVITY_LEVEL = {
    VERY_ACTIVE: PublicOrgProfile_1.ActivityLevel.VERY_HIGH,
    ACTIVE: PublicOrgProfile_1.ActivityLevel.HIGH,
    MODERATE: PublicOrgProfile_1.ActivityLevel.MODERATE,
    QUIET: PublicOrgProfile_1.ActivityLevel.LOW,
    DORMANT: PublicOrgProfile_1.ActivityLevel.INACTIVE,
};
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isCasTier(value) {
    return value in CAS_TIER_TO_ACTIVITY_LEVEL;
}
function isUuid(value) {
    return UUID_REGEX.test(value);
}
function mapCasTierToActivityLevel(tier) {
    return CAS_TIER_TO_ACTIVITY_LEVEL[tier];
}
class CASActivityLevelBridge {
    profileRepository;
    subscribed = false;
    casUpdatedListener = (payload) => this.onCasUpdated(payload);
    constructor(profileRepository) {
        this.profileRepository = profileRepository ?? data_source_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile);
    }
    subscribeToEvents() {
        if (this.subscribed) {
            return;
        }
        DomainEventBus_1.domainEvents.on('analytics:cas_updated', this.casUpdatedListener);
        this.subscribed = true;
        logger_1.logger.info('CASActivityLevelBridge: subscribed to analytics:cas_updated');
    }
    unsubscribeFromEvents() {
        if (!this.subscribed) {
            return;
        }
        DomainEventBus_1.domainEvents.off('analytics:cas_updated', this.casUpdatedListener);
        this.subscribed = false;
    }
    async onCasUpdated(payload) {
        const { organizationId, tier, previousTier, score, previousScore } = payload;
        if (!isUuid(organizationId)) {
            logger_1.logger.warn('CASActivityLevelBridge: received non-UUID organizationId', { organizationId });
            return;
        }
        if (!isCasTier(tier) || !isCasTier(previousTier)) {
            logger_1.logger.warn('CASActivityLevelBridge: received unknown CAS tier value', {
                organizationId,
                tier,
                previousTier,
            });
            return;
        }
        const isInitialSyncEvent = tier === previousTier && score === previousScore;
        const tierChanged = tier !== previousTier;
        if (!tierChanged && !isInitialSyncEvent) {
            return;
        }
        const mappedActivityLevel = mapCasTierToActivityLevel(tier);
        const existingProfile = await this.profileRepository
            .createQueryBuilder('publicOrgProfile')
            .select([
            'publicOrgProfile.id',
            'publicOrgProfile.organizationId',
            'publicOrgProfile.activityLevel',
        ])
            .where('publicOrgProfile.organizationId = :organizationId', { organizationId })
            .getOne();
        if (!existingProfile) {
            return;
        }
        if (existingProfile.activityLevel === mappedActivityLevel) {
            return;
        }
        await this.profileRepository
            .createQueryBuilder()
            .update(PublicOrgProfile_1.PublicOrgProfile)
            .set({ activityLevel: mappedActivityLevel })
            .where('organizationId = :organizationId', { organizationId })
            .execute();
        logger_1.logger.info('CASActivityLevelBridge: synced PublicOrgProfile.activityLevel from CAS', {
            organizationId,
            previousActivityLevel: existingProfile.activityLevel,
            nextActivityLevel: mappedActivityLevel,
            tier,
            previousTier,
            score,
            previousScore,
        });
    }
}
exports.CASActivityLevelBridge = CASActivityLevelBridge;
let _casActivityLevelBridge = null;
function getCASActivityLevelBridge() {
    if (!_casActivityLevelBridge) {
        _casActivityLevelBridge = new CASActivityLevelBridge();
        _casActivityLevelBridge.subscribeToEvents();
    }
    return _casActivityLevelBridge;
}
//# sourceMappingURL=CASActivityLevelBridge.js.map