/* eslint-disable @typescript-eslint/no-unsafe-argument -- CSV parsing produces untyped records */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { schedule, ScheduledTask } from 'node-cron';
import { IsNull } from 'typeorm';

import { trackEvent, trackMetric } from '../config/applicationInsights';
import { AppDataSource } from '../config/database';
import { Ship, ShipDataSource, ShipSize, ShipStatus } from '../models/Ship';
import { ErkulGamesService } from '../services/external/ErkulGamesService';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

/**
 * Raw ship data from Erkul.games API
 */
interface ErkulShipData {
  name?: string;
  manufacturer?: string;
  manufacturerCode?: string;
  description?: string;
  role?: string;
  roles?: string | string[];
  size?: string;
  status?: string;
  crew?: number | string;
  minCrew?: number | string;
  maxCrew?: number | string;
  length?: number | string;
  beam?: number | string;
  height?: number | string;
  mass?: number | string;
  cargo?: number | string;
  vehicleCargo?: number | string;
  price?: number | string;
  pledgePrice?: number | string;
  speed?: number | string;
  afterburnerSpeed?: number | string;
  quantumSpeed?: number | string;
  quantumFuelCapacity?: number | string;
  hydrogenFuelCapacity?: number | string;
  shields?: number | string;
  armor?: number | string;
  hangarSize?: string;
  loanerShip?: string;
  variants?: string | string[];
  isVehicle?: boolean;
  [key: string]: unknown;
}

/**
 * Raw CSV record from Google Sheets
 */
interface CSVRecord {
  name?: string;
  Name?: string;
  ship_name?: string;
  'Ship Name'?: string;
  manufacturer?: string;
  Manufacturer?: string;
  make?: string;
  Make?: string;
  manufacturer_code?: string;
  'Manufacturer Code'?: string;
  code?: string;
  description?: string;
  Description?: string;
  role?: string;
  Role?: string;
  focus?: string;
  Focus?: string;
  roles?: string;
  Roles?: string;
  size?: string;
  Size?: string;
  status?: string;
  Status?: string;
  crew?: number | string;
  Crew?: number | string;
  max_crew?: number | string;
  min_crew?: number | string;
  'Min Crew'?: number | string;
  minCrew?: number | string;
  'Max Crew'?: number | string;
  maxCrew?: number | string;
  length?: number | string;
  Length?: number | string;
  beam?: number | string;
  Beam?: number | string;
  width?: number | string;
  Width?: number | string;
  height?: number | string;
  Height?: number | string;
  mass?: number | string;
  Mass?: number | string;
  weight?: number | string;
  Weight?: number | string;
  cargo?: number | string;
  Cargo?: number | string;
  cargo_capacity?: number | string;
  'Cargo Capacity'?: number | string;
  vehicle_cargo?: number | string;
  'Vehicle Cargo'?: number | string;
  price?: number | string;
  Price?: number | string;
  in_game_price?: number | string;
  'In-Game Price'?: number | string;
  pledge_price?: number | string;
  'Pledge Price'?: number | string;
  pledgePrice?: number | string;
  speed?: number | string;
  Speed?: number | string;
  scm_speed?: number | string;
  'SCM Speed'?: number | string;
  afterburner_speed?: number | string;
  'Afterburner Speed'?: number | string;
  max_speed?: number | string;
  quantum_speed?: number | string;
  'Quantum Speed'?: number | string;
  quantum_fuel?: number | string;
  'Quantum Fuel'?: number | string;
  hydrogen_fuel?: number | string;
  'Hydrogen Fuel'?: number | string;
  shields?: number | string;
  Shields?: number | string;
  shield_hp?: number | string;
  armor?: number | string;
  Armor?: number | string;
  hull_hp?: number | string;
  hangar_size?: string;
  'Hangar Size'?: string;
  loaner?: string;
  Loaner?: string;
  loaner_ship?: string;
  variants?: string;
  Variants?: string;
  [key: string]: unknown;
}

/**
 * Ship and Vehicle Data Fetcher Job
 *
 * Fetches ship and vehicle data from configured URLs on a schedule.
 * Updates the ship catalog in the database.
 *
 * Data Sources (priority order):
 * 1. Erkul.games API (https://www.erkul.games/live/ships) - Primary source
 * 2. SHIP_DATA_SHEET_1: Custom Google Sheets URL (ships) - Fallback
 * 3. SHIP_DATA_SHEET_2: Custom Google Sheets URL (vehicles) - Fallback
 *
 * The URLs should be publicly accessible. For Google Sheets, use the format:
 * https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}
 *
 * Schedule: Daily at 2 AM UTC (0 2 * * *)
 */
export class ShipDataFetcher {
  private static readonly FETCH_TIMEOUT = 30000; // 30 seconds
  private static readonly USER_AGENT = 'SC-Fleet-Manager/1.0 (Ship Data Integration)';
  private static readonly MIN_CSV_RESPONSE_LENGTH = 10; // Minimum length for valid CSV data

  private static isFetching = false;
  private static scheduledTask: ScheduledTask | null = null;
  private static lastFetchStatus: {
    success: boolean;
    timestamp: Date;
    shipsProcessed: number;
    vehiclesProcessed: number;
    error?: string;
  } | null = null;

  /**
   * Get the last fetch status
   */
  static getLastFetchStatus(): typeof ShipDataFetcher.lastFetchStatus {
    return this.lastFetchStatus;
  }

  /**
   * Check if data is currently being fetched
   */
  static isCurrentlyFetching(): boolean {
    return this.isFetching;
  }

  // Legacy fallback URLs for ship and vehicle data (CSV format)
  // These are used only if Erkul.games and custom sheets are unavailable
  private static readonly FALLBACK_SHIP_URL = 'https://shipmatrix.space/';
  private static readonly FALLBACK_VEHICLE_URL = 'https://shipmatrix.space/landcraft/';

  // Bundled CSV files (last-resort if no external sources available)
  private static readonly BUNDLED_SHIP_CSV = path.join(__dirname, '..', '..', '..', 'scships.csv');
  private static readonly BUNDLED_VEHICLE_CSV = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'vehicle.csv'
  );

  // Erkul.games service instance
  private static readonly erkulService = new ErkulGamesService();

  /**
   * Load ship data from a local CSV file
   */
  static async loadFromLocalCsv(csvPath: string, isVehicle: boolean): Promise<number> {
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    if (!csvContent || csvContent.length < 10) {
      throw new Error('CSV file is empty or too small');
    }

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      cast_date: false,
    });

    logger.info(`Parsed ${String(records.length)} records from local CSV: ${csvPath}`);

    const dataSource = AppDataSource.isInitialized
      ? AppDataSource
      : await AppDataSource.initialize();
    const shipRepository = dataSource.getRepository(Ship);

    let processedCount = 0;
    for (const record of records) {
      try {
        const shipData = this.mapRecordToShip(record as CSVRecord, isVehicle, ShipDataSource.CSV);
        if (!shipData.name || !shipData.manufacturer) {
          continue;
        }
        let ship = await shipRepository.findOne({
          where: { name: shipData.name, organizationId: IsNull() },
        });
        if (ship) {
          Object.assign(ship, shipData);
          ship.updatedAt = new Date();
        } else {
          ship = shipRepository.create({
            id: randomUUID(),
            ...shipData,
            organizationId: null, // Global reference ship
            isActive: true,
          } as Partial<Ship>);
        }
        await shipRepository.save(ship);
        processedCount++;
      } catch {
        // Skip invalid records
      }
    }
    return processedCount;
  }

  /**
   * Import ship data from uploaded CSV content (admin endpoint)
   */
  static async importFromCsvContent(
    csvContent: string,
    isVehicle: boolean = false
  ): Promise<{ processed: number; total: number; errors: string[] }> {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      cast_date: false,
    });

    const dataSource = AppDataSource.isInitialized
      ? AppDataSource
      : await AppDataSource.initialize();
    const shipRepository = dataSource.getRepository(Ship);

    let processedCount = 0;
    const importErrors: string[] = [];

    for (const record of records) {
      try {
        const shipData = this.mapRecordToShip(
          record as CSVRecord,
          isVehicle,
          ShipDataSource.MANUAL
        );
        if (!shipData.name || !shipData.manufacturer) {
          continue;
        }
        let ship = await shipRepository.findOne({
          where: { name: shipData.name, organizationId: IsNull() },
        });
        if (ship) {
          Object.assign(ship, shipData);
          ship.updatedAt = new Date();
        } else {
          ship = shipRepository.create({
            id: randomUUID(),
            ...shipData,
            organizationId: null, // Global reference ship
            isActive: true,
          } as Partial<Ship>);
        }
        await shipRepository.save(ship);
        processedCount++;
      } catch (e: unknown) {
        const recName = (record as CSVRecord).name ?? (record as CSVRecord).Name ?? 'unknown';
        importErrors.push(`${recName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    return { processed: processedCount, total: records.length, errors: importErrors };
  }

  /**
   * Execute the data fetch job
   */
  static async execute(): Promise<void> {
    if (this.isFetching) {
      logger.warn('Ship data fetch already in progress, skipping...');
      return;
    }

    this.isFetching = true;
    const startTime = Date.now();
    logger.info('Starting ship and vehicle data fetch job...');

    try {
      const result = await this.fetchFromAllSources();
      const duration = Date.now() - startTime;
      const isSuccess = result.shipsProcessed > 0 || result.vehiclesProcessed > 0;

      this.lastFetchStatus = {
        success: isSuccess,
        timestamp: new Date(),
        shipsProcessed: result.shipsProcessed,
        vehiclesProcessed: result.vehiclesProcessed,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      };

      // Phase 6.2 — operational visibility via App Insights
      trackMetric('ship_sync_duration_ms', duration);
      trackMetric('ship_sync_ships_processed', result.shipsProcessed);
      trackMetric('ship_sync_vehicles_processed', result.vehiclesProcessed);
      trackMetric('ship_sync_partial_errors', result.errors.length);

      if (isSuccess) {
        trackEvent('ShipSyncCompleted', {
          durationMs: String(duration),
          shipsProcessed: String(result.shipsProcessed),
          vehiclesProcessed: String(result.vehiclesProcessed),
          partialErrors: String(result.errors.length),
        });
        logger.info(`Ship data fetch completed in ${duration}ms`, {
          shipsProcessed: result.shipsProcessed,
          vehiclesProcessed: result.vehiclesProcessed,
          errors: result.errors.length > 0 ? result.errors : undefined,
        });
      } else {
        trackEvent('ShipSyncFailed', {
          durationMs: String(duration),
          reason: 'no_records_processed',
          errors: result.errors.slice(0, 5).join('; ').slice(0, 500),
        });
        logger.error(`Ship data fetch failed after ${duration}ms`, { errors: result.errors });
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errMsg = error instanceof Error ? getErrorMessage(error) : 'Unknown error';
      logger.error('Unexpected error during ship data fetch:', error);
      this.lastFetchStatus = {
        success: false,
        timestamp: new Date(),
        shipsProcessed: 0,
        vehiclesProcessed: 0,
        error: errMsg,
      };
      trackEvent('ShipSyncFailed', {
        durationMs: String(duration),
        reason: 'unhandled_exception',
        errors: errMsg.slice(0, 500),
      });
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Fetch ship data from all sources in priority order:
   * 1. Erkul.games API (primary)
   * 2. Google Sheets CSV (configured via env vars)
   * 3. Bundled CSV files (last resort)
   */
  private static async fetchFromAllSources(): Promise<{
    shipsProcessed: number;
    vehiclesProcessed: number;
    errors: string[];
  }> {
    let shipsProcessed = 0;
    let vehiclesProcessed = 0;
    const errors: string[] = [];

    // 1. Erkul.games (primary)
    const erkulCount = await this.tryFetchErkul(errors);
    shipsProcessed += erkulCount;

    // 2. Google Sheets fallbacks
    const sheet1Count = await this.tryFetchSheet(
      process.env.SHIP_DATA_SHEET_1,
      'Sheet 1',
      false,
      errors
    );
    shipsProcessed += sheet1Count;

    const sheet2Count = await this.tryFetchSheet(
      process.env.SHIP_DATA_SHEET_2,
      'Sheet 2',
      true,
      errors
    );
    vehiclesProcessed += sheet2Count;

    // 3. Bundled CSVs (only if nothing else worked)
    if (shipsProcessed === 0 && vehiclesProcessed === 0) {
      const bundled = await this.tryFetchBundledCsvs(errors);
      shipsProcessed += bundled.ships;
      vehiclesProcessed += bundled.vehicles;
    }

    return { shipsProcessed, vehiclesProcessed, errors };
  }

  /**
   * Try fetching from Erkul.games API
   */
  private static async tryFetchErkul(errors: string[]): Promise<number> {
    try {
      logger.info('Attempting to fetch ship data from Erkul.games...');
      const erkulResult = await ShipDataFetcher.erkulService.fetchShipList();

      if (erkulResult.success && erkulResult.ships && erkulResult.ships.length > 0) {
        logger.info(`Fetched ${erkulResult.ships.length} ships from Erkul.games`);
        const processed = await this.processErkulShips(erkulResult.ships);
        logger.info(`Processed ${processed} ships from Erkul.games`);
        return processed;
      }

      const errorMsg = erkulResult.error || 'No ships returned';
      logger.warn(`Erkul.games fetch failed: ${errorMsg}`);
      errors.push(`Erkul.games: ${errorMsg}`);
      return 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? getErrorMessage(error) : 'Unknown error';
      logger.warn(`Failed to fetch from Erkul.games: ${errorMessage}`);
      errors.push(`Erkul.games: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Try fetching from a Google Sheets URL
   */
  private static async tryFetchSheet(
    url: string | undefined,
    label: string,
    isVehicle: boolean,
    errors: string[]
  ): Promise<number> {
    if (!url) {
      return 0;
    }
    try {
      logger.info(`Fetching data from ${label}...`);
      const count = await this.fetchAndUpdateShips(url, isVehicle);
      logger.info(`Processed ${count} entries from ${label}`);
      return count;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? getErrorMessage(error) : 'Unknown error';
      logger.error(`Failed to fetch from ${label}: ${errorMessage}`);
      errors.push(`${label}: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Try loading from bundled CSV files
   */
  private static async tryFetchBundledCsvs(
    errors: string[]
  ): Promise<{ ships: number; vehicles: number }> {
    logger.info('No external sources available, loading from bundled CSV files...');
    let ships = 0;
    let vehicles = 0;

    const shipExists = await fs
      .access(this.BUNDLED_SHIP_CSV)
      .then(() => true)
      .catch(() => false);
    if (shipExists) {
      try {
        ships = await this.loadFromLocalCsv(this.BUNDLED_SHIP_CSV, false);
        logger.info(`Processed ${String(ships)} ships from bundled CSV`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? getErrorMessage(error) : 'Unknown error';
        logger.error(`Failed to load bundled ship CSV: ${msg}`);
        errors.push(`Bundled CSV: ${msg}`);
      }
    }

    const vehicleExists = await fs
      .access(this.BUNDLED_VEHICLE_CSV)
      .then(() => true)
      .catch(() => false);
    if (vehicleExists) {
      try {
        vehicles = await this.loadFromLocalCsv(this.BUNDLED_VEHICLE_CSV, true);
        logger.info(`Processed ${String(vehicles)} vehicles from bundled CSV`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? getErrorMessage(error) : 'Unknown error';
        logger.error(`Failed to load bundled vehicle CSV: ${msg}`);
        errors.push(`Bundled vehicles: ${msg}`);
      }
    }

    return { ships, vehicles };
  }

  /**
   * Process ship data from Erkul.games.
   *
   * Wrapped in a single TypeORM transaction so that either every Erkul-sourced
   * row is upserted and stale rows are deactivated atomically, or no changes
   * persist at all. Stale rows (rows previously sourced from Erkul that did
   * not appear in this fetch) are soft-deleted by setting `isActive = false`
   * — scoped strictly by `dataSource = 'erkul'` to keep this from touching
   * Sheets/CSV/manual ships.
   */
  private static async processErkulShips(ships: ErkulShipData[]): Promise<number> {
    try {
      // Initialize database connection
      const dataSource = AppDataSource.isInitialized
        ? AppDataSource
        : await AppDataSource.initialize();

      return await dataSource.transaction(async em => {
        const shipRepository = em.getRepository(Ship);
        const seenIds = new Set<string>();
        let processedCount = 0;

        for (const erkulShip of ships) {
          try {
            // Map Erkul ship data to our Ship model
            const shipData = this.mapErkulShipToModel(erkulShip);

            if (!shipData.name || !shipData.manufacturer) {
              logger.debug('Skipping Erkul ship with missing name or manufacturer', erkulShip);
              continue;
            }

            // Check if ship already exists (look up by name; id is uuid, not slug)
            let ship = await shipRepository.findOne({
              where: { name: shipData.name, organizationId: IsNull() },
            });

            if (ship) {
              // Update existing ship — re-activate in case it was previously
              // soft-deleted by a prior reconciliation pass.
              Object.assign(ship, shipData);
              ship.isActive = true;
              ship.updatedAt = new Date();
            } else {
              // Create new ship
              ship = shipRepository.create({
                id: randomUUID(),
                ...shipData,
                organizationId: null, // Global reference ship
                isActive: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any) as unknown as Ship;
            }

            const saved = await shipRepository.save(ship);
            seenIds.add(saved.id);
            processedCount++;
          } catch (error: unknown) {
            logger.error(`Error processing Erkul ship:`, {
              ship: erkulShip,
              error: getErrorMessage(error),
            });
          }
        }

        // Soft-delete any Erkul-sourced ships that disappeared from the
        // upstream catalogue. Empty-set guard avoids invalid `IN ()` SQL.
        if (seenIds.size > 0) {
          const result = await em
            .createQueryBuilder()
            .update(Ship)
            .set({ isActive: false, updatedAt: new Date() })
            .where('"dataSource" = :ds', { ds: ShipDataSource.ERKUL })
            .andWhere('"organizationId" IS NULL')
            .andWhere('"isActive" = true')
            .andWhere('id NOT IN (:...seenIds)', { seenIds: Array.from(seenIds) })
            .execute();

          if (typeof result.affected === 'number' && result.affected > 0) {
            logger.info(
              `Soft-deleted ${result.affected} stale Erkul ships not present in latest fetch`
            );
          }
        }

        return processedCount;
      });
    } catch (error: unknown) {
      logger.error(`Failed to process Erkul ships:`, { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Map Erkul.games ship data to Ship model
   */
  private static mapErkulShipToModel(erkulShip: ErkulShipData): Partial<Ship> {
    // Collapse internal whitespace in name (Erkul sometimes returns double-spaced
    // names like "Aurora Mk I  LX" which would otherwise create duplicate rows
    // when compared against canonical single-space names).
    const rawName = this.parseString(erkulShip.name);
    return {
      name: rawName ? rawName.replaceAll(/\s+/g, ' ') : undefined,
      manufacturer: this.parseString(erkulShip.manufacturer),
      manufacturerCode: this.parseString(erkulShip.manufacturerCode),
      description: this.parseString(erkulShip.description),
      role: this.parseString(erkulShip.role),
      career: this.parseString(erkulShip.career),
      roles: this.parseArray(erkulShip.roles),
      size: this.parseSize(erkulShip.size),
      status: this.parseStatus(erkulShip.status),
      crew: this.parseNumber(erkulShip.crew),
      minCrew: this.parseNumber(erkulShip.minCrew),
      maxCrew: this.parseNumber(erkulShip.maxCrew),
      length: this.parseDecimal(erkulShip.length),
      beam: this.parseDecimal(erkulShip.beam),
      height: this.parseDecimal(erkulShip.height),
      mass: this.parseDecimal(erkulShip.mass),
      cargo: this.parseNumber(erkulShip.cargo),
      vehicleCargo: this.parseNumber(erkulShip.vehicleCargo),
      price: this.parseDecimal(erkulShip.price),
      pledgePrice: this.parseNumber(erkulShip.pledgePrice),
      speed: this.parseNumber(erkulShip.speed),
      afterburnerSpeed: this.parseNumber(erkulShip.afterburnerSpeed),
      quantumSpeed: this.parseNumber(erkulShip.quantumSpeed),
      quantumFuelCapacity: this.parseNumber(erkulShip.quantumFuelCapacity),
      hydrogenFuelCapacity: this.parseNumber(erkulShip.hydrogenFuelCapacity),
      shields: this.parseNumber(erkulShip.shields),
      armor: this.parseNumber(erkulShip.armor),
      hangarSize: this.parseString(erkulShip.hangarSize),
      loanerShip: this.parseString(erkulShip.loanerShip),
      variants: this.parseArray(erkulShip.variants),
      isVehicle: erkulShip.isVehicle || false,
      hardpoints: erkulShip.hardpoints as Ship['hardpoints'],
      weapons: erkulShip.weapons as Ship['weapons'],
      metadata: this.extractErkulMetadata(erkulShip),
      dataSource: ShipDataSource.ERKUL,
      lastFetchedAt: new Date(),
    };
  }

  /**
   * Extract additional metadata from Erkul ship data
   */
  private static extractErkulMetadata(
    erkulShip: ErkulShipData
  ): Record<string, unknown> | undefined {
    const localName = erkulShip.localName as string | undefined;
    const career = erkulShip.career as string | undefined;

    const metadata: Record<string, unknown> = {
      source: 'erkul.games',
      fetchedAt: new Date().toISOString(),
      // External links for frontend one-click access
      ...(localName
        ? {
            localName,
            erkulUrl: `https://www.erkul.games/live/calculator?ship=${localName.toUpperCase()}`,
            spviewerUrl: `https://www.spviewer.eu/performance?ship=${localName}`,
          }
        : {}),
      ...(career ? { career } : {}),
    };

    // Store any additional fields that aren't in the main model
    const mappedFields = new Set([
      'name',
      'manufacturer',
      'manufacturerCode',
      'description',
      'role',
      'roles',
      'size',
      'status',
      'crew',
      'minCrew',
      'maxCrew',
      'length',
      'beam',
      'height',
      'mass',
      'cargo',
      'vehicleCargo',
      'price',
      'pledgePrice',
      'speed',
      'afterburnerSpeed',
      'quantumSpeed',
      'quantumFuelCapacity',
      'hydrogenFuelCapacity',
      'shields',
      'armor',
      'hangarSize',
      'loanerShip',
      'variants',
      'isVehicle',
      'hardpoints',
      'weapons',
      'localName',
      'career',
    ]);

    let hasExtraFields = false;
    for (const [key, value] of Object.entries(erkulShip)) {
      if (!mappedFields.has(key) && value !== null && value !== undefined && value !== '') {
        metadata[key] = value;
        hasExtraFields = true;
      }
    }

    // Return metadata — always present when we have localName/career/external links
    return hasExtraFields || localName || career ? metadata : undefined;
  }

  /**
   * Fetch and update ships from a Google Sheet.
   *
   * Wrapped in a single transaction. After upserting every record, any
   * Sheets-sourced row of the same `isVehicle` flavour that was NOT seen
   * in this fetch is soft-deleted (`isActive = false`). Reconciliation is
   * scoped by both `dataSource = 'sheets'` AND `isVehicle` so the ship
   * fetch never deactivates vehicles and vice-versa.
   */
  private static async fetchAndUpdateShips(sheetUrl: string, isVehicle: boolean): Promise<number> {
    try {
      // Fetch CSV data from Google Sheets
      const response = await axios.get(sheetUrl, {
        timeout: this.FETCH_TIMEOUT,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      // Check if response is HTML instead of CSV
      const rawContentType = response.headers['content-type'];
      const contentType =
        typeof rawContentType === 'string'
          ? rawContentType
          : Array.isArray(rawContentType)
            ? rawContentType.join(',')
            : '';
      const responseText = String(response.data).trim();
      const responseTextLower = responseText.toLowerCase();

      if (
        contentType.includes('text/html') ||
        responseTextLower.startsWith('<!doctype') ||
        responseTextLower.startsWith('<html')
      ) {
        logger.warn(`Received HTML instead of CSV data from ${sheetUrl}`, {
          contentType,
          responsePreview: responseText.substring(0, 200),
        });
        throw new Error(
          'Data source returned HTML instead of CSV. The URL may be incorrect or the service may be unavailable.'
        );
      }

      // Validate that we have CSV-like data
      if (!responseText || responseText.length < this.MIN_CSV_RESPONSE_LENGTH) {
        logger.warn(`Received empty or invalid response from ${sheetUrl}`);
        throw new Error('Data source returned empty or invalid data.');
      }

      // Parse CSV data
      const records = parse(response.data, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true,
        cast_date: false,
      });

      logger.info(`Parsed ${records.length} records from sheet`);

      // Initialize database connection
      const dataSource = AppDataSource.isInitialized
        ? AppDataSource
        : await AppDataSource.initialize();

      return await dataSource.transaction(async em => {
        const shipRepository = em.getRepository(Ship);
        const seenIds = new Set<string>();
        let processedCount = 0;

        for (const record of records) {
          try {
            // Map CSV columns to ship properties
            const shipData = this.mapRecordToShip(
              record as CSVRecord,
              isVehicle,
              ShipDataSource.SHEETS
            );

            if (!shipData.name || !shipData.manufacturer) {
              logger.debug('Skipping record with missing name or manufacturer', record);
              continue;
            }

            // Check if ship already exists (look up by name; id is uuid, not slug)
            let ship = await shipRepository.findOne({
              where: { name: shipData.name, organizationId: IsNull() },
            });

            if (ship) {
              // Update existing ship — re-activate in case a prior pass
              // soft-deleted it before it returned to the upstream sheet.
              Object.assign(ship, shipData);
              ship.isActive = true;
              ship.updatedAt = new Date();
            } else {
              // Create new ship
              ship = shipRepository.create({
                id: randomUUID(),
                ...shipData,
                organizationId: null, // Global reference ship
                isActive: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any) as unknown as Ship;
            }

            const saved = await shipRepository.save(ship);
            seenIds.add(saved.id);
            processedCount++;
          } catch (error: unknown) {
            logger.error(`Error processing record:`, { record, error: getErrorMessage(error) });
          }
        }

        // Soft-delete stale Sheets-sourced rows of the same isVehicle flavour.
        if (seenIds.size > 0) {
          const result = await em
            .createQueryBuilder()
            .update(Ship)
            .set({ isActive: false, updatedAt: new Date() })
            .where('"dataSource" = :ds', { ds: ShipDataSource.SHEETS })
            .andWhere('"organizationId" IS NULL')
            .andWhere('"isVehicle" = :isVehicle', { isVehicle })
            .andWhere('"isActive" = true')
            .andWhere('id NOT IN (:...seenIds)', { seenIds: Array.from(seenIds) })
            .execute();

          if (typeof result.affected === 'number' && result.affected > 0) {
            logger.info(
              `Soft-deleted ${result.affected} stale Sheets ${
                isVehicle ? 'vehicles' : 'ships'
              } not present in latest fetch`
            );
          }
        }

        return processedCount;
      });
    } catch (error: unknown) {
      logger.error(`Failed to fetch data from ${sheetUrl}:`, { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Map CSV record to Ship properties.
   *
   * @param source Origin marker for soft-delete reconciliation. Defaults to
   *               `SHEETS` since Google Sheets is the most common caller;
   *               bundled CSV and admin uploads override this.
   */
  private static mapRecordToShip(
    record: CSVRecord,
    isVehicle: boolean,
    source: ShipDataSource = ShipDataSource.SHEETS
  ): Partial<Ship> {
    // Common mappings - adjust based on actual Google Sheets columns
    // Expected columns: name, manufacturer, role, size, crew, minCrew, maxCrew,
    // length, beam, height, mass, cargo, price, speed, status, etc.

    return {
      name: this.parseString(record.name || record.Name || record.ship_name || record['Ship Name']),
      manufacturer: this.parseString(
        record.manufacturer || record.Manufacturer || record.make || record.Make
      ),
      manufacturerCode: this.parseString(
        record.manufacturer_code || record['Manufacturer Code'] || record.code
      ),
      description: this.parseString(record.description || record.Description),
      role: this.parseString(record.role || record.Role || record.focus || record.Focus),
      roles: this.parseArray(record.roles || record.Roles),
      size: this.parseSize(record.size || record.Size),
      status: this.parseStatus(record.status || record.Status),
      crew: this.parseNumber(record.crew || record.Crew || record.max_crew),
      minCrew: this.parseNumber(record.min_crew || record['Min Crew'] || record.minCrew),
      maxCrew: this.parseNumber(record.max_crew || record['Max Crew'] || record.maxCrew),
      length: this.parseDecimal(record.length || record.Length),
      beam: this.parseDecimal(record.beam || record.Beam || record.width || record.Width),
      height: this.parseDecimal(record.height || record.Height),
      mass: this.parseDecimal(record.mass || record.Mass || record.weight || record.Weight),
      cargo: this.parseNumber(
        record.cargo || record.Cargo || record.cargo_capacity || record['Cargo Capacity']
      ),
      vehicleCargo: this.parseNumber(record.vehicle_cargo || record['Vehicle Cargo']),
      price: this.parseDecimal(
        record.price || record.Price || record.in_game_price || record['In-Game Price']
      ),
      pledgePrice: this.parseNumber(
        record.pledge_price || record['Pledge Price'] || record.pledgePrice
      ),
      speed: this.parseNumber(
        record.speed || record.Speed || record.scm_speed || record['SCM Speed']
      ),
      afterburnerSpeed: this.parseNumber(
        record.afterburner_speed || record['Afterburner Speed'] || record.max_speed
      ),
      quantumSpeed: this.parseNumber(record.quantum_speed || record['Quantum Speed']),
      quantumFuelCapacity: this.parseNumber(record.quantum_fuel || record['Quantum Fuel']),
      hydrogenFuelCapacity: this.parseNumber(record.hydrogen_fuel || record['Hydrogen Fuel']),
      shields: this.parseNumber(record.shields || record.Shields || record.shield_hp),
      armor: this.parseNumber(record.armor || record.Armor || record.hull_hp),
      hangarSize: this.parseString(record.hangar_size || record['Hangar Size']),
      loanerShip: this.parseString(record.loaner || record.Loaner || record.loaner_ship),
      variants: this.parseArray(record.variants || record.Variants),
      isVehicle,
      metadata: this.extractMetadata(record),
      dataSource: source,
      lastFetchedAt: new Date(),
    };
  }

  /**
   * Generate unique ship ID
   */
  private static generateShipId(name: string, manufacturer: string): string {
    const cleanName = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
    const cleanManufacturer = manufacturer.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
    return `${cleanManufacturer}-${cleanName}`;
  }

  /**
   * Parse string value
   */
  private static parseString(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return String(value).trim();
  }

  /**
   * Parse number value
   */
  private static parseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num =
      typeof value === 'number'
        ? value
        : Number.parseFloat(String(value).replaceAll(/[^0-9.-]/g, ''));
    return Number.isNaN(num) ? undefined : Math.round(num);
  }

  /**
   * Parse decimal value
   */
  private static parseDecimal(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num =
      typeof value === 'number'
        ? value
        : Number.parseFloat(String(value).replaceAll(/[^0-9.-]/g, ''));
    return Number.isNaN(num) ? undefined : num;
  }

  /**
   * Parse array value (comma-separated)
   */
  private static parseArray(value: unknown): string[] | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim()).filter(Boolean);
    }
    return String(value)
      .split(/[,;]/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  /**
   * Parse size value
   */
  private static parseSize(value: unknown): ShipSize | undefined {
    if (!value) {
      return undefined;
    }

    const sizeStr = String(value).toLowerCase().trim();

    if (sizeStr.includes('vehicle')) {
      return ShipSize.VEHICLE;
    }
    if (sizeStr.includes('snub')) {
      return ShipSize.SNUB;
    }
    if (sizeStr.includes('small')) {
      return ShipSize.SMALL;
    }
    if (sizeStr.includes('medium')) {
      return ShipSize.MEDIUM;
    }
    if (
      sizeStr === 'sub_capital' ||
      sizeStr.includes('sub capital') ||
      sizeStr.includes('sub-capital')
    ) {
      return ShipSize.SUB_CAPITAL;
    }
    if (sizeStr.includes('large')) {
      return ShipSize.LARGE;
    }
    if (sizeStr.includes('capital')) {
      return ShipSize.CAPITAL;
    }

    return undefined;
  }

  /**
   * Parse status value
   */
  private static parseStatus(value: unknown): ShipStatus {
    if (!value) {
      return ShipStatus.FLIGHT_READY;
    }

    const statusStr = String(value).toLowerCase().trim();

    if (statusStr.includes('concept')) {
      return ShipStatus.IN_CONCEPT;
    }
    if (statusStr.includes('production')) {
      return ShipStatus.IN_PRODUCTION;
    }
    if (statusStr.includes('announced')) {
      return ShipStatus.ANNOUNCED;
    }
    if (statusStr.includes('flight') || statusStr.includes('ready')) {
      return ShipStatus.FLIGHT_READY;
    }

    return ShipStatus.FLIGHT_READY;
  }

  /**
   * Extract additional metadata from record
   */
  private static extractMetadata(record: CSVRecord): Record<string, unknown> | undefined {
    const metadata: Record<string, unknown> = {};

    // Store any unmapped fields in metadata
    const mappedFields = new Set([
      'name',
      'manufacturer',
      'manufacturer_code',
      'description',
      'role',
      'roles',
      'size',
      'status',
      'crew',
      'min_crew',
      'max_crew',
      'length',
      'beam',
      'height',
      'mass',
      'cargo',
      'vehicle_cargo',
      'price',
      'pledge_price',
      'speed',
      'afterburner_speed',
      'quantum_speed',
      'quantum_fuel',
      'hydrogen_fuel',
      'shields',
      'armor',
      'hangar_size',
      'loaner',
      'variants',
    ]);

    for (const [key, value] of Object.entries(record)) {
      const lowerKey = key.toLowerCase().replaceAll(/\s+/g, '_');
      if (!mappedFields.has(lowerKey) && value !== null && value !== undefined && value !== '') {
        metadata[key] = value;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  /**
   * Force a manual refresh of all data
   */
  static async forceRefresh(): Promise<void> {
    logger.info('Forcing manual ship data refresh...');
    await this.execute();
  }

  /**
   * Schedule the data fetch job
   * Runs daily at 2 AM UTC: 0 2 * * *
   */
  static schedule(): void {
    if (this.scheduledTask) {
      logger.warn('Ship data fetch job already scheduled');
      return;
    }

    // Schedule: Daily at 2 AM UTC
    this.scheduledTask = schedule(
      '0 2 * * *',
      async () => {
        try {
          await this.execute();
        } catch (error) {
          logger.error('Scheduled ship data fetch failed:', error);
        }
      },
      {
        timezone: 'UTC',
        name: 'ship-data-fetch',
      }
    );

    // Start the scheduled task
    void this.scheduledTask.start();

    logger.info('Ship data fetch job scheduled (daily at 02:00 UTC)');

    // Run initial fetch after a short delay (60 seconds) to allow server startup
    setTimeout(() => {
      void (async () => {
        try {
          logger.info('Running initial ship data fetch...');
          await this.execute();
        } catch (error) {
          logger.error('Initial ship data fetch failed:', error);
        }
      })();
    }, 60000);
  }

  /**
   * Stop the scheduled job
   */
  static stop(): void {
    if (this.scheduledTask) {
      void this.scheduledTask.stop();
      this.scheduledTask = null;
      logger.info('Ship data fetch job stopped');
    }
  }
}
