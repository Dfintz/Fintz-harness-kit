"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiCrawlerService = exports.RsiCrawlerService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../utils/logger");
const rsiValidation_1 = require("../../utils/rsiValidation");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half_open";
})(CircuitState || (CircuitState = {}));
class RateLimiter {
    tokens;
    lastRefill;
    maxTokens;
    refillRate;
    constructor(maxTokens = 5, refillRate = 1) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }
    tryConsume() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens--;
            return true;
        }
        return false;
    }
    getWaitTime() {
        if (this.tokens >= 1) {
            return 0;
        }
        return Math.max(0, Math.ceil(((1 - this.tokens) / this.refillRate) * 1000));
    }
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.refillRate;
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
}
class RsiCrawlerService {
    baseUrl;
    timeout;
    cache;
    axiosInstance;
    rateLimiter;
    circuitState = CircuitState.CLOSED;
    failures = 0;
    lastFailureTime = 0;
    failureThreshold = 5;
    openDuration = 60000;
    constructor() {
        this.baseUrl = 'https://robertsspaceindustries.com';
        this.timeout = parseInt(process.env.RSI_CRAWLER_TIMEOUT ?? '30000');
        this.cache = new node_cache_1.default({
            stdTTL: parseInt(process.env.RSI_CRAWLER_CACHE_TTL ?? '3600'),
            checkperiod: 120,
        });
        const defaultUserAgent = process.env.RSI_CRAWLER_USER_AGENT ??
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        this.axiosInstance = axios_1.default.create({
            timeout: this.timeout,
            headers: {
                'User-Agent': defaultUserAgent,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                Connection: 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
        });
        const maxRequests = parseInt(process.env.RSI_CRAWLER_RATE_LIMIT ?? '5');
        const refillRate = parseFloat(process.env.RSI_CRAWLER_RATE_REFILL ?? '1');
        this.rateLimiter = new RateLimiter(maxRequests, refillRate);
        logger_1.logger.info('RSI Crawler Service initialized with rate limiting and circuit breaker');
    }
    checkCircuitBreaker() {
        const now = Date.now();
        if (this.circuitState === CircuitState.OPEN) {
            if (now - this.lastFailureTime >= this.openDuration) {
                logger_1.logger.info('RSI Crawler circuit breaker transitioning to half-open');
                this.circuitState = CircuitState.HALF_OPEN;
            }
            else {
                const waitTime = this.openDuration - (now - this.lastFailureTime);
                throw new Error(`RSI Crawler circuit breaker is OPEN. Try again in ${Math.ceil(waitTime / 1000)} seconds`);
            }
        }
    }
    recordSuccess() {
        if (this.circuitState === CircuitState.HALF_OPEN) {
            logger_1.logger.info('RSI Crawler circuit breaker closing after successful recovery');
            this.circuitState = CircuitState.CLOSED;
            this.failures = 0;
        }
        else if (this.circuitState === CircuitState.CLOSED) {
            this.failures = 0;
        }
    }
    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.circuitState === CircuitState.HALF_OPEN) {
            logger_1.logger.warn('RSI Crawler circuit breaker reopening after half-open failure');
            this.circuitState = CircuitState.OPEN;
        }
        else if (this.failures >= this.failureThreshold) {
            logger_1.logger.warn(`RSI Crawler circuit breaker opening after ${this.failures} failures`);
            this.circuitState = CircuitState.OPEN;
        }
    }
    async checkRateLimit() {
        if (!this.rateLimiter.tryConsume()) {
            const waitTime = this.rateLimiter.getWaitTime();
            logger_1.logger.debug(`RSI Crawler rate limit hit, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            if (!this.rateLimiter.tryConsume()) {
                throw new Error('RSI Crawler rate limit exceeded');
            }
        }
    }
    async crawlOrganization(sid) {
        (0, rsiValidation_1.validateRsiIdentifier)(sid, 'organization SID');
        const cacheKey = `org:${sid}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for organization: ${sid}`);
            return cached;
        }
        try {
            this.checkCircuitBreaker();
            await this.checkRateLimit();
            const url = `${this.baseUrl}/orgs/${sid}`;
            logger_1.logger.debug(`Crawling organization from RSI: ${url}`);
            const response = await this.axiosInstance.get(url);
            const $ = cheerio.load(response.data);
            const rawName = this.extractText($, '.heading h1');
            const orgName = rawName
                ? rawName.replace(/\s*\/\s*\S+\s*$/, '').trim() || sid.toUpperCase()
                : sid.toUpperCase();
            const parsedMemberCount = this.extractNumber($, '.count .value', 0) ?? this.extractCountFromPageText($, 'members');
            const parsedAffiliateCount = this.extractNumber($, '.count .value', 1) ?? this.extractCountFromPageText($, 'affiliates');
            const orgData = {
                sid: sid.toUpperCase(),
                name: orgName,
                memberCount: parsedMemberCount ?? 0,
                affiliateCount: parsedAffiliateCount ?? 0,
                description: this.extractText($, '.info .entry'),
                history: this.extractOrgTabContent($, 'history'),
                manifesto: this.extractOrgTabContent($, 'manifesto'),
                charter: this.extractOrgTabContent($, 'charter'),
                banner: this.extractImageUrl($, '.banner img'),
                logo: this.extractImageUrl($, '.logo img'),
                focus: {
                    primary: this.extractText($, '.focus .primary'),
                    secondary: this.extractText($, '.focus .secondary'),
                },
                recruiting: this.extractText($, '.recruiting'),
                language: this.extractText($, '.language'),
                exclusive: this.extractText($, '.exclusive'),
            };
            const links = {};
            $('.links a').each((_, elem) => {
                const href = $(elem).attr('href');
                const text = $(elem).text().toLowerCase();
                if (href) {
                    if (text.includes('website') || text.includes('web')) {
                        links.website = href;
                    }
                    else if (text.includes('discord')) {
                        links.discord = href;
                    }
                    else if (text.includes('youtube')) {
                        links.youtube = href;
                    }
                    else if (text.includes('twitch')) {
                        links.twitch = href;
                    }
                }
            });
            if (Object.keys(links).length > 0) {
                orgData.links = links;
            }
            this.recordSuccess();
            this.cache.set(cacheKey, orgData);
            logger_1.logger.info(`Successfully crawled organization: ${sid}`);
            return orgData;
        }
        catch (error) {
            if (error instanceof Error &&
                !error.message.includes('circuit breaker') &&
                !error.message.includes('rate limit')) {
                this.recordFailure();
            }
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                const logPayload = {
                    status,
                    message: error.message,
                };
                if (this.isControlPathErrorMessage(error.message, status)) {
                    logger_1.logger.warn(`Failed to crawl organization ${sid} (degraded control path):`, logPayload);
                }
                else {
                    logger_1.logger.error(`Failed to crawl organization ${sid}:`, logPayload);
                }
                throw new Error(`Failed to crawl organization: ${status ?? error.message}`);
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (this.isControlPathErrorMessage(errorMessage)) {
                logger_1.logger.warn(`Failed to crawl organization ${sid}: ${errorMessage}`);
            }
            else {
                logger_1.logger.error(`Failed to crawl organization ${sid}: ${errorMessage}`);
            }
            throw new Error(`Failed to crawl organization: ${errorMessage}`);
        }
    }
    async crawlOrganizationMembers(sid, page = 1) {
        (0, rsiValidation_1.validateRsiIdentifier)(sid, 'organization SID');
        const cacheKey = `members:${sid}:${page}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for organization members: ${sid} page ${page}`);
            return cached;
        }
        try {
            this.checkCircuitBreaker();
            await this.checkRateLimit();
            const url = `${this.baseUrl}/orgs/${sid}/members`;
            logger_1.logger.debug(`Crawling organization members from RSI: ${url}?page=${page}`);
            const response = await this.axiosInstance.get(url, {
                params: { page },
            });
            const $ = cheerio.load(response.data);
            const members = [];
            $('.member-item').each((_, elem) => {
                const $elem = $(elem);
                let handle = this.extractText($elem, '.nick') ?? '';
                if (!handle) {
                    const href = $elem.find('a.membercard').attr('href') ?? '';
                    const citizenMatch = href.match(/\/citizens\/([^/]+)/);
                    if (citizenMatch) {
                        handle = citizenMatch[1];
                    }
                }
                const overlayTitle = (this.extractText($elem, '.roles .title') ?? '').toLowerCase();
                const isAffiliate = overlayTitle.includes('affiliate');
                const memberRoles = [];
                $elem.find('.roles .role, .roles span:not(.title)').each((_, roleElem) => {
                    const roleText = $(roleElem).text().trim();
                    if (roleText && !['roles', 'affiliate'].includes(roleText.toLowerCase())) {
                        memberRoles.push(roleText);
                    }
                });
                const member = {
                    handle,
                    displayName: this.extractText($elem, '.name'),
                    rank: this.extractText($elem, '.rank'),
                    stars: this.extractStars($elem),
                    rankNumber: this.extractStars($elem) || undefined,
                    isMain: !isAffiliate,
                    isAffiliate,
                    isHidden: $elem.hasClass('hidden') || $elem.find('.hidden').length > 0,
                    avatar: this.extractImageUrl($elem, '.thumb img'),
                    enlisted: this.extractText($elem, '.enlisted'),
                    roles: memberRoles.length > 0 ? memberRoles : undefined,
                };
                if (member.handle) {
                    members.push(member);
                }
            });
            this.recordSuccess();
            this.cache.set(cacheKey, members);
            logger_1.logger.info(`Successfully crawled ${members.length} members from organization: ${sid} page ${page}`);
            return members;
        }
        catch (error) {
            if (error instanceof Error &&
                !error.message.includes('circuit breaker') &&
                !error.message.includes('rate limit')) {
                this.recordFailure();
            }
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                const logPayload = {
                    status,
                    message: error.message,
                };
                if (this.isControlPathErrorMessage(error.message, status)) {
                    logger_1.logger.warn(`Failed to crawl members for ${sid} (degraded control path):`, logPayload);
                }
                else {
                    logger_1.logger.error(`Failed to crawl members for ${sid}:`, logPayload);
                }
                throw new Error(`Failed to crawl members: ${status ?? error.message}`);
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (this.isControlPathErrorMessage(errorMessage)) {
                logger_1.logger.warn(`Failed to crawl members for ${sid}: ${errorMessage}`);
            }
            else {
                logger_1.logger.error(`Failed to crawl members for ${sid}: ${errorMessage}`);
            }
            throw new Error(`Failed to crawl members: ${errorMessage}`);
        }
    }
    async crawlUserMemberships(handle) {
        (0, rsiValidation_1.validateRsiIdentifier)(handle, 'citizen handle');
        const cacheKey = `user:${handle}:orgs`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for user memberships: ${handle}`);
            return cached;
        }
        try {
            this.checkCircuitBreaker();
            await this.checkRateLimit();
            const citizenUrl = `${this.baseUrl}/citizens/${handle}`;
            const orgsUrl = `${this.baseUrl}/citizens/${handle}/organizations`;
            logger_1.logger.debug(`Crawling user memberships from RSI: ${citizenUrl} + ${orgsUrl}`);
            const [citizenResponse, orgsResponse] = await Promise.all([
                this.axiosInstance.get(citizenUrl),
                this.axiosInstance.get(orgsUrl).catch(() => null),
            ]);
            const $ = cheerio.load(citizenResponse.data);
            const memberships = [];
            let mainOrgRedacted = false;
            const parseOrgSection = (selector, isMain) => {
                $(selector).each((_, elem) => {
                    const $elem = $(elem);
                    if ($elem.find('.empty').length > 0) {
                        if (isMain) {
                            mainOrgRedacted = true;
                        }
                        return;
                    }
                    let sid = '';
                    const orgLink = $elem.find('a[href*="/orgs/"]').first().attr('href');
                    if (orgLink) {
                        const match = orgLink.match(/\/orgs\/([A-Za-z0-9_-]+)/);
                        if (match) {
                            sid = match[1];
                        }
                    }
                    const name = $elem.find('.info a.value').first().text().trim() ||
                        $elem.find('a[href*="/orgs/"]').first().text().trim();
                    let rank;
                    $elem.find('.entry').each((__, entryElem) => {
                        const $entry = $(entryElem);
                        const label = $entry.find('.label').text().trim();
                        if (label.includes('Organization rank')) {
                            rank = $entry.find('.value').text().trim() || undefined;
                        }
                    });
                    if (!sid) {
                        $elem.find('.entry').each((__, entryElem) => {
                            const $entry = $(entryElem);
                            const label = $entry.find('.label').text().trim();
                            if (label.includes('Spectrum Identification') || label.includes('SID')) {
                                sid = $entry.find('.value').text().trim();
                            }
                        });
                    }
                    const stars = this.extractStars($elem);
                    if (sid && name) {
                        memberships.push({ sid, name, rank, stars, isMain });
                    }
                });
            };
            parseOrgSection('.main-org', true);
            if (mainOrgRedacted && !memberships.some(m => m.isMain)) {
                memberships.push({
                    sid: 'REDACTED',
                    name: '[Hidden Organization]',
                    rank: undefined,
                    stars: 0,
                    isMain: true,
                });
            }
            if (orgsResponse?.data) {
                const $orgs = cheerio.load(orgsResponse.data);
                $orgs('.box-content.org').each((_, elem) => {
                    const $elem = $orgs(elem);
                    let sid = '';
                    const orgLink = $elem.find('a[href*="/orgs/"]').first().attr('href');
                    if (orgLink) {
                        const match = orgLink.match(/\/orgs\/([A-Za-z0-9_-]+)/);
                        if (match) {
                            sid = match[1];
                        }
                    }
                    const name = $elem.find('.orgtitle a.value').first().text().trim() ||
                        $elem.find('a[href*="/orgs/"]').first().text().trim();
                    let rank;
                    $elem.find('.entry').each((__, entryElem) => {
                        const $entry = $orgs(entryElem);
                        const label = $entry.find('.label').text().trim();
                        if (label.includes('Organization rank')) {
                            rank = $entry.find('.value').text().trim() || undefined;
                        }
                    });
                    if (!sid) {
                        $elem.find('.entry').each((__, entryElem) => {
                            const $entry = $orgs(entryElem);
                            const label = $entry.find('.label').text().trim();
                            if (label.includes('Spectrum Identification') || label.includes('SID')) {
                                sid = $entry.find('.value').text().trim();
                            }
                        });
                    }
                    const stars = $elem.find('.ranking .active').length;
                    const title = $elem.find('.title').text().trim().toLowerCase();
                    const isMain = title.includes('main') && !title.includes('affiliation');
                    if (sid && name) {
                        if (!memberships.some(m => m.sid === sid)) {
                            memberships.push({ sid, name, rank, stars, isMain });
                        }
                    }
                });
            }
            this.recordSuccess();
            this.cache.set(cacheKey, memberships);
            logger_1.logger.info(`Successfully crawled ${memberships.length} memberships for user: ${handle}`);
            return memberships;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const isControlPathError = this.isControlPathErrorMessage(errorMessage);
            if (error instanceof Error &&
                !error.message.includes('circuit breaker') &&
                !error.message.includes('rate limit')) {
                this.recordFailure();
            }
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                const logPayload = {
                    status,
                    message: error.message,
                };
                if (this.isControlPathErrorMessage(error.message, status)) {
                    logger_1.logger.warn(`Failed to crawl memberships for ${handle} (degraded control path):`, logPayload);
                }
                else {
                    logger_1.logger.error(`Failed to crawl memberships for ${handle}:`, logPayload);
                }
                throw new Error(`Failed to crawl memberships: ${error.response?.status ?? error.message}`);
            }
            if (isControlPathError) {
                logger_1.logger.warn(`Failed to crawl memberships for ${handle}: ${errorMessage}`);
            }
            else {
                logger_1.logger.error(`Failed to crawl memberships for ${handle}: ${errorMessage}`);
            }
            throw new Error(`Failed to crawl memberships: ${errorMessage}`);
        }
    }
    isControlPathErrorMessage(message, status) {
        if (status === 503) {
            return true;
        }
        const lowered = message.toLowerCase();
        return (lowered.includes('circuit breaker') ||
            lowered.includes('rate limit') ||
            lowered.includes('status code 503') ||
            lowered.includes('service unavailable'));
    }
    async crawlCitizen(handle) {
        (0, rsiValidation_1.validateRsiIdentifier)(handle, 'citizen handle');
        try {
            this.checkCircuitBreaker();
            await this.checkRateLimit();
            const url = `${this.baseUrl}/citizens/${handle}`;
            const response = await this.axiosInstance.get(url);
            if (response.status === 404) {
                return null;
            }
            const $ = cheerio.load(response.data);
            const displayName = this.extractText($, '.profile .info .entry:first-child') ??
                this.extractText($, '.profile .info p:first') ??
                this.extractText($, 'h1') ??
                handle;
            const bio = this.extractText($, '.bio .value') ??
                this.extractText($, '.bio') ??
                this.extractText($, '[class*="bio"]') ??
                '';
            let bioText = bio;
            if (!bioText) {
                bioText = $('body').text();
            }
            const citizenRecord = this.extractText($, '.citizen-record .value') ??
                this.extractText($, '.left-col .entry:contains("Citizen Record") .value') ??
                this.extractText($, '[class*="citizen"] .value');
            const title = this.extractText($, '.info .title') ?? this.extractText($, '.profile .title');
            const enlisted = this.extractText($, '.left-col .entry:contains("Enlisted") .value');
            const fluency = this.extractText($, '.left-col .entry:contains("Fluency") .value') ??
                this.extractText($, '.left-col .entry:contains("Language") .value');
            const location = this.extractText($, '.left-col .entry:contains("Location") .value');
            const website = this.extractText($, '.bio .entry:contains("Website") a') ??
                this.extractText($, '.left-col .entry:contains("Website") .value');
            const avatarUrl = this.extractImageUrl($, '.profile .thumb img');
            this.recordSuccess();
            return {
                handle,
                displayName: displayName !== handle ? displayName : undefined,
                bio: bioText || undefined,
                avatarUrl,
                citizenRecord,
                title,
                enlisted,
                fluency,
                location,
                website,
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    invalidateCitizenCache(handle) {
        this.cache.del(`user:${handle}:orgs`);
        logger_1.logger.debug(`RSI Crawler cache invalidated for citizen: ${handle}`);
    }
    invalidateOrgCache(sid) {
        const cacheKey = `org:${sid.toUpperCase()}`;
        this.cache.del(cacheKey);
        logger_1.logger.debug(`RSI Crawler cache invalidated for organization: ${sid}`);
    }
    clearCache() {
        this.cache.flushAll();
        logger_1.logger.info('RSI Crawler cache cleared');
    }
    getCircuitStatus() {
        return {
            state: this.circuitState,
            failures: this.failures,
            lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
        };
    }
    extractText($, selector, index) {
        try {
            const elem = typeof $ === 'function' ? $(selector) : $.find(selector);
            if (elem.length === 0) {
                return undefined;
            }
            const target = index !== undefined ? elem.eq(index) : elem.first();
            const text = target.text().trim();
            return text || undefined;
        }
        catch {
            return undefined;
        }
    }
    extractOrgTabContent($, tabName) {
        const selectors = [
            `#tab-${tabName} .body`,
            `#tab-${tabName} .markitup-text`,
            `#tab-${tabName} .entry-body`,
            `#tab-${tabName}`,
            `#${tabName} .body`,
            `#${tabName} .markitup-text`,
            `#${tabName}`,
            `.tab-pane#${tabName}`,
            `.tab-pane#tab-${tabName}`,
        ];
        for (const selector of selectors) {
            try {
                const elem = $(selector);
                if (elem.length > 0) {
                    const text = elem.text().trim();
                    if (text) {
                        return text;
                    }
                }
            }
            catch {
            }
        }
        return undefined;
    }
    extractImageUrl($, selector) {
        try {
            const elem = typeof $ === 'function' ? $(selector) : $.find(selector);
            if (elem.length === 0) {
                return undefined;
            }
            const src = elem.first().attr('src');
            if (!src) {
                return undefined;
            }
            if (src.startsWith('//')) {
                return `https:${src}`;
            }
            else if (src.startsWith('/')) {
                return this.baseUrl + src;
            }
            return src;
        }
        catch {
            return undefined;
        }
    }
    extractNumber($, selector, index) {
        try {
            const text = this.extractText($, selector, index);
            if (!text) {
                return undefined;
            }
            const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
            return isNaN(num) ? undefined : num;
        }
        catch {
            return undefined;
        }
    }
    extractCountFromPageText($, label) {
        try {
            const normalizedText = $('body').text().replace(/\s+/g, ' ').trim();
            if (!normalizedText) {
                return undefined;
            }
            const regex = new RegExp(`(\\d[\\d,]*)\\s+${label.slice(0, -1)}(?:s)?`, 'i');
            const match = normalizedText.match(regex);
            if (!match) {
                return undefined;
            }
            const num = parseInt(match[1].replace(/,/g, ''), 10);
            return Number.isNaN(num) ? undefined : num;
        }
        catch {
            return undefined;
        }
    }
    extractStars($elem) {
        try {
            const starsStyle = $elem.find('.stars').attr('style') ?? '';
            const widthMatch = starsStyle.match(/width:\s*([\d.]+)%/);
            if (widthMatch) {
                const pct = parseFloat(widthMatch[1]);
                return Math.min(Math.max(Math.round(pct / 20), 0), 5);
            }
            const activeCount = $elem.find('.ranking .active').length;
            if (activeCount > 0) {
                return Math.min(Math.max(activeCount, 0), 5);
            }
            const count = $elem.find('.star').length;
            return Math.min(Math.max(count, 0), 5);
        }
        catch {
            return 0;
        }
    }
}
exports.RsiCrawlerService = RsiCrawlerService;
exports.rsiCrawlerService = new RsiCrawlerService();
//# sourceMappingURL=RsiCrawlerService.js.map