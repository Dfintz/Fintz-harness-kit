import axios from 'axios';
import * as cheerio from 'cheerio';
import { schedule, ScheduledTask } from 'node-cron';

import type {
  ClassLocationData,
  CommodityPrice,
  GemData,
  MarketData,
  OreData,
  RefineryData,
  RefineryMethod,
  RegolithCachedData,
  RegolithFetchStatus,
  RockClassData,
} from '../services/content/RegolithDataTypes';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

/**
 * Regolith Data Fetcher Job
 *
 * Fetches mining data from regolith.rocks tables on a schedule.
 * Updates the cached data used by RegolithService.
 *
 * Data Sources:
 * - /survey/ores - Ore types and properties
 * - /survey/rock_class - Rock classifications
 * - /survey/class_location - Location-specific rock class distribution
 * - /survey/gems - Gem types and locations
 * - /tables/refinery - Refinery locations and methods
 * - /tables/market - Market prices and locations
 *
 * Schedule: Every 6 hours (0 0,6,12,18 * * *)
 */
export class RegolithDataFetcher {
  private static readonly BASE_URL = 'https://regolith.rocks';
  private static readonly FETCH_TIMEOUT = 30000; // 30 seconds
  private static readonly USER_AGENT = 'SC-Fleet-Manager/1.0 (Mining Data Integration)';
  private static readonly MIN_RESPONSE_LENGTH = 50; // Minimum length for valid HTML response

  // Default refinery method values
  private static readonly DEFAULT_REFINERY_DURATION = 3600; // 1 hour in seconds
  private static readonly DEFAULT_REFINERY_EFFICIENCY = 95; // percentage
  private static readonly DEFAULT_REFINERY_COST = 5; // aUEC per unit

  private static cachedData: RegolithCachedData | null = null;
  private static fetchStatuses: RegolithFetchStatus[] = [];
  private static isFetching = false;
  private static scheduledTask: ScheduledTask | null = null;
  private static initialFetchTimeout: NodeJS.Timeout | null = null;

  private static isExternalFetchesDisabled(): boolean {
    const flag = process.env.DISABLE_EXTERNAL_FETCHES;
    return flag === '1' || flag === 'true';
  }

  private static isTestRuntime(): boolean {
    return process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
  }

  /**
   * Data source URLs
   */
  private static readonly DATA_SOURCES = {
    ores: '/survey/ores',
    rockClass: '/survey/rock_class',
    classLocation: '/survey/class_location',
    gems: '/survey/gems',
    refinery: '/tables/refinery',
    market: '/tables/market',
  };

  /**
   * Get the cached Regolith data
   */
  static getCachedData(): RegolithCachedData | null {
    return this.cachedData;
  }

  /**
   * Get fetch status for all sources
   */
  static getFetchStatuses(): RegolithFetchStatus[] {
    return this.fetchStatuses;
  }

  /**
   * Check if data is currently being fetched
   */
  static isCurrentlyFetching(): boolean {
    return this.isFetching;
  }

  /**
   * Check if cached data is stale (older than 12 hours)
   */
  static isDataStale(): boolean {
    if (!this.cachedData) {
      return true;
    }
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    return this.cachedData.lastUpdated < twelveHoursAgo;
  }

  /**
   * Execute the data fetch job
   */
  static async execute(): Promise<void> {
    if (this.isExternalFetchesDisabled() || this.isTestRuntime()) {
      logger.info('Skipping Regolith data fetch (external fetch disabled or test runtime)', {
        disableExternalFetches: this.isExternalFetchesDisabled(),
        isTestRuntime: this.isTestRuntime(),
      });
      return;
    }

    if (this.isFetching) {
      logger.warn('Regolith data fetch already in progress, skipping...');
      return;
    }

    this.isFetching = true;
    const startTime = Date.now();
    logger.info('Starting Regolith data fetch job...');

    try {
      const [ores, rockClasses, classLocations, gems, refineries, markets] =
        await Promise.allSettled([
          this.fetchOres(),
          this.fetchRockClasses(),
          this.fetchClassLocations(),
          this.fetchGems(),
          this.fetchRefineries(),
          this.fetchMarkets(),
        ]);

      // Update cached data with successful fetches
      this.cachedData = {
        lastUpdated: new Date(),
        ores: ores.status === 'fulfilled' ? ores.value : this.cachedData?.ores || [],
        rockClasses:
          rockClasses.status === 'fulfilled'
            ? rockClasses.value
            : this.cachedData?.rockClasses || [],
        classLocations:
          classLocations.status === 'fulfilled'
            ? classLocations.value
            : this.cachedData?.classLocations || [],
        gems: gems.status === 'fulfilled' ? gems.value : this.cachedData?.gems || [],
        refineries:
          refineries.status === 'fulfilled' ? refineries.value : this.cachedData?.refineries || [],
        markets: markets.status === 'fulfilled' ? markets.value : this.cachedData?.markets || [],
      };

      const duration = Date.now() - startTime;
      const successCount = this.fetchStatuses.filter(s => s.success).length;

      logger.info(`Regolith data fetch completed in ${duration}ms`, {
        successCount,
        totalSources: this.fetchStatuses.length,
        oresCount: this.cachedData.ores.length,
        locationsCount: this.cachedData.classLocations.length,
        marketsCount: this.cachedData.markets.length,
      });
    } catch (error) {
      logger.error('Error during Regolith data fetch:', error);
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Fetch ore data from /survey/ores
   */
  private static async fetchOres(): Promise<OreData[]> {
    const url = `${this.BASE_URL}${this.DATA_SOURCES.ores}`;
    const status: RegolithFetchStatus = {
      source: 'ores',
      url,
      success: false,
      lastFetch: new Date(),
      recordCount: 0,
    };

    try {
      const response = await axios.get(url, {
        timeout: this.FETCH_TIMEOUT,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      // Validate response
      if (
        !this.validateResponse(
          { headers: response.headers as Record<string, string>, data: response.data },
          url,
          'ores'
        )
      ) {
        throw new Error('Invalid response format from data source');
      }

      const $ = cheerio.load(response.data);
      const ores: OreData[] = [];

      // Parse table rows - adjust selectors based on actual page structure
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

      logger.info(`Fetched ${ores.length} ores from regolith.rocks`);
      return ores;
    } catch (error: unknown) {
      status.error = getErrorMessage(error);
      this.updateFetchStatus(status);
      logger.error('Failed to fetch ores:', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Fetch rock class data from /survey/rock_class
   */
  private static async fetchRockClasses(): Promise<RockClassData[]> {
    const url = `${this.BASE_URL}${this.DATA_SOURCES.rockClass}`;
    const status: RegolithFetchStatus = {
      source: 'rockClass',
      url,
      success: false,
      lastFetch: new Date(),
      recordCount: 0,
    };

    try {
      const response = await axios.get(url, {
        timeout: this.FETCH_TIMEOUT,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      // Validate response
      if (
        !this.validateResponse(
          { headers: response.headers as Record<string, string>, data: response.data },
          url,
          'rockClass'
        )
      ) {
        throw new Error('Invalid response format from data source');
      }

      const $ = cheerio.load(response.data);
      const rockClasses: RockClassData[] = [];

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

      logger.info(`Fetched ${rockClasses.length} rock classes from regolith.rocks`);
      return rockClasses;
    } catch (error: unknown) {
      status.error = getErrorMessage(error);
      this.updateFetchStatus(status);
      logger.error('Failed to fetch rock classes:', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Fetch class location data from /survey/class_location
   */
  private static async fetchClassLocations(): Promise<ClassLocationData[]> {
    const url = `${this.BASE_URL}${this.DATA_SOURCES.classLocation}`;
    const status: RegolithFetchStatus = {
      source: 'classLocation',
      url,
      success: false,
      lastFetch: new Date(),
      recordCount: 0,
    };

    try {
      const response = await axios.get(url, {
        timeout: this.FETCH_TIMEOUT,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      // Validate response
      if (
        !this.validateResponse(
          { headers: response.headers as Record<string, string>, data: response.data },
          url,
          'classLocation'
        )
      ) {
        throw new Error('Invalid response format from data source');
      }

      const $ = cheerio.load(response.data);
      const classLocations: ClassLocationData[] = [];

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

          // Parse ore percentages if available
          const orePercentages: Record<string, number> = {};
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

      logger.info(`Fetched ${classLocations.length} class locations from regolith.rocks`);
      return classLocations;
    } catch (error: unknown) {
      status.error = getErrorMessage(error);
      this.updateFetchStatus(status);
      logger.error('Failed to fetch class locations:', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Fetch gem data from /survey/gems
   */
  private static async fetchGems(): Promise<GemData[]> {
    const url = `${this.BASE_URL}${this.DATA_SOURCES.gems}`;
    const status: RegolithFetchStatus = {
      source: 'gems',
      url,
      success: false,
      lastFetch: new Date(),
      recordCount: 0,
    };

    try {
      const response = await axios.get(url, {
        timeout: this.FETCH_TIMEOUT,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      // Validate response
      if (
        !this.validateResponse(
          { headers: response.headers as Record<string, string>, data: response.data },
          url,
          'gems'
        )
      ) {
        throw new Error('Invalid response format from data source');
      }

      const $ = cheerio.load(response.data);
      const gems: GemData[] = [];

      $('table tbody tr').each((_index, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const name = $(cells[0]).text().trim();
          const symbol =
            cells.length >= 2 ? $(cells[1]).text().trim() : name.substring(0, 4).toUpperCase();
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

      logger.info(`Fetched ${gems.length} gems from regolith.rocks`);
      return gems;
    } catch (error: unknown) {
      status.error = getErrorMessage(error);
      this.updateFetchStatus(status);
      logger.error('Failed to fetch gems:', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Fetch refinery data from /tables/refinery
   */
  private static async fetchRefineries(): Promise<RefineryData[]> {
    const url = `${this.BASE_URL}${this.DATA_SOURCES.refinery}`;
    const status: RegolithFetchStatus = {
      source: 'refinery',
      url,
      success: false,
      lastFetch: new Date(),
      recordCount: 0,
    };

    try {
      const response = await axios.get(url, {
        timeout: this.FETCH_TIMEOUT,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      // Validate response
      if (
        !this.validateResponse(
          { headers: response.headers as Record<string, string>, data: response.data },
          url,
          'refinery'
        )
      ) {
        throw new Error('Invalid response format from data source');
      }

      const $ = cheerio.load(response.data);
      const refineries: RefineryData[] = [];

      $('table tbody tr').each((_index, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const name = $(cells[0]).text().trim();
          const location = $(cells[1]).text().trim();
          const system = cells.length >= 3 ? $(cells[2]).text().trim() : 'Stanton';

          // Parse refinery methods
          const methods: RefineryMethod[] = [];
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

      logger.info(`Fetched ${refineries.length} refineries from regolith.rocks`);
      return refineries;
    } catch (error: unknown) {
      status.error = getErrorMessage(error);
      this.updateFetchStatus(status);
      logger.error('Failed to fetch refineries:', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Fetch market data from /tables/market
   */
  private static async fetchMarkets(): Promise<MarketData[]> {
    const url = `${this.BASE_URL}${this.DATA_SOURCES.market}`;
    const status: RegolithFetchStatus = {
      source: 'market',
      url,
      success: false,
      lastFetch: new Date(),
      recordCount: 0,
    };

    try {
      const response = await axios.get(url, {
        timeout: this.FETCH_TIMEOUT,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      // Validate response
      if (
        !this.validateResponse(
          { headers: response.headers as Record<string, string>, data: response.data },
          url,
          'market'
        )
      ) {
        throw new Error('Invalid response format from data source');
      }

      const $ = cheerio.load(response.data);
      const markets: MarketData[] = [];

      $('table tbody tr').each((_index, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const location = $(cells[0]).text().trim();
          const system = cells.length >= 2 ? $(cells[1]).text().trim() : 'Stanton';
          const typeText = cells.length >= 3 ? $(cells[2]).text().trim().toLowerCase() : 'both';
          const type: 'buy' | 'sell' | 'both' =
            typeText.includes('buy') && typeText.includes('sell')
              ? 'both'
              : typeText.includes('buy')
                ? 'buy'
                : typeText.includes('sell')
                  ? 'sell'
                  : 'both';

          // Parse commodities
          const commodities: CommodityPrice[] = [];
          const commoditiesText = cells.length >= 4 ? $(cells[3]).text().trim() : '';

          // Simple parsing - in reality would need more sophisticated parsing
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

      logger.info(`Fetched ${markets.length} markets from regolith.rocks`);
      return markets;
    } catch (error: unknown) {
      status.error = getErrorMessage(error);
      this.updateFetchStatus(status);
      logger.error('Failed to fetch markets:', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Update fetch status for a source
   */
  private static updateFetchStatus(status: RegolithFetchStatus): void {
    const existingIndex = this.fetchStatuses.findIndex(s => s.source === status.source);
    if (existingIndex >= 0) {
      this.fetchStatuses[existingIndex] = status;
    } else {
      this.fetchStatuses.push(status);
    }
  }

  /**
   * Validate that response contains expected HTML table structure and not an error page
   */
  private static validateResponse(
    response: { headers: Record<string, string>; data: unknown },
    url: string,
    source: string
  ): boolean {
    const contentType = response.headers['content-type'] || '';
    const responseText = String(response.data || '').trim();
    const responseTextLower = responseText.toLowerCase();

    // Check if we got any data
    if (!responseText || responseText.length < this.MIN_RESPONSE_LENGTH) {
      logger.warn(`Received empty response from ${url}`, { source });
      return false;
    }

    // Check if response looks like an error page (DOCTYPE but no table)
    if (responseTextLower.includes('<!doctype') && !responseTextLower.includes('<table')) {
      logger.warn(`Received HTML page without table data from ${url}`, {
        source,
        contentType,
        responsePreview: responseText.substring(0, 200),
      });
      return false;
    }

    // Check if we have a table element (expected data structure)
    if (!responseTextLower.includes('<table') && !responseTextLower.includes('<tbody')) {
      logger.warn(`No table structure found in response from ${url}`, {
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

  /**
   * Force a manual refresh of all data
   */
  static async forceRefresh(): Promise<void> {
    logger.info('Forcing manual Regolith data refresh...');
    await this.execute();
  }

  /**
   * Clear cached data
   */
  static clearCache(): void {
    this.cachedData = null;
    this.fetchStatuses = [];
    logger.info('Regolith data cache cleared');
  }

  /**
   * Schedule the data fetch job
   * Runs every 6 hours: 0 0,6,12,18 * * *
   */
  static schedule(): void {
    if (this.scheduledTask) {
      logger.warn('Regolith data fetch job already scheduled');
      return;
    }

    // Schedule: Every 6 hours at minute 0
    this.scheduledTask = schedule(
      '0 0,6,12,18 * * *',
      async () => {
        try {
          await this.execute();
        } catch (error) {
          logger.error('Scheduled Regolith data fetch failed:', error);
        }
      },
      {
        timezone: 'UTC',
        name: 'regolith-data-fetch',
      }
    );

    // Start the scheduled task
    void this.scheduledTask.start();

    logger.info(
      'Regolith data fetch job scheduled (every 6 hours at 00:00, 06:00, 12:00, 18:00 UTC)'
    );

    // Run initial fetch after a short delay (30 seconds) to allow server startup
    this.initialFetchTimeout = setTimeout(() => {
      void (async () => {
        try {
          logger.info('Running initial Regolith data fetch...');
          await this.execute();
        } catch (error) {
          logger.error('Initial Regolith data fetch failed:', error);
        } finally {
          this.initialFetchTimeout = null;
        }
      })();
    }, 30000);
    this.initialFetchTimeout.unref();
  }

  /**
   * Stop the scheduled job
   */
  static stop(): void {
    if (this.initialFetchTimeout) {
      clearTimeout(this.initialFetchTimeout);
      this.initialFetchTimeout = null;
    }

    if (this.scheduledTask) {
      void this.scheduledTask.stop();
      this.scheduledTask = null;
      logger.info('Regolith data fetch job stopped');
    }
  }
}
