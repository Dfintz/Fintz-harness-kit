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
exports.RegolithDataFetcher = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const node_cron_1 = require("node-cron");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
class RegolithDataFetcher {
    static BASE_URL = 'https://regolith.rocks';
    static FETCH_TIMEOUT = 30000;
    static USER_AGENT = 'SC-Fleet-Manager/1.0 (Mining Data Integration)';
    static MIN_RESPONSE_LENGTH = 50;
    static DEFAULT_REFINERY_DURATION = 3600;
    static DEFAULT_REFINERY_EFFICIENCY = 95;
    static DEFAULT_REFINERY_COST = 5;
    static cachedData = null;
    static fetchStatuses = [];
    static isFetching = false;
    static scheduledTask = null;
    static initialFetchTimeout = null;
    static isExternalFetchesDisabled() {
        const flag = process.env.DISABLE_EXTERNAL_FETCHES;
        return flag === '1' || flag === 'true';
    }
    static isTestRuntime() {
        return process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    }
    static DATA_SOURCES = {
        ores: '/survey/ores',
        rockClass: '/survey/rock_class',
        classLocation: '/survey/class_location',
        gems: '/survey/gems',
        refinery: '/tables/refinery',
        market: '/tables/market',
    };
    static getCachedData() {
        return this.cachedData;
    }
    static getFetchStatuses() {
        return this.fetchStatuses;
    }
    static isCurrentlyFetching() {
        return this.isFetching;
    }
    static isDataStale() {
        if (!this.cachedData) {
            return true;
        }
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        return this.cachedData.lastUpdated < twelveHoursAgo;
    }
    static async execute() {
        if (this.isExternalFetchesDisabled() || this.isTestRuntime()) {
            logger_1.logger.info('Skipping Regolith data fetch (external fetch disabled or test runtime)', {
                disableExternalFetches: this.isExternalFetchesDisabled(),
                isTestRuntime: this.isTestRuntime(),
            });
            return;
        }
        if (this.isFetching) {
            logger_1.logger.warn('Regolith data fetch already in progress, skipping...');
            return;
        }
        this.isFetching = true;
        const startTime = Date.now();
        logger_1.logger.info('Starting Regolith data fetch job...');
        try {
            const [ores, rockClasses, classLocations, gems, refineries, markets] = await Promise.allSettled([
                this.fetchOres(),
                this.fetchRockClasses(),
                this.fetchClassLocations(),
                this.fetchGems(),
                this.fetchRefineries(),
                this.fetchMarkets(),
            ]);
            this.cachedData = {
                lastUpdated: new Date(),
                ores: ores.status === 'fulfilled' ? ores.value : this.cachedData?.ores || [],
                rockClasses: rockClasses.status === 'fulfilled'
                    ? rockClasses.value
                    : this.cachedData?.rockClasses || [],
                classLocations: classLocations.status === 'fulfilled'
                    ? classLocations.value
                    : this.cachedData?.classLocations || [],
                gems: gems.status === 'fulfilled' ? gems.value : this.cachedData?.gems || [],
                refineries: refineries.status === 'fulfilled' ? refineries.value : this.cachedData?.refineries || [],
                markets: markets.status === 'fulfilled' ? markets.value : this.cachedData?.markets || [],
            };
            const duration = Date.now() - startTime;
            const successCount = this.fetchStatuses.filter(s => s.success).length;
            logger_1.logger.info(`Regolith data fetch completed in ${duration}ms`, {
                successCount,
                totalSources: this.fetchStatuses.length,
                oresCount: this.cachedData.ores.length,
                locationsCount: this.cachedData.classLocations.length,
                marketsCount: this.cachedData.markets.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Error during Regolith data fetch:', error);
        }
        finally {
            this.isFetching = false;
        }
    }
    static async fetchOres() {
        const url = `${this.BASE_URL}${this.DATA_SOURCES.ores}`;
        const status = {
            source: 'ores',
            url,
            success: false,
            lastFetch: new Date(),
            recordCount: 0,
        };
        try {
            const response = await axios_1.default.get(url, {
                timeout: this.FETCH_TIMEOUT,
                headers: { 'User-Agent': this.USER_AGENT },
            });
            if (!this.validateResponse({ headers: response.headers, data: response.data }, url, 'ores')) {
                throw new Error('Invalid response format from data source');
            }
            const $ = cheerio.load(response.data);
            const ores = [];
            $('table tbody tr').each((_index, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 2) {
                    const name = $(cells[0]).text().trim();
                    const symbol = $(cells[1]).text().trim() || name.substring(0, 4).toUpperCase();
                    const priceText = cells.length >= 3 ? $(cells[2]).text().trim() : '';
                    const basePrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || undefined;
                    if (name) {
                        ores.push({
                            name,
                            symbol,
                            type: 'ore',
                            basePrice,
                            tradeable: true,
                        });
                    }
                }
            });
            status.success = true;
            status.recordCount = ores.length;
            this.updateFetchStatus(status);
            logger_1.logger.info(`Fetched ${ores.length} ores from regolith.rocks`);
            return ores;
        }
        catch (error) {
            status.error = (0, errorHandler_1.getErrorMessage)(error);
            this.updateFetchStatus(status);
            logger_1.logger.error('Failed to fetch ores:', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static async fetchRockClasses() {
        const url = `${this.BASE_URL}${this.DATA_SOURCES.rockClass}`;
        const status = {
            source: 'rockClass',
            url,
            success: false,
            lastFetch: new Date(),
            recordCount: 0,
        };
        try {
            const response = await axios_1.default.get(url, {
                timeout: this.FETCH_TIMEOUT,
                headers: { 'User-Agent': this.USER_AGENT },
            });
            if (!this.validateResponse({ headers: response.headers, data: response.data }, url, 'rockClass')) {
                throw new Error('Invalid response format from data source');
            }
            const $ = cheerio.load(response.data);
            const rockClasses = [];
            $('table tbody tr').each((_index, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 2) {
                    const name = $(cells[0]).text().trim();
                    const oresText = $(cells[1]).text().trim();
                    const oreTypes = oresText
                        .split(/[,;]/)
                        .map(o => o.trim())
                        .filter(o => o);
                    const description = cells.length >= 3 ? $(cells[2]).text().trim() : undefined;
                    if (name) {
                        rockClasses.push({
                            name,
                            oreTypes,
                            description,
                        });
                    }
                }
            });
            status.success = true;
            status.recordCount = rockClasses.length;
            this.updateFetchStatus(status);
            logger_1.logger.info(`Fetched ${rockClasses.length} rock classes from regolith.rocks`);
            return rockClasses;
        }
        catch (error) {
            status.error = (0, errorHandler_1.getErrorMessage)(error);
            this.updateFetchStatus(status);
            logger_1.logger.error('Failed to fetch rock classes:', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static async fetchClassLocations() {
        const url = `${this.BASE_URL}${this.DATA_SOURCES.classLocation}`;
        const status = {
            source: 'classLocation',
            url,
            success: false,
            lastFetch: new Date(),
            recordCount: 0,
        };
        try {
            const response = await axios_1.default.get(url, {
                timeout: this.FETCH_TIMEOUT,
                headers: { 'User-Agent': this.USER_AGENT },
            });
            if (!this.validateResponse({ headers: response.headers, data: response.data }, url, 'classLocation')) {
                throw new Error('Invalid response format from data source');
            }
            const $ = cheerio.load(response.data);
            const classLocations = [];
            $('table tbody tr').each((_index, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 3) {
                    const location = $(cells[0]).text().trim();
                    const system = $(cells[1]).text().trim() || 'Stanton';
                    const body = cells.length >= 4 ? $(cells[3]).text().trim() : undefined;
                    const rockClassesText = $(cells[2]).text().trim();
                    const rockClasses = rockClassesText
                        .split(/[,;]/)
                        .map(c => c.trim())
                        .filter(c => c);
                    const orePercentages = {};
                    const percentageMatches = rockClassesText.match(/(\w+)\s*[:=]\s*([\d.]+)%?/g);
                    if (percentageMatches) {
                        percentageMatches.forEach(match => {
                            const [ore, pct] = match.split(/[:=]/);
                            if (ore && pct) {
                                orePercentages[ore.trim()] = parseFloat(pct.replace('%', ''));
                            }
                        });
                    }
                    if (location) {
                        classLocations.push({
                            location,
                            system,
                            body,
                            rockClasses,
                            orePercentages,
                        });
                    }
                }
            });
            status.success = true;
            status.recordCount = classLocations.length;
            this.updateFetchStatus(status);
            logger_1.logger.info(`Fetched ${classLocations.length} class locations from regolith.rocks`);
            return classLocations;
        }
        catch (error) {
            status.error = (0, errorHandler_1.getErrorMessage)(error);
            this.updateFetchStatus(status);
            logger_1.logger.error('Failed to fetch class locations:', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static async fetchGems() {
        const url = `${this.BASE_URL}${this.DATA_SOURCES.gems}`;
        const status = {
            source: 'gems',
            url,
            success: false,
            lastFetch: new Date(),
            recordCount: 0,
        };
        try {
            const response = await axios_1.default.get(url, {
                timeout: this.FETCH_TIMEOUT,
                headers: { 'User-Agent': this.USER_AGENT },
            });
            if (!this.validateResponse({ headers: response.headers, data: response.data }, url, 'gems')) {
                throw new Error('Invalid response format from data source');
            }
            const $ = cheerio.load(response.data);
            const gems = [];
            $('table tbody tr').each((_index, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 2) {
                    const name = $(cells[0]).text().trim();
                    const symbol = cells.length >= 2 ? $(cells[1]).text().trim() : name.substring(0, 4).toUpperCase();
                    const priceText = cells.length >= 3 ? $(cells[2]).text().trim() : '0';
                    const basePrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                    const locationsText = cells.length >= 4 ? $(cells[3]).text().trim() : '';
                    const locations = locationsText
                        .split(/[,;]/)
                        .map(l => l.trim())
                        .filter(l => l);
                    if (name) {
                        gems.push({
                            name,
                            symbol,
                            basePrice,
                            locations,
                        });
                    }
                }
            });
            status.success = true;
            status.recordCount = gems.length;
            this.updateFetchStatus(status);
            logger_1.logger.info(`Fetched ${gems.length} gems from regolith.rocks`);
            return gems;
        }
        catch (error) {
            status.error = (0, errorHandler_1.getErrorMessage)(error);
            this.updateFetchStatus(status);
            logger_1.logger.error('Failed to fetch gems:', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static async fetchRefineries() {
        const url = `${this.BASE_URL}${this.DATA_SOURCES.refinery}`;
        const status = {
            source: 'refinery',
            url,
            success: false,
            lastFetch: new Date(),
            recordCount: 0,
        };
        try {
            const response = await axios_1.default.get(url, {
                timeout: this.FETCH_TIMEOUT,
                headers: { 'User-Agent': this.USER_AGENT },
            });
            if (!this.validateResponse({ headers: response.headers, data: response.data }, url, 'refinery')) {
                throw new Error('Invalid response format from data source');
            }
            const $ = cheerio.load(response.data);
            const refineries = [];
            $('table tbody tr').each((_index, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 2) {
                    const name = $(cells[0]).text().trim();
                    const location = $(cells[1]).text().trim();
                    const system = cells.length >= 3 ? $(cells[2]).text().trim() : 'Stanton';
                    const methods = [];
                    const methodsText = cells.length >= 4 ? $(cells[3]).text().trim() : '';
                    const methodNames = [
                        'Cormack',
                        'Dinyx Solventation',
                        'Electrostarolysis',
                        'Ferron Exchange',
                        'Gaskin Process',
                        'Kazen Winnowing',
                        'Pyrometric Chromalysis',
                        'Thermonetic Tempering',
                        'XCR Reaction',
                    ];
                    methodNames.forEach(methodName => {
                        if (methodsText.toLowerCase().includes(methodName.toLowerCase())) {
                            methods.push({
                                name: methodName,
                                duration: this.DEFAULT_REFINERY_DURATION,
                                efficiency: this.DEFAULT_REFINERY_EFFICIENCY,
                                cost: this.DEFAULT_REFINERY_COST,
                            });
                        }
                    });
                    const oresText = cells.length >= 5 ? $(cells[4]).text().trim() : '';
                    const ores = oresText
                        .split(/[,;]/)
                        .map(o => o.trim())
                        .filter(o => o);
                    if (name) {
                        refineries.push({
                            name,
                            location,
                            system,
                            methods,
                            ores,
                        });
                    }
                }
            });
            status.success = true;
            status.recordCount = refineries.length;
            this.updateFetchStatus(status);
            logger_1.logger.info(`Fetched ${refineries.length} refineries from regolith.rocks`);
            return refineries;
        }
        catch (error) {
            status.error = (0, errorHandler_1.getErrorMessage)(error);
            this.updateFetchStatus(status);
            logger_1.logger.error('Failed to fetch refineries:', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static async fetchMarkets() {
        const url = `${this.BASE_URL}${this.DATA_SOURCES.market}`;
        const status = {
            source: 'market',
            url,
            success: false,
            lastFetch: new Date(),
            recordCount: 0,
        };
        try {
            const response = await axios_1.default.get(url, {
                timeout: this.FETCH_TIMEOUT,
                headers: { 'User-Agent': this.USER_AGENT },
            });
            if (!this.validateResponse({ headers: response.headers, data: response.data }, url, 'market')) {
                throw new Error('Invalid response format from data source');
            }
            const $ = cheerio.load(response.data);
            const markets = [];
            $('table tbody tr').each((_index, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 2) {
                    const location = $(cells[0]).text().trim();
                    const system = cells.length >= 2 ? $(cells[1]).text().trim() : 'Stanton';
                    const typeText = cells.length >= 3 ? $(cells[2]).text().trim().toLowerCase() : 'both';
                    const type = typeText.includes('buy') && typeText.includes('sell')
                        ? 'both'
                        : typeText.includes('buy')
                            ? 'buy'
                            : typeText.includes('sell')
                                ? 'sell'
                                : 'both';
                    const commodities = [];
                    const commoditiesText = cells.length >= 4 ? $(cells[3]).text().trim() : '';
                    const commodityMatches = commoditiesText.match(/(\w+(?:\s+\w+)?)\s*@?\s*([\d.]+)?/g);
                    if (commodityMatches) {
                        commodityMatches.forEach(match => {
                            const parts = match.split(/[@\s]+/);
                            const name = parts[0];
                            const price = parts.length > 1 ? parseFloat(parts[1]) : undefined;
                            if (name && name.length > 1) {
                                commodities.push({
                                    name,
                                    symbol: name.substring(0, 4).toUpperCase(),
                                    sellPrice: type !== 'buy' ? price : undefined,
                                    buyPrice: type !== 'sell' ? price : undefined,
                                });
                            }
                        });
                    }
                    if (location) {
                        markets.push({
                            location,
                            system,
                            type,
                            commodities,
                        });
                    }
                }
            });
            status.success = true;
            status.recordCount = markets.length;
            this.updateFetchStatus(status);
            logger_1.logger.info(`Fetched ${markets.length} markets from regolith.rocks`);
            return markets;
        }
        catch (error) {
            status.error = (0, errorHandler_1.getErrorMessage)(error);
            this.updateFetchStatus(status);
            logger_1.logger.error('Failed to fetch markets:', { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static updateFetchStatus(status) {
        const existingIndex = this.fetchStatuses.findIndex(s => s.source === status.source);
        if (existingIndex >= 0) {
            this.fetchStatuses[existingIndex] = status;
        }
        else {
            this.fetchStatuses.push(status);
        }
    }
    static validateResponse(response, url, source) {
        const contentType = response.headers['content-type'] || '';
        const responseText = String(response.data || '').trim();
        const responseTextLower = responseText.toLowerCase();
        if (!responseText || responseText.length < this.MIN_RESPONSE_LENGTH) {
            logger_1.logger.warn(`Received empty response from ${url}`, { source });
            return false;
        }
        if (responseTextLower.includes('<!doctype') && !responseTextLower.includes('<table')) {
            logger_1.logger.warn(`Received HTML page without table data from ${url}`, {
                source,
                contentType,
                responsePreview: responseText.substring(0, 200),
            });
            return false;
        }
        if (!responseTextLower.includes('<table') && !responseTextLower.includes('<tbody')) {
            logger_1.logger.warn(`No table structure found in response from ${url}`, {
                source,
                contentType,
                hasHtml: responseTextLower.includes('<html'),
                responseLength: responseText.length,
                responsePreview: responseText.substring(0, 200),
            });
            return false;
        }
        return true;
    }
    static async forceRefresh() {
        logger_1.logger.info('Forcing manual Regolith data refresh...');
        await this.execute();
    }
    static clearCache() {
        this.cachedData = null;
        this.fetchStatuses = [];
        logger_1.logger.info('Regolith data cache cleared');
    }
    static schedule() {
        if (this.scheduledTask) {
            logger_1.logger.warn('Regolith data fetch job already scheduled');
            return;
        }
        this.scheduledTask = (0, node_cron_1.schedule)('0 0,6,12,18 * * *', async () => {
            try {
                await this.execute();
            }
            catch (error) {
                logger_1.logger.error('Scheduled Regolith data fetch failed:', error);
            }
        }, {
            timezone: 'UTC',
            name: 'regolith-data-fetch',
        });
        void this.scheduledTask.start();
        logger_1.logger.info('Regolith data fetch job scheduled (every 6 hours at 00:00, 06:00, 12:00, 18:00 UTC)');
        this.initialFetchTimeout = setTimeout(() => {
            void (async () => {
                try {
                    logger_1.logger.info('Running initial Regolith data fetch...');
                    await this.execute();
                }
                catch (error) {
                    logger_1.logger.error('Initial Regolith data fetch failed:', error);
                }
                finally {
                    this.initialFetchTimeout = null;
                }
            })();
        }, 30000);
        this.initialFetchTimeout.unref();
    }
    static stop() {
        if (this.initialFetchTimeout) {
            clearTimeout(this.initialFetchTimeout);
            this.initialFetchTimeout = null;
        }
        if (this.scheduledTask) {
            void this.scheduledTask.stop();
            this.scheduledTask = null;
            logger_1.logger.info('Regolith data fetch job stopped');
        }
    }
}
exports.RegolithDataFetcher = RegolithDataFetcher;
//# sourceMappingURL=regolithDataFetcher.js.map