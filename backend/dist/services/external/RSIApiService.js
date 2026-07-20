"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiApiService = exports.RsiApiService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../utils/logger");
const rsiValidation_1 = require("../../utils/rsiValidation");
const RsiCrawlerService_1 = require("./RsiCrawlerService");
class RsiApiService {
    cache;
    staleCache;
    staleTtlMs;
    static OWNER_RANKS = ['founder', 'ceo', 'owner'];
    static ADMIN_RANKS = ['director', 'admin', 'board member', 'executive officer'];
    static MIN_ADMIN_STARS = 4;
    constructor() {
        this.cache = new node_cache_1.default({
            stdTTL: parseInt(process.env.RSI_CACHE_TTL ?? '600'),
            checkperiod: 120,
        });
        this.staleCache = new Map();
        this.staleTtlMs = parseInt(process.env.RSI_STALE_CACHE_TTL ?? '3600000');
        if (process.env.NODE_ENV !== 'test') {
            const staleCleanupInterval = setInterval(() => this.cleanStaleCache(), 10 * 60 * 1000);
            staleCleanupInterval.unref();
        }
        logger_1.logger.info('RSI API Service initialized (RSI Crawler backend)');
    }
    setStaleCache(key, data) {
        if (this.staleCache.size >= 500) {
            const oldestKey = this.staleCache.keys().next().value;
            if (oldestKey) {
                this.staleCache.delete(oldestKey);
            }
        }
        this.staleCache.set(key, { data, cachedAt: Date.now() });
    }
    getStaleCache(key) {
        const entry = this.staleCache.get(key);
        if (!entry) {
            return null;
        }
        const age = Date.now() - entry.cachedAt;
        if (age > this.staleTtlMs) {
            this.staleCache.delete(key);
            return null;
        }
        return { data: entry.data, cachedAt: entry.cachedAt };
    }
    cleanStaleCache() {
        const now = Date.now();
        for (const [key, entry] of this.staleCache.entries()) {
            if (now - entry.cachedAt > this.staleTtlMs) {
                this.staleCache.delete(key);
            }
        }
    }
    getCircuitStatus() {
        return RsiCrawlerService_1.rsiCrawlerService.getCircuitStatus();
    }
    isDegraded() {
        return this.getCircuitStatus().state !== 'closed';
    }
    getStaleCacheStats() {
        let oldest = null;
        for (const entry of this.staleCache.values()) {
            const age = Date.now() - entry.cachedAt;
            if (oldest === null || age > oldest) {
                oldest = age;
            }
        }
        return { entries: this.staleCache.size, oldestAgeMs: oldest };
    }
    async fetchOrganizationData(identifier) {
        (0, rsiValidation_1.validateRsiIdentifier)(identifier, 'organization SID');
        const cacheKey = `org:${identifier}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for organization data: ${identifier}`);
            return cached;
        }
        try {
            logger_1.logger.debug(`Fetching organization data via RSI Crawler: ${identifier}`);
            const orgData = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganization(identifier);
            const mapped = {
                sid: orgData.sid,
                name: orgData.name,
                description: orgData.description,
                memberCount: orgData.memberCount,
            };
            this.cache.set(cacheKey, mapped);
            this.setStaleCache(cacheKey, mapped);
            return mapped;
        }
        catch (error) {
            const stale = this.getStaleCache(cacheKey);
            if (stale) {
                const ageMinutes = Math.round((Date.now() - stale.cachedAt) / 60000);
                logger_1.logger.warn(`Serving stale organization data for ${identifier} (${ageMinutes}m old) due to crawler unavailability`);
                return stale.data;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Error fetching organization data: ${errorMessage}`);
        }
    }
    async fetchUserData(handle) {
        (0, rsiValidation_1.validateRsiIdentifier)(handle, 'citizen handle');
        const cacheKey = `user:${handle}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for user data: ${handle}`);
            return cached;
        }
        try {
            logger_1.logger.debug(`Fetching citizen data via RSI Crawler: ${handle}`);
            const citizenData = await RsiCrawlerService_1.rsiCrawlerService.crawlCitizen(handle);
            if (!citizenData) {
                const notFound = {};
                return notFound;
            }
            let organizations;
            try {
                const memberships = await RsiCrawlerService_1.rsiCrawlerService.crawlUserMemberships(handle);
                organizations = memberships.map(m => ({
                    sid: m.sid,
                    name: m.name,
                    rank: m.rank,
                    stars: m.stars,
                    isMain: m.isMain,
                    isAffiliate: !m.isMain,
                }));
            }
            catch (orgError) {
                logger_1.logger.warn(`Failed to crawl org memberships for ${handle}, continuing without`, {
                    error: orgError instanceof Error ? orgError.message : String(orgError),
                });
            }
            const mapped = {
                handle: citizenData.handle,
                displayName: citizenData.displayName,
                moniker: citizenData.displayName,
                bio: citizenData.bio,
                image: citizenData.avatarUrl,
                enlisted: citizenData.enlisted,
                fluency: citizenData.fluency ? [citizenData.fluency] : undefined,
                location: citizenData.location,
                website: citizenData.website,
                title: citizenData.title,
                citizenRecord: citizenData.citizenRecord,
                organizations,
            };
            this.cache.set(cacheKey, mapped);
            this.setStaleCache(cacheKey, mapped);
            return mapped;
        }
        catch (error) {
            const stale = this.getStaleCache(cacheKey);
            if (stale) {
                const ageMinutes = Math.round((Date.now() - stale.cachedAt) / 60000);
                logger_1.logger.warn(`Serving stale user data for ${handle} (${ageMinutes}m old) due to crawler unavailability`);
                return stale.data;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Error fetching user data: ${errorMessage}`);
        }
    }
    clearCache() {
        this.cache.flushAll();
        this.staleCache.clear();
        logger_1.logger.info('RSI API cache cleared (primary + stale)');
    }
    getCacheStats() {
        return this.cache.getStats();
    }
    async verifyHandle(handle) {
        this.cache.del(`user:${handle}`);
        RsiCrawlerService_1.rsiCrawlerService.invalidateCitizenCache(handle);
        const userData = await this.fetchUserData(handle);
        if (!userData?.handle) {
            return {
                verified: false,
                error: 'RSI handle not found',
            };
        }
        logger_1.logger.info(`RSI handle verified: ${handle}`);
        return {
            verified: true,
            handle: userData.handle,
            displayName: userData.displayName || userData.moniker,
            bio: userData.bio,
            organizations: userData.organizations,
        };
    }
    async verifyBioCode(handle, verificationCode) {
        try {
            this.cache.del(`user:${handle}`);
            RsiCrawlerService_1.rsiCrawlerService.invalidateCitizenCache(handle);
            const userData = await this.fetchUserData(handle);
            if (!userData?.bio) {
                logger_1.logger.debug(`No bio found for RSI handle: ${handle}`);
                return false;
            }
            const codeFound = userData.bio.includes(verificationCode);
            if (codeFound) {
                logger_1.logger.info(`Verification code found in bio for RSI handle: ${handle}`);
            }
            else {
                logger_1.logger.debug(`Verification code not found in bio for RSI handle: ${handle}`);
            }
            return codeFound;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.warn(`Bio verification failed for ${handle}: ${errorMessage}`);
            return false;
        }
    }
    async verifyOrgDescriptionCode(orgSid, verificationCode) {
        try {
            this.cache.del(`org:${orgSid}`);
            RsiCrawlerService_1.rsiCrawlerService.invalidateOrgCache(orgSid);
            const orgData = await this.fetchOrganizationData(orgSid);
            if (!orgData?.description) {
                logger_1.logger.debug(`No description found for RSI organization: ${orgSid}`);
                return false;
            }
            const codeFound = orgData.description.includes(verificationCode);
            if (codeFound) {
                logger_1.logger.info(`Verification code found in description for RSI organization: ${orgSid}`);
            }
            else {
                logger_1.logger.debug(`Verification code not found in description for RSI organization: ${orgSid}`);
            }
            return codeFound;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.warn(`Organization description verification failed for ${orgSid}: ${errorMessage}`);
            return false;
        }
    }
    async verifyOrganizationMembership(handle, orgSid) {
        try {
            this.cache.del(`user:${handle}`);
            RsiCrawlerService_1.rsiCrawlerService.invalidateCitizenCache(handle);
            const userData = await this.fetchUserData(handle);
            if (!userData?.organizations) {
                const isAccountGone = userData && !userData.handle && !userData.organizations;
                return {
                    verified: false,
                    isOwner: false,
                    isAdmin: false,
                    membershipStatus: isAccountGone ? 'account_not_found' : 'unknown',
                    error: isAccountGone ? 'RSI account not found' : 'User data or organizations not found',
                };
            }
            const normalizedOrgSid = orgSid.toUpperCase();
            const orgMembership = userData.organizations.find(org => org.sid?.toUpperCase() === normalizedOrgSid);
            if (!orgMembership) {
                return {
                    verified: true,
                    isOwner: false,
                    isAdmin: false,
                    membershipStatus: 'not_member',
                    error: 'User is not a member of this organization',
                };
            }
            const rank = orgMembership.rank?.toLowerCase() ?? '';
            const stars = orgMembership.stars ?? 0;
            const isOwner = RsiApiService.OWNER_RANKS.some(ownerRank => rank.includes(ownerRank));
            const isAdmin = isOwner ||
                RsiApiService.ADMIN_RANKS.some(adminRank => rank.includes(adminRank)) ||
                stars >= RsiApiService.MIN_ADMIN_STARS;
            logger_1.logger.info(`Organization membership verified: ${handle} in ${orgSid} - rank: ${rank}, stars: ${stars}`);
            return {
                verified: true,
                isOwner,
                isAdmin,
                membershipStatus: 'member',
                sid: orgMembership.sid,
                name: orgMembership.name,
                rank: orgMembership.rank,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.warn(`Organization membership verification failed for ${handle}/${orgSid}: ${errorMessage}`);
            return {
                verified: false,
                isOwner: false,
                isAdmin: false,
                membershipStatus: 'unknown',
                error: errorMessage,
            };
        }
    }
}
exports.RsiApiService = RsiApiService;
exports.rsiApiService = new RsiApiService();
//# sourceMappingURL=RSIApiService.js.map