import { RegolithDataFetcher } from '../../jobs/regolithDataFetcher';
import { logger } from '../../utils/logger';

import type { RegolithCachedData, RegolithFetchStatus } from './RegolithDataTypes';

export interface MiningLocation {
    name: string;
    system: string;
    body?: string;
    coordinates?: string;
    resources: MineralResource[];
    accessibility: 'Easy' | 'Moderate' | 'Difficult' | 'Extreme';
    environment?: string;
    notes?: string;
}

export interface MineralResource {
    name: string;
    symbol: string;
    percentage: number;
    quality?: string;
    price?: number;
    sellLocations?: string[];
}

export interface MiningDataSummary {
    location: string;
    system: string;
    totalResources: number;
    topResources: Array<{
        name: string;
        symbol: string;
        percentage: number;
        estimatedValue?: number;
        price?: number;
        sellLocations?: string[];
    }>;
    accessibility: string;
    recommendedShips: string[];
    estimatedProfitPerHour?: number;
    notes: string;
}

/**
 * Service for fetching and processing mining data from regolith.rocks
 * 
 * Data is fetched on a schedule from:
 * - /survey/ores - Ore types and properties
 * - /survey/rock_class - Rock classifications
 * - /survey/class_location - Location-specific rock class distribution
 * - /survey/gems - Gem types and locations
 * - /tables/refinery - Refinery locations and methods
 * - /tables/market - Market prices and locations
 */
export class RegolithService {
    private static readonly REGOLITH_BASE_URL = 'https://regolith.rocks';
    private static readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds
    private static cache: Map<string, { data: unknown; timestamp: number }> = new Map();

    /**
     * Convert a value to a numeric percentage, handling various input types
     */
    private static toPercentage(value: unknown): number {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            return parseFloat(value) || 0;
        }
        return 0;
    }

    /**
     * Get mining data for a specific location
     * First tries to use live data from regolith.rocks, falls back to static data
     */
    static async getMiningData(locationName: string): Promise<MiningLocation | null> {
        try {
            const cacheKey = `mining_${locationName.toLowerCase()}`;
            const cached = this.cache.get(cacheKey);

            // Return cached data if still valid
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.data as MiningLocation | null;
            }

            // Try to get data from scheduled fetch first
            let miningData = await this.getLiveMiningData(locationName);
            
            // Fall back to static data if live data not available
            if (!miningData) {
                miningData = await this.getFallbackMiningData(locationName);
            }

            if (miningData) {
                this.cache.set(cacheKey, { data: miningData, timestamp: Date.now() });
            }

            return miningData;
        } catch (error: unknown) {
            logger.error('Error fetching mining data:', error);
            return null;
        }
    }

    /**
     * Get mining data from live regolith.rocks data (fetched on schedule)
     */
    private static async getLiveMiningData(locationName: string): Promise<MiningLocation | null> {
        const cachedData = RegolithDataFetcher.getCachedData();
        if (!cachedData || cachedData.classLocations.length === 0) {
            return null;
        }

        const normalizedName = locationName.toLowerCase().trim();
        
        // Find matching location in fetched data
        const locationData = cachedData.classLocations.find(
            loc => loc.location.toLowerCase() === normalizedName ||
                   loc.body?.toLowerCase().includes(normalizedName)
        );

        if (!locationData) {
            return null;
        }

        // Build resources from ore data and percentages
        const resources: MineralResource[] = [];
        
        // Get ore percentages from location data
        Object.entries(locationData.orePercentages).forEach(([oreName, pct]) => {
            const percentage = this.toPercentage(pct);
            const oreData = cachedData.ores.find(
                o => o.name.toLowerCase() === oreName.toLowerCase() ||
                     o.symbol.toLowerCase() === oreName.toLowerCase()
            );

            // Find sell locations from market data
            const sellLocations = cachedData.markets
                .filter(m => m.type !== 'buy' && m.commodities.some(
                    c => c.name.toLowerCase() === oreName.toLowerCase()
                ))
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

        // Add gem data if available
        const gemsForLocation = cachedData.gems.filter(
            g => g.locations.some(l => l.toLowerCase().includes(normalizedName))
        );
        gemsForLocation.forEach(gem => {
            if (!resources.find(r => r.name.toLowerCase() === gem.name.toLowerCase())) {
                resources.push({
                    name: gem.name,
                    symbol: gem.symbol,
                    percentage: 5, // Default percentage for gems
                    price: gem.basePrice,
                    sellLocations: gem.locations.slice(0, 3)
                });
            }
        });

        // Sort by percentage descending
        resources.sort((a, b) => b.percentage - a.percentage);

        // Determine accessibility based on rock classes
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

    /**
     * Determine accessibility based on rock classes and system
     */
    private static determineAccessibility(rockClasses: string[], system: string): 'Easy' | 'Moderate' | 'Difficult' | 'Extreme' {
        // Pyro system is always extreme
        if (system.toLowerCase() === 'pyro') {
            return 'Extreme';
        }

        // Check for difficult rock classes
        const hasQuantaniumRocks = rockClasses.some(rc => 
            rc.toLowerCase().includes('quantanium') || rc.toLowerCase().includes('unstable')
        );
        
        if (hasQuantaniumRocks) {
            return 'Difficult';
        }

        // Asteroid belts are difficult
        if (rockClasses.some(rc => rc.toLowerCase().includes('asteroid') || rc.toLowerCase().includes('belt'))) {
            return 'Difficult';
        }

        // Check for moderate indicators
        const hasModerateIndicators = rockClasses.some(rc =>
            rc.toLowerCase().includes('volcanic') || 
            rc.toLowerCase().includes('toxic') ||
            rc.toLowerCase().includes('hazardous')
        );

        if (hasModerateIndicators) {
            return 'Moderate';
        }

        return 'Easy';
    }

    /**
     * Get the current Regolith data fetch status
     */
    static getDataFetchStatus(): { 
        hasLiveData: boolean; 
        lastUpdated: Date | null; 
        sources: RegolithFetchStatus[];
        isStale: boolean;
    } {
        const cachedData = RegolithDataFetcher.getCachedData();
        return {
            hasLiveData: cachedData !== null && cachedData.classLocations.length > 0,
            lastUpdated: cachedData?.lastUpdated || null,
            sources: RegolithDataFetcher.getFetchStatuses(),
            isStale: RegolithDataFetcher.isDataStale()
        };
    }

    /**
     * Force refresh of Regolith data
     */
    static async forceDataRefresh(): Promise<void> {
        await RegolithDataFetcher.forceRefresh();
        this.clearCache();
    }

    /**
     * Get all locations from live data
     */
    static async getAllLiveLocations(): Promise<string[]> {
        const cachedData = RegolithDataFetcher.getCachedData();
        if (!cachedData) {
            return [];
        }
        return cachedData.classLocations.map(loc => loc.location);
    }

    /**
     * Get refinery data
     */
    static getRefineriesData(): RegolithCachedData['refineries'] {
        const cachedData = RegolithDataFetcher.getCachedData();
        return cachedData?.refineries || [];
    }

    /**
     * Get market data
     */
    static getMarketsData(): RegolithCachedData['markets'] {
        const cachedData = RegolithDataFetcher.getCachedData();
        return cachedData?.markets || [];
    }

    /**
     * Get gems data
     */
    static getGemsData(): RegolithCachedData['gems'] {
        const cachedData = RegolithDataFetcher.getCachedData();
        return cachedData?.gems || [];
    }

    /**
     * Start the scheduled data fetch job
     */
    static startScheduledFetch(): void {
        RegolithDataFetcher.schedule();
    }

    /**
     * Stop the scheduled data fetch job
     */
    static stopScheduledFetch(): void {
        RegolithDataFetcher.stop();
    }

    /**
     * Generate formatted mining description for activity
     */
    static async generateMiningDescription(location: string, systemLocation?: string): Promise<string> {
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
        } catch (error: unknown) {
            logger.error('Error generating mining description:', error);
            return '';
        }
    }

    /**
     * Get mining summary for quick display
     */
    static async getMiningDataSummary(location: string): Promise<MiningDataSummary | null> {
        const miningData = await this.getMiningData(location);
        if (!miningData) {return null;}

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

    /**
     * Recommend mining ships based on accessibility and resources
     */
    private static getRecommendedMiningShips(accessibility: string): string[] {
        const recommendations: Record<string, string[]> = {
            'Easy': ['MISC Prospector', 'ARGO Mole', 'Greycat ROC'],
            'Moderate': ['MISC Prospector', 'ARGO Mole', 'Aegis Vulture'],
            'Difficult': ['ARGO Mole', 'Orion (when available)', 'Aegis Vulture'],
            'Extreme': ['ARGO Mole', 'Orion (when available)', 'RSI Constellation (support)']
        };

        return recommendations[accessibility] || recommendations['Easy'];
    }

    /**
     * Estimate profit per hour based on resources
     */
    private static estimateProfitPerHour(resources: MineralResource[]): number {
        // Average mining efficiency: 10 SCU per hour for Prospector
        // ARGO Mole: 30 SCU per hour (3 miners)
        const avgSCUPerHour = 20; // Middle ground

        const weightedValue = resources.reduce((sum, resource) => {
            const value = resource.price || 0;
            const weight = resource.percentage / 100;
            return sum + (value * weight);
        }, 0);

        return Math.round(weightedValue * avgSCUPerHour);
    }

    /**
     * Fallback mining data (community-sourced until API available)
     * Data structure based on regolith.rocks format
     */
    private static async getFallbackMiningData(locationName: string): Promise<MiningLocation | null> {
        const miningDatabase: Record<string, MiningLocation> = {
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
            // MicroTech Moons
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
            // Crusader Moons
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

    /**
     * List of all available mining location keys
     */
    private static readonly ALL_LOCATIONS = [
        'arial', 'aberdeen', 'daymar', 'yela', 'lyria', 'wala', 'aaron halo', 'pyro',
        'calliope', 'clio', 'euterpe', 'cellin', 'magda'
    ];

    /**
     * Search mining locations by resource
     */
    static async searchByResource(resourceName: string): Promise<MiningLocation[]> {
        const locations: MiningLocation[] = [];

        for (const loc of this.ALL_LOCATIONS) {
            const data = await this.getMiningData(loc);
            if (data) {
                const hasResource = data.resources.some(r => 
                    r.name.toLowerCase().includes(resourceName.toLowerCase()) ||
                    r.symbol.toLowerCase().includes(resourceName.toLowerCase())
                );
                if (hasResource) {
                    locations.push(data);
                }
            }
        }

        return locations;
    }

    /**
     * Get all available mining locations
     */
    static async getAllLocations(): Promise<MiningLocation[]> {
        const locations: MiningLocation[] = [];

        for (const loc of this.ALL_LOCATIONS) {
            const data = await this.getMiningData(loc);
            if (data) {
                locations.push(data);
            }
        }

        return locations;
    }

    /**
     * Clear cache (for testing or manual refresh)
     */
    static clearCache(): void {
        this.cache.clear();
        logger.info('RegolithService cache cleared');
    }
}

