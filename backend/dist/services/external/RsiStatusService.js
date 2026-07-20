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
exports.rsiStatusService = exports.RsiStatusService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../utils/logger");
const RSS_URL = 'https://status.robertsspaceindustries.com/index.xml';
const STATUS_PAGE_URL = 'https://status.robertsspaceindustries.com/';
const CACHE_KEY = 'rsi_status_snapshot';
const CACHE_TTL_SECONDS = 120;
class RsiStatusService {
    static instance;
    cache;
    constructor() {
        this.cache = new node_cache_1.default({ stdTTL: CACHE_TTL_SECONDS });
    }
    static getInstance() {
        if (!RsiStatusService.instance) {
            RsiStatusService.instance = new RsiStatusService();
        }
        return RsiStatusService.instance;
    }
    async getStatus() {
        const cached = this.cache.get(CACHE_KEY);
        if (cached) {
            return cached;
        }
        const [components, latestIncident] = await Promise.all([
            this.fetchComponentStatuses(),
            this.fetchLatestIncident(),
        ]);
        const hasIssue = components.some(c => c.status.toLowerCase() !== 'operational');
        const snapshot = {
            components,
            overallStatus: hasIssue ? 'Degraded' : 'All Systems Operational',
            latestIncident,
            fetchedAt: new Date(),
        };
        this.cache.set(CACHE_KEY, snapshot);
        return snapshot;
    }
    invalidateCache() {
        this.cache.del(CACHE_KEY);
    }
    async fetchComponentStatuses() {
        try {
            const { data: html } = await axios_1.default.get(STATUS_PAGE_URL, {
                timeout: 10_000,
                headers: { 'User-Agent': 'SCFleetManager/1.0 StatusBot' },
            });
            return this.parseComponentStatuses(html);
        }
        catch (error) {
            logger_1.logger.warn('RsiStatusService: Failed to fetch component statuses', {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    parseComponentStatuses(html) {
        const knownComponents = ['Platform', 'Persistent Universe', 'Arena Commander'];
        const textContent = cheerio
            .load(html)
            .text()
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return knownComponents.map(name => ({
            name,
            status: this.extractStatusFromTextSummary(textContent, name) ??
                this.extractStatusNearComponentName(html, name) ??
                'Unknown',
        }));
    }
    extractStatusFromTextSummary(textContent, componentName) {
        const escapedName = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const statusMatch = new RegExp(`${escapedName}\\s*(Operational|Maintenance|Degraded(?:\\s+Performance)?|Partial(?:\\s+Outage)?|Major\\s+Outage|Outage|Unknown)`, 'i').exec(textContent);
        return this.toCanonicalStatus(statusMatch?.[1]);
    }
    extractStatusNearComponentName(html, componentName) {
        const lowerHtml = html.toLowerCase();
        const lowerName = componentName.toLowerCase();
        const searchRadius = 90;
        let searchIndex = 0;
        while (searchIndex < lowerHtml.length) {
            const matchIndex = lowerHtml.indexOf(lowerName, searchIndex);
            if (matchIndex === -1) {
                break;
            }
            const afterSlice = lowerHtml.slice(matchIndex + lowerName.length, matchIndex + lowerName.length + searchRadius);
            const beforeSlice = lowerHtml.slice(Math.max(0, matchIndex - searchRadius), matchIndex);
            const afterStatus = this.extractStatusToken(afterSlice);
            if (afterStatus) {
                return afterStatus;
            }
            const beforeStatus = this.extractStatusToken(beforeSlice);
            if (beforeStatus) {
                return beforeStatus;
            }
            searchIndex = matchIndex + lowerName.length;
        }
        return null;
    }
    extractStatusToken(source) {
        const statusMatch = /(operational|maintenance|degraded(?:\s+performance)?|partial(?:\s+outage)?|major\s+outage|outage|unknown)/i.exec(source);
        return this.toCanonicalStatus(statusMatch?.[1]);
    }
    toCanonicalStatus(status) {
        if (!status) {
            return null;
        }
        const normalized = status.toLowerCase().trim();
        if (normalized.startsWith('operational')) {
            return 'Operational';
        }
        if (normalized.startsWith('maintenance')) {
            return 'Maintenance';
        }
        if (normalized.startsWith('degraded')) {
            return 'Degraded';
        }
        if (normalized.startsWith('partial')) {
            return 'Partial Outage';
        }
        if (normalized.includes('major outage') || normalized === 'outage') {
            return 'Major Outage';
        }
        if (normalized.startsWith('unknown')) {
            return 'Unknown';
        }
        return null;
    }
    async fetchLatestIncident() {
        try {
            const { data: xml } = await axios_1.default.get(RSS_URL, {
                timeout: 10_000,
                headers: { 'User-Agent': 'SCFleetManager/1.0 StatusBot' },
            });
            return this.parseLatestIncident(xml);
        }
        catch (error) {
            logger_1.logger.warn('RsiStatusService: Failed to fetch RSS feed', {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    parseLatestIncident(xml) {
        try {
            const $ = cheerio.load(xml, { xml: true });
            const firstItem = $('item').first();
            if (firstItem.length === 0) {
                return null;
            }
            const title = firstItem.find('title').text().trim();
            const resolved = title.startsWith('[Resolved]');
            const rawDesc = firstItem.find('description').text().trim();
            const cleanDesc = rawDesc
                .replace(/<[^>]+>/g, '')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1000);
            return {
                title: title.replace('[Resolved] ', '').replace('[Resolved]', '').trim(),
                link: firstItem.find('link').text().trim(),
                pubDate: firstItem.find('pubDate').text().trim(),
                description: cleanDesc,
                resolved,
                category: firstItem.find('category').text().trim() || undefined,
            };
        }
        catch (error) {
            logger_1.logger.warn('RsiStatusService: Failed to parse RSS feed', {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
}
exports.RsiStatusService = RsiStatusService;
exports.rsiStatusService = RsiStatusService.getInstance();
//# sourceMappingURL=RsiStatusService.js.map