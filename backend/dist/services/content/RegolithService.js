"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegolithService = void 0;
const regolithDataFetcher_1 = require("../../jobs/regolithDataFetcher");
const logger_1 = require("../../utils/logger");
class RegolithService {
    static REGOLITH_BASE_URL = 'https://regolith.rocks';
    static CACHE_DURATION = 3600000;
    static cache = new Map();
    static toPercentage(value) {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            return parseFloat(value) || 0;
        }
        return 0;
    }
    static async getMiningData(locationName) {
        try {
            const cacheKey = `mining_${locationName.toLowerCase()}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.data;
            }
            let miningData = await this.getLiveMiningData(locationName);
            if (!miningData) {
                miningData = await this.getFallbackMiningData(locationName);
            }
            if (miningData) {
                this.cache.set(cacheKey, { data: miningData, timestamp: Date.now() });
            }
            return miningData;
        }
        catch (error) {
            logger_1.logger.error('Error fetching mining data:', error);
            return null;
        }
    }
    static async getLiveMiningData(locationName) {
        const cachedData = regolithDataFetcher_1.RegolithDataFetcher.getCachedData();
        if (!cachedData || cachedData.classLocations.length === 0) {
            return null;
        }
        const normalizedName = locationName.toLowerCase().trim();
        const locationData = cachedData.classLocations.find(loc => loc.location.toLowerCase() === normalizedName ||
            loc.body?.toLowerCase().includes(normalizedName));
        if (!locationData) {
            return null;
        }
        const resources = [];
        Object.entries(locationData.orePercentages).forEach(([oreName, pct]) => {
            const percentage = this.toPercentage(pct);
            const oreData = cachedData.ores.find(o => o.name.toLowerCase() === oreName.toLowerCase() ||
                o.symbol.toLowerCase() === oreName.toLowerCase());
            const sellLocations = cachedData.markets
                .filter(m => m.type !== 'buy' && m.commodities.some(c => c.name.toLowerCase() === oreName.toLowerCase()))
                .map(m => m.location)
                .slice(0, 3);
            resources.push({
                name: oreData?.name || oreName,
                symbol: oreData?.symbol || oreName.substring(0, 4).toUpperCase(),
                percentage,
                price: oreData?.basePrice,
                sellLocations: sellLocations.length > 0 ? sellLocations : undefined
            });
        });
        const gemsForLocation = cachedData.gems.filter(g => g.locations.some(l => l.toLowerCase().includes(normalizedName)));
        gemsForLocation.forEach(gem => {
            if (!resources.find(r => r.name.toLowerCase() === gem.name.toLowerCase())) {
                resources.push({
                    name: gem.name,
                    symbol: gem.symbol,
                    percentage: 5,
                    price: gem.basePrice,
                    sellLocations: gem.locations.slice(0, 3)
                });
            }
        });
        resources.sort((a, b) => b.percentage - a.percentage);
        const accessibility = this.determineAccessibility(locationData.rockClasses, locationData.system);
        return {
            name: locationData.location,
            system: locationData.system,
            body: locationData.body,
            resources,
            accessibility,
            notes: `Live data from regolith.rocks. Last updated: ${cachedData.lastUpdated.toISOString()}`
        };
    }
    static determineAccessibility(rockClasses, system) {
        if (system.toLowerCase() === 'pyro') {
            return 'Extreme';
        }
        const hasQuantaniumRocks = rockClasses.some(rc => rc.toLowerCase().includes('quantanium') || rc.toLowerCase().includes('unstable'));
        if (hasQuantaniumRocks) {
            return 'Difficult';
        }
        if (rockClasses.some(rc => rc.toLowerCase().includes('asteroid') || rc.toLowerCase().includes('belt'))) {
            return 'Difficult';
        }
        const hasModerateIndicators = rockClasses.some(rc => rc.toLowerCase().includes('volcanic') ||
            rc.toLowerCase().includes('toxic') ||
            rc.toLowerCase().includes('hazardous'));
        if (hasModerateIndicators) {
            return 'Moderate';
        }
        return 'Easy';
    }
    static getDataFetchStatus() {
        const cachedData = regolithDataFetcher_1.RegolithDataFetcher.getCachedData();
        return {
            hasLiveData: cachedData !== null && cachedData.classLocations.length > 0,
            lastUpdated: cachedData?.lastUpdated || null,
            sources: regolithDataFetcher_1.RegolithDataFetcher.getFetchStatuses(),
            isStale: regolithDataFetcher_1.RegolithDataFetcher.isDataStale()
        };
    }
    static async forceDataRefresh() {
        await regolithDataFetcher_1.RegolithDataFetcher.forceRefresh();
        this.clearCache();
    }
    static async getAllLiveLocations() {
        const cachedData = regolithDataFetcher_1.RegolithDataFetcher.getCachedData();
        if (!cachedData) {
            return [];
        }
        return cachedData.classLocations.map(loc => loc.location);
    }
    static getRefineriesData() {
        const cachedData = regolithDataFetcher_1.RegolithDataFetcher.getCachedData();
        return cachedData?.refineries || [];
    }
    static getMarketsData() {
        const cachedData = regolithDataFetcher_1.RegolithDataFetcher.getCachedData();
        return cachedData?.markets || [];
    }
    static getGemsData() {
        const cachedData = regolithDataFetcher_1.RegolithDataFetcher.getCachedData();
        return cachedData?.gems || [];
    }
    static startScheduledFetch() {
        regolithDataFetcher_1.RegolithDataFetcher.schedule();
    }
    static stopScheduledFetch() {
        regolithDataFetcher_1.RegolithDataFetcher.stop();
    }
    static async generateMiningDescription(location, systemLocation) {
        try {
            const miningData = await this.getMiningData(location);
            if (!miningData) {
                return `Mining location: ${location}${systemLocation ? ` (${systemLocation})` : ''}`;
            }
            const topResources = miningData.resources
                .sort((a, b) => b.percentage - a.percentage)
                .slice(0, 5);
            let description = `\n\n**📍 Mining Location Data:**\n`;
            description += `**System:** ${miningData.system}\n`;
            if (miningData.body) {
                description += `**Celestial Body:** ${miningData.body}\n`;
            }
            description += `**Accessibility:** ${miningData.accessibility}\n\n`;
            description += `**Top Mineral Resources:**\n`;
            topResources.forEach((resource, index) => {
                description += `${index + 1}. **${resource.name}** (${resource.symbol}) - ${resource.percentage.toFixed(2)}%`;
                if (resource.price) {
                    description += ` | ~${resource.price} aUEC/unit`;
                }
                description += `\n`;
            });
            if (miningData.notes) {
                description += `\n**Notes:** ${miningData.notes}\n`;
            }
            description += `\n*Data source: regolith.rocks community database*`;
            return description;
        }
        catch (error) {
            logger_1.logger.error('Error generating mining description:', error);
            return '';
        }
    }
    static async getMiningDataSummary(location) {
        const miningData = await this.getMiningData(location);
        if (!miningData) {
            return null;
        }
        const topResources = miningData.resources
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 3)
            .map(r => ({
            name: r.name,
            symbol: r.symbol || r.name.substring(0, 3).toUpperCase(),
            percentage: r.percentage,
            estimatedValue: r.price ? r.price * r.percentage : undefined,
            price: r.price,
            sellLocations: r.sellLocations
        }));
        const recommendedShips = this.getRecommendedMiningShips(miningData.accessibility);
        return {
            location: miningData.name,
            system: miningData.system,
            totalResources: miningData.resources.length,
            topResources,
            accessibility: miningData.accessibility,
            recommendedShips,
            estimatedProfitPerHour: this.estimateProfitPerHour(miningData.resources),
            notes: miningData.notes || ''
        };
    }
    static getRecommendedMiningShips(accessibility) {
        const recommendations = {
            'Easy': ['MISC Prospector', 'ARGO Mole', 'Greycat ROC'],
            'Moderate': ['MISC Prospector', 'ARGO Mole', 'Aegis Vulture'],
            'Difficult': ['ARGO Mole', 'Orion (when available)', 'Aegis Vulture'],
            'Extreme': ['ARGO Mole', 'Orion (when available)', 'RSI Constellation (support)']
        };
        return recommendations[accessibility] || recommendations['Easy'];
    }
    static estimateProfitPerHour(resources) {
        const avgSCUPerHour = 20;
        const weightedValue = resources.reduce((sum, resource) => {
            const value = resource.price || 0;
            const weight = resource.percentage / 100;
            return sum + (value * weight);
        }, 0);
        return Math.round(weightedValue * avgSCUPerHour);
    }
    static async getFallbackMiningData(locationName) {
        const miningDatabase = {
            'arial': {
                name: 'Arial',
                system: 'Stanton',
                body: 'Hurston - Arial',
                accessibility: 'Easy',
                resources: [
                    { name: 'Agricium', symbol: 'Agri', percentage: 15.5, price: 25.5, sellLocations: ['Lorville CBD', 'Area18 TDD', 'Port Olisar'] },
                    { name: 'Hephaestanite', symbol: 'Heph', percentage: 12.3, price: 18.0, sellLocations: ['Lorville CBD', 'Port Olisar', 'Grim HEX'] },
                    { name: 'Titanium', symbol: 'Ti', percentage: 10.8, price: 8.04, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] },
                    { name: 'Laranite', symbol: 'Lara', percentage: 8.2, price: 27.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Quantainium', symbol: 'Quan', percentage: 3.1, price: 88.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] }
                ],
                notes: 'Rich in Agricium. Accessible for beginner miners. Low gravity.'
            },
            'aberdeen': {
                name: 'Aberdeen',
                system: 'Stanton',
                body: 'Hurston - Aberdeen',
                accessibility: 'Moderate',
                resources: [
                    { name: 'Aluminium', symbol: 'Al', percentage: 18.2, price: 1.24, sellLocations: ['Lorville CBD', 'Port Olisar', 'Area18 TDD'] },
                    { name: 'Titanium', symbol: 'Ti', percentage: 14.5, price: 8.04, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] },
                    { name: 'Beryl', symbol: 'Bery', percentage: 11.3, price: 3.19, sellLocations: ['Port Olisar', 'Lorville CBD', 'Grim HEX'] },
                    { name: 'Hephaestanite', symbol: 'Heph', percentage: 9.8, price: 18.0, sellLocations: ['Lorville CBD', 'Port Olisar', 'Grim HEX'] },
                    { name: 'Taranite', symbol: 'Tara', percentage: 7.1, price: 5.82, sellLocations: ['Port Olisar', 'Area18 TDD', 'Lorville CBD'] }
                ],
                notes: 'Strong winds. Toxic atmosphere. Recommended for experienced miners.'
            },
            'daymar': {
                name: 'Daymar',
                system: 'Stanton',
                body: 'Crusader - Daymar',
                accessibility: 'Easy',
                resources: [
                    { name: 'Hadanite', symbol: 'Hada', percentage: 16.8, price: 22.0, sellLocations: ['Port Olisar', 'Grim HEX', 'Area18 TDD'] },
                    { name: 'Dolivine', symbol: 'Doli', percentage: 13.2, price: 6.2, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] },
                    { name: 'Aphorite', symbol: 'Apho', percentage: 11.5, price: 4.8, sellLocations: ['Port Olisar', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 10.3, price: 36.0, sellLocations: ['Area18 TDD', 'New Babbage TDD', 'Lorville CBD'] },
                    { name: 'Gold', symbol: 'Au', percentage: 5.2, price: 6.07, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] }
                ],
                notes: 'Popular beginner location. Near Crusader. Stable conditions.'
            },
            'yela': {
                name: 'Yela',
                system: 'Stanton',
                body: 'Crusader - Yela',
                accessibility: 'Easy',
                resources: [
                    { name: 'Quantainium', symbol: 'Quan', percentage: 8.5, price: 88.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 14.2, price: 36.0, sellLocations: ['Area18 TDD', 'New Babbage TDD', 'Lorville CBD'] },
                    { name: 'Taranite', symbol: 'Tara', percentage: 12.8, price: 5.82, sellLocations: ['Port Olisar', 'Area18 TDD', 'Lorville CBD'] },
                    { name: 'Agricium', symbol: 'Agri', percentage: 9.3, price: 25.5, sellLocations: ['Lorville CBD', 'Area18 TDD', 'Port Olisar'] },
                    { name: 'Titanium', symbol: 'Ti', percentage: 8.1, price: 8.04, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] }
                ],
                notes: 'Ice caves contain valuable Quantainium. Cold environment. Aaron Halo proximity.'
            },
            'lyria': {
                name: 'Lyria',
                system: 'Stanton',
                body: 'ArcCorp - Lyria',
                accessibility: 'Moderate',
                resources: [
                    { name: 'Quantainium', symbol: 'Quan', percentage: 12.1, price: 88.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 15.8, price: 36.0, sellLocations: ['Area18 TDD', 'New Babbage TDD', 'Lorville CBD'] },
                    { name: 'Gold', symbol: 'Au', percentage: 11.2, price: 6.07, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] },
                    { name: 'Copper', symbol: 'Cu', percentage: 10.5, price: 5.76, sellLocations: ['Port Olisar', 'Area18 TDD', 'Lorville CBD'] },
                    { name: 'Laranite', symbol: 'Lara', percentage: 7.8, price: 27.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] }
                ],
                notes: 'High Quantainium deposits. Popular but competitive. Moderate difficulty.'
            },
            'wala': {
                name: 'Wala',
                system: 'Stanton',
                body: 'ArcCorp - Wala',
                accessibility: 'Easy',
                resources: [
                    { name: 'Hadanite', symbol: 'Hada', percentage: 19.2, price: 22.0, sellLocations: ['Area18 TDD', 'Port Olisar', 'Grim HEX'] },
                    { name: 'Dolivine', symbol: 'Doli', percentage: 15.6, price: 6.2, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] },
                    { name: 'Aphorite', symbol: 'Apho', percentage: 12.8, price: 4.8, sellLocations: ['Port Olisar', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Hephaestanite', symbol: 'Heph', percentage: 10.1, price: 18.0, sellLocations: ['Lorville CBD', 'Port Olisar', 'Grim HEX'] },
                    { name: 'Beryl', symbol: 'Bery', percentage: 8.3, price: 3.19, sellLocations: ['Port Olisar', 'Lorville CBD', 'Grim HEX'] }
                ],
                notes: 'Excellent for hand mining Hadanite. Safe environment. Near ArcCorp.'
            },
            'aaron halo': {
                name: 'Aaron Halo',
                system: 'Stanton',
                body: 'Asteroid Belt',
                accessibility: 'Difficult',
                environment: 'Asteroid field',
                resources: [
                    { name: 'Quantainium', symbol: 'Quan', percentage: 22.5, price: 88.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 18.3, price: 36.0, sellLocations: ['Area18 TDD', 'New Babbage TDD', 'Lorville CBD'] },
                    { name: 'Borase', symbol: 'Bora', percentage: 14.2, price: 41.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Laranite', symbol: 'Lara', percentage: 12.7, price: 27.0, sellLocations: ['Area18 TDD', 'Lorville CBD', 'New Babbage TDD'] },
                    { name: 'Taranite', symbol: 'Tara', percentage: 10.8, price: 5.82, sellLocations: ['Port Olisar', 'Area18 TDD', 'Lorville CBD'] }
                ],
                notes: 'Highest Quantainium concentration. Requires experienced miners. Zero-G mining. Pirate risk.'
            },
            'pyro': {
                name: 'Pyro System',
                system: 'Pyro',
                accessibility: 'Extreme',
                environment: 'High risk lawless system',
                resources: [
                    { name: 'Quantainium', symbol: 'Quan', percentage: 28.0, price: 88.0, sellLocations: ['Ruin Station', 'Pyro Gateway'] },
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 20.5, price: 36.0, sellLocations: ['Ruin Station', 'Pyro Gateway'] },
                    { name: 'Borase', symbol: 'Bora', percentage: 17.2, price: 41.0, sellLocations: ['Ruin Station', 'Pyro Gateway'] },
                    { name: 'Laranite', symbol: 'Lara', percentage: 15.1, price: 27.0, sellLocations: ['Ruin Station', 'Pyro Gateway'] },
                    { name: 'Gold', symbol: 'Au', percentage: 8.9, price: 6.07, sellLocations: ['Ruin Station', 'Pyro Gateway'] }
                ],
                notes: '⚠️ EXTREME RISK: Lawless system. High pirate activity. Escort recommended. Highest profit potential.'
            },
            'calliope': {
                name: 'Calliope',
                system: 'Stanton',
                body: 'MicroTech - Calliope',
                accessibility: 'Moderate',
                resources: [
                    { name: 'Agricium', symbol: 'Agri', percentage: 14.2, price: 25.5, sellLocations: ['New Babbage TDD', 'Port Tressler', 'Area18 TDD'] },
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 12.8, price: 36.0, sellLocations: ['New Babbage TDD', 'Area18 TDD', 'Lorville CBD'] },
                    { name: 'Titanium', symbol: 'Ti', percentage: 11.5, price: 8.04, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] },
                    { name: 'Laranite', symbol: 'Lara', percentage: 9.8, price: 27.0, sellLocations: ['New Babbage TDD', 'Area18 TDD', 'Lorville CBD'] },
                    { name: 'Gold', symbol: 'Au', percentage: 7.2, price: 6.07, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] }
                ],
                notes: 'Cold moon with moderate mining conditions. Good for Agricium. Near MicroTech.'
            },
            'clio': {
                name: 'Clio',
                system: 'Stanton',
                body: 'MicroTech - Clio',
                accessibility: 'Moderate',
                resources: [
                    { name: 'Quantainium', symbol: 'Quan', percentage: 10.5, price: 88.0, sellLocations: ['New Babbage TDD', 'Area18 TDD', 'Lorville CBD'] },
                    { name: 'Hephaestanite', symbol: 'Heph', percentage: 13.7, price: 18.0, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Grim HEX'] },
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 11.2, price: 36.0, sellLocations: ['New Babbage TDD', 'Area18 TDD', 'Lorville CBD'] },
                    { name: 'Copper', symbol: 'Cu', percentage: 9.8, price: 5.76, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] },
                    { name: 'Beryl', symbol: 'Bery', percentage: 8.5, price: 3.19, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] }
                ],
                notes: 'Frozen moon with Quantainium deposits. Harsh cold environment. Experienced miners recommended.'
            },
            'euterpe': {
                name: 'Euterpe',
                system: 'Stanton',
                body: 'MicroTech - Euterpe',
                accessibility: 'Easy',
                resources: [
                    { name: 'Hadanite', symbol: 'Hada', percentage: 15.3, price: 22.0, sellLocations: ['New Babbage TDD', 'Port Tressler', 'Grim HEX'] },
                    { name: 'Dolivine', symbol: 'Doli', percentage: 14.1, price: 6.2, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] },
                    { name: 'Aphorite', symbol: 'Apho', percentage: 12.5, price: 4.8, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] },
                    { name: 'Gold', symbol: 'Au', percentage: 8.9, price: 6.07, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] },
                    { name: 'Titanium', symbol: 'Ti', percentage: 7.3, price: 8.04, sellLocations: ['Port Tressler', 'New Babbage TDD', 'Port Olisar'] }
                ],
                notes: 'Good for hand mining Hadanite. Beginner-friendly. Close to MicroTech.'
            },
            'cellin': {
                name: 'Cellin',
                system: 'Stanton',
                body: 'Crusader - Cellin',
                accessibility: 'Easy',
                resources: [
                    { name: 'Bexalite', symbol: 'Bexa', percentage: 13.8, price: 36.0, sellLocations: ['Port Olisar', 'Area18 TDD', 'New Babbage TDD'] },
                    { name: 'Taranite', symbol: 'Tara', percentage: 11.5, price: 5.82, sellLocations: ['Port Olisar', 'Area18 TDD', 'Lorville CBD'] },
                    { name: 'Titanium', symbol: 'Ti', percentage: 10.2, price: 8.04, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] },
                    { name: 'Agricium', symbol: 'Agri', percentage: 8.7, price: 25.5, sellLocations: ['Lorville CBD', 'Area18 TDD', 'Port Olisar'] },
                    { name: 'Gold', symbol: 'Au', percentage: 6.4, price: 6.07, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] }
                ],
                notes: 'Active volcanism. Watch for lava. Good beginner location near Crusader.'
            },
            'magda': {
                name: 'Magda',
                system: 'Stanton',
                body: 'Hurston - Magda',
                accessibility: 'Moderate',
                resources: [
                    { name: 'Hephaestanite', symbol: 'Heph', percentage: 16.5, price: 18.0, sellLocations: ['Lorville CBD', 'Port Olisar', 'Grim HEX'] },
                    { name: 'Titanium', symbol: 'Ti', percentage: 13.2, price: 8.04, sellLocations: ['Port Olisar', 'Lorville CBD', 'Area18 TDD'] },
                    { name: 'Agricium', symbol: 'Agri', percentage: 11.8, price: 25.5, sellLocations: ['Lorville CBD', 'Area18 TDD', 'Port Olisar'] },
                    { name: 'Beryl', symbol: 'Bery', percentage: 9.5, price: 3.19, sellLocations: ['Port Olisar', 'Lorville CBD', 'Grim HEX'] },
                    { name: 'Laranite', symbol: 'Lara', percentage: 7.8, price: 27.0, sellLocations: ['Lorville CBD', 'Area18 TDD', 'New Babbage TDD'] }
                ],
                notes: 'Rocky terrain with good Hephaestanite deposits. Moderate difficulty. Near Hurston.'
            }
        };
        const key = locationName.toLowerCase().trim();
        return miningDatabase[key] || null;
    }
    static ALL_LOCATIONS = [
        'arial', 'aberdeen', 'daymar', 'yela', 'lyria', 'wala', 'aaron halo', 'pyro',
        'calliope', 'clio', 'euterpe', 'cellin', 'magda'
    ];
    static async searchByResource(resourceName) {
        const locations = [];
        for (const loc of this.ALL_LOCATIONS) {
            const data = await this.getMiningData(loc);
            if (data) {
                const hasResource = data.resources.some(r => r.name.toLowerCase().includes(resourceName.toLowerCase()) ||
                    r.symbol.toLowerCase().includes(resourceName.toLowerCase()));
                if (hasResource) {
                    locations.push(data);
                }
            }
        }
        return locations;
    }
    static async getAllLocations() {
        const locations = [];
        for (const loc of this.ALL_LOCATIONS) {
            const data = await this.getMiningData(loc);
            if (data) {
                locations.push(data);
            }
        }
        return locations;
    }
    static clearCache() {
        this.cache.clear();
        logger_1.logger.info('RegolithService cache cleared');
    }
}
exports.RegolithService = RegolithService;
//# sourceMappingURL=RegolithService.js.map