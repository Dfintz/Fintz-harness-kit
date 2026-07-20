"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipDataFetcher = void 0;
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const axios_1 = __importDefault(require("axios"));
const sync_1 = require("csv-parse/sync");
const node_cron_1 = require("node-cron");
const typeorm_1 = require("typeorm");
const applicationInsights_1 = require("../config/applicationInsights");
const database_1 = require("../config/database");
const Ship_1 = require("../models/Ship");
const ErkulGamesService_1 = require("../services/external/ErkulGamesService");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
class ShipDataFetcher {
    static FETCH_TIMEOUT = 30000;
    static USER_AGENT = 'SC-Fleet-Manager/1.0 (Ship Data Integration)';
    static MIN_CSV_RESPONSE_LENGTH = 10;
    static isFetching = false;
    static scheduledTask = null;
    static lastFetchStatus = null;
    static getLastFetchStatus() {
        return this.lastFetchStatus;
    }
    static isCurrentlyFetching() {
        return this.isFetching;
    }
    static FALLBACK_SHIP_URL = 'https://shipmatrix.space/';
    static FALLBACK_VEHICLE_URL = 'https://shipmatrix.space/landcraft/';
    static BUNDLED_SHIP_CSV = node_path_1.default.join(__dirname, '..', '..', '..', 'scships.csv');
    static BUNDLED_VEHICLE_CSV = node_path_1.default.join(__dirname, '..', '..', '..', 'vehicle.csv');
    static erkulService = new ErkulGamesService_1.ErkulGamesService();
    static async loadFromLocalCsv(csvPath, isVehicle) {
        const csvContent = await promises_1.default.readFile(csvPath, 'utf-8');
        if (!csvContent || csvContent.length < 10) {
            throw new Error('CSV file is empty or too small');
        }
        const records = (0, sync_1.parse)(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: true,
            cast_date: false,
        });
        logger_1.logger.info(`Parsed ${String(records.length)} records from local CSV: ${csvPath}`);
        const dataSource = database_1.AppDataSource.isInitialized
            ? database_1.AppDataSource
            : await database_1.AppDataSource.initialize();
        const shipRepository = dataSource.getRepository(Ship_1.Ship);
        let processedCount = 0;
        for (const record of records) {
            try {
                const shipData = this.mapRecordToShip(record, isVehicle, Ship_1.ShipDataSource.CSV);
                if (!shipData.name || !shipData.manufacturer) {
                    continue;
                }
                let ship = await shipRepository.findOne({
                    where: { name: shipData.name, organizationId: (0, typeorm_1.IsNull)() },
                });
                if (ship) {
                    Object.assign(ship, shipData);
                    ship.updatedAt = new Date();
                }
                else {
                    ship = shipRepository.create({
                        id: (0, node_crypto_1.randomUUID)(),
                        ...shipData,
                        organizationId: null,
                        isActive: true,
                    });
                }
                await shipRepository.save(ship);
                processedCount++;
            }
            catch {
            }
        }
        return processedCount;
    }
    static async importFromCsvContent(csvContent, isVehicle = false) {
        const records = (0, sync_1.parse)(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: true,
            cast_date: false,
        });
        const dataSource = database_1.AppDataSource.isInitialized
            ? database_1.AppDataSource
            : await database_1.AppDataSource.initialize();
        const shipRepository = dataSource.getRepository(Ship_1.Ship);
        let processedCount = 0;
        const importErrors = [];
        for (const record of records) {
            try {
                const shipData = this.mapRecordToShip(record, isVehicle, Ship_1.ShipDataSource.MANUAL);
                if (!shipData.name || !shipData.manufacturer) {
                    continue;
                }
                let ship = await shipRepository.findOne({
                    where: { name: shipData.name, organizationId: (0, typeorm_1.IsNull)() },
                });
                if (ship) {
                    Object.assign(ship, shipData);
                    ship.updatedAt = new Date();
                }
                else {
                    ship = shipRepository.create({
                        id: (0, node_crypto_1.randomUUID)(),
                        ...shipData,
                        organizationId: null,
                        isActive: true,
                    });
                }
                await shipRepository.save(ship);
                processedCount++;
            }
            catch (e) {
                const recName = record.name ?? record.Name ?? 'unknown';
                importErrors.push(`${recName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }
        return { processed: processedCount, total: records.length, errors: importErrors };
    }
    static async execute() {
        if (this.isFetching) {
            logger_1.logger.warn('Ship data fetch already in progress, skipping...');
            return;
        }
        this.isFetching = true;
        const startTime = Date.now();
        logger_1.logger.info('Starting ship and vehicle data fetch job...');
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
            (0, applicationInsights_1.trackMetric)('ship_sync_duration_ms', duration);
            (0, applicationInsights_1.trackMetric)('ship_sync_ships_processed', result.shipsProcessed);
            (0, applicationInsights_1.trackMetric)('ship_sync_vehicles_processed', result.vehiclesProcessed);
            (0, applicationInsights_1.trackMetric)('ship_sync_partial_errors', result.errors.length);
            if (isSuccess) {
                (0, applicationInsights_1.trackEvent)('ShipSyncCompleted', {
                    durationMs: String(duration),
                    shipsProcessed: String(result.shipsProcessed),
                    vehiclesProcessed: String(result.vehiclesProcessed),
                    partialErrors: String(result.errors.length),
                });
                logger_1.logger.info(`Ship data fetch completed in ${duration}ms`, {
                    shipsProcessed: result.shipsProcessed,
                    vehiclesProcessed: result.vehiclesProcessed,
                    errors: result.errors.length > 0 ? result.errors : undefined,
                });
            }
            else {
                (0, applicationInsights_1.trackEvent)('ShipSyncFailed', {
                    durationMs: String(duration),
                    reason: 'no_records_processed',
                    errors: result.errors.slice(0, 5).join('; ').slice(0, 500),
                });
                logger_1.logger.error(`Ship data fetch failed after ${duration}ms`, { errors: result.errors });
            }
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errMsg = error instanceof Error ? (0, errorHandler_1.getErrorMessage)(error) : 'Unknown error';
            logger_1.logger.error('Unexpected error during ship data fetch:', error);
            this.lastFetchStatus = {
                success: false,
                timestamp: new Date(),
                shipsProcessed: 0,
                vehiclesProcessed: 0,
                error: errMsg,
            };
            (0, applicationInsights_1.trackEvent)('ShipSyncFailed', {
                durationMs: String(duration),
                reason: 'unhandled_exception',
                errors: errMsg.slice(0, 500),
            });
        }
        finally {
            this.isFetching = false;
        }
    }
    static async fetchFromAllSources() {
        let shipsProcessed = 0;
        let vehiclesProcessed = 0;
        const errors = [];
        const erkulCount = await this.tryFetchErkul(errors);
        shipsProcessed += erkulCount;
        const sheet1Count = await this.tryFetchSheet(process.env.SHIP_DATA_SHEET_1, 'Sheet 1', false, errors);
        shipsProcessed += sheet1Count;
        const sheet2Count = await this.tryFetchSheet(process.env.SHIP_DATA_SHEET_2, 'Sheet 2', true, errors);
        vehiclesProcessed += sheet2Count;
        if (shipsProcessed === 0 && vehiclesProcessed === 0) {
            const bundled = await this.tryFetchBundledCsvs(errors);
            shipsProcessed += bundled.ships;
            vehiclesProcessed += bundled.vehicles;
        }
        return { shipsProcessed, vehiclesProcessed, errors };
    }
    static async tryFetchErkul(errors) {
        try {
            logger_1.logger.info('Attempting to fetch ship data from Erkul.games...');
            const erkulResult = await ShipDataFetcher.erkulService.fetchShipList();
            if (erkulResult.success && erkulResult.ships && erkulResult.ships.length > 0) {
                logger_1.logger.info(`Fetched ${erkulResult.ships.length} ships from Erkul.games`);
                const processed = await this.processErkulShips(erkulResult.ships);
                logger_1.logger.info(`Processed ${processed} ships from Erkul.games`);
                return processed;
            }
            const errorMsg = erkulResult.error || 'No ships returned';
            logger_1.logger.warn(`Erkul.games fetch failed: ${errorMsg}`);
            errors.push(`Erkul.games: ${errorMsg}`);
            return 0;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? (0, errorHandler_1.getErrorMessage)(error) : 'Unknown error';
            logger_1.logger.warn(`Failed to fetch from Erkul.games: ${errorMessage}`);
            errors.push(`Erkul.games: ${errorMessage}`);
            return 0;
        }
    }
    static async tryFetchSheet(url, label, isVehicle, errors) {
        if (!url) {
            return 0;
        }
        try {
            logger_1.logger.info(`Fetching data from ${label}...`);
            const count = await this.fetchAndUpdateShips(url, isVehicle);
            logger_1.logger.info(`Processed ${count} entries from ${label}`);
            return count;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? (0, errorHandler_1.getErrorMessage)(error) : 'Unknown error';
            logger_1.logger.error(`Failed to fetch from ${label}: ${errorMessage}`);
            errors.push(`${label}: ${errorMessage}`);
            return 0;
        }
    }
    static async tryFetchBundledCsvs(errors) {
        logger_1.logger.info('No external sources available, loading from bundled CSV files...');
        let ships = 0;
        let vehicles = 0;
        const shipExists = await promises_1.default
            .access(this.BUNDLED_SHIP_CSV)
            .then(() => true)
            .catch(() => false);
        if (shipExists) {
            try {
                ships = await this.loadFromLocalCsv(this.BUNDLED_SHIP_CSV, false);
                logger_1.logger.info(`Processed ${String(ships)} ships from bundled CSV`);
            }
            catch (error) {
                const msg = error instanceof Error ? (0, errorHandler_1.getErrorMessage)(error) : 'Unknown error';
                logger_1.logger.error(`Failed to load bundled ship CSV: ${msg}`);
                errors.push(`Bundled CSV: ${msg}`);
            }
        }
        const vehicleExists = await promises_1.default
            .access(this.BUNDLED_VEHICLE_CSV)
            .then(() => true)
            .catch(() => false);
        if (vehicleExists) {
            try {
                vehicles = await this.loadFromLocalCsv(this.BUNDLED_VEHICLE_CSV, true);
                logger_1.logger.info(`Processed ${String(vehicles)} vehicles from bundled CSV`);
            }
            catch (error) {
                const msg = error instanceof Error ? (0, errorHandler_1.getErrorMessage)(error) : 'Unknown error';
                logger_1.logger.error(`Failed to load bundled vehicle CSV: ${msg}`);
                errors.push(`Bundled vehicles: ${msg}`);
            }
        }
        return { ships, vehicles };
    }
    static async processErkulShips(ships) {
        try {
            const dataSource = database_1.AppDataSource.isInitialized
                ? database_1.AppDataSource
                : await database_1.AppDataSource.initialize();
            return await dataSource.transaction(async (em) => {
                const shipRepository = em.getRepository(Ship_1.Ship);
                const seenIds = new Set();
                let processedCount = 0;
                for (const erkulShip of ships) {
                    try {
                        const shipData = this.mapErkulShipToModel(erkulShip);
                        if (!shipData.name || !shipData.manufacturer) {
                            logger_1.logger.debug('Skipping Erkul ship with missing name or manufacturer', erkulShip);
                            continue;
                        }
                        let ship = await shipRepository.findOne({
                            where: { name: shipData.name, organizationId: (0, typeorm_1.IsNull)() },
                        });
                        if (ship) {
                            Object.assign(ship, shipData);
                            ship.isActive = true;
                            ship.updatedAt = new Date();
                        }
                        else {
                            ship = shipRepository.create({
                                id: (0, node_crypto_1.randomUUID)(),
                                ...shipData,
                                organizationId: null,
                                isActive: true,
                            });
                        }
                        const saved = await shipRepository.save(ship);
                        seenIds.add(saved.id);
                        processedCount++;
                    }
                    catch (error) {
                        logger_1.logger.error(`Error processing Erkul ship:`, {
                            ship: erkulShip,
                            error: (0, errorHandler_1.getErrorMessage)(error),
                        });
                    }
                }
                if (seenIds.size > 0) {
                    const result = await em
                        .createQueryBuilder()
                        .update(Ship_1.Ship)
                        .set({ isActive: false, updatedAt: new Date() })
                        .where('"dataSource" = :ds', { ds: Ship_1.ShipDataSource.ERKUL })
                        .andWhere('"organizationId" IS NULL')
                        .andWhere('"isActive" = true')
                        .andWhere('id NOT IN (:...seenIds)', { seenIds: Array.from(seenIds) })
                        .execute();
                    if (typeof result.affected === 'number' && result.affected > 0) {
                        logger_1.logger.info(`Soft-deleted ${result.affected} stale Erkul ships not present in latest fetch`);
                    }
                }
                return processedCount;
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to process Erkul ships:`, { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static mapErkulShipToModel(erkulShip) {
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
            hardpoints: erkulShip.hardpoints,
            weapons: erkulShip.weapons,
            metadata: this.extractErkulMetadata(erkulShip),
            dataSource: Ship_1.ShipDataSource.ERKUL,
            lastFetchedAt: new Date(),
        };
    }
    static extractErkulMetadata(erkulShip) {
        const localName = erkulShip.localName;
        const career = erkulShip.career;
        const metadata = {
            source: 'erkul.games',
            fetchedAt: new Date().toISOString(),
            ...(localName
                ? {
                    localName,
                    erkulUrl: `https://www.erkul.games/live/calculator?ship=${localName.toUpperCase()}`,
                    spviewerUrl: `https://www.spviewer.eu/performance?ship=${localName}`,
                }
                : {}),
            ...(career ? { career } : {}),
        };
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
        return hasExtraFields || localName || career ? metadata : undefined;
    }
    static async fetchAndUpdateShips(sheetUrl, isVehicle) {
        try {
            const response = await axios_1.default.get(sheetUrl, {
                timeout: this.FETCH_TIMEOUT,
                headers: { 'User-Agent': this.USER_AGENT },
            });
            const rawContentType = response.headers['content-type'];
            const contentType = typeof rawContentType === 'string'
                ? rawContentType
                : Array.isArray(rawContentType)
                    ? rawContentType.join(',')
                    : '';
            const responseText = String(response.data).trim();
            const responseTextLower = responseText.toLowerCase();
            if (contentType.includes('text/html') ||
                responseTextLower.startsWith('<!doctype') ||
                responseTextLower.startsWith('<html')) {
                logger_1.logger.warn(`Received HTML instead of CSV data from ${sheetUrl}`, {
                    contentType,
                    responsePreview: responseText.substring(0, 200),
                });
                throw new Error('Data source returned HTML instead of CSV. The URL may be incorrect or the service may be unavailable.');
            }
            if (!responseText || responseText.length < this.MIN_CSV_RESPONSE_LENGTH) {
                logger_1.logger.warn(`Received empty or invalid response from ${sheetUrl}`);
                throw new Error('Data source returned empty or invalid data.');
            }
            const records = (0, sync_1.parse)(response.data, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                cast: true,
                cast_date: false,
            });
            logger_1.logger.info(`Parsed ${records.length} records from sheet`);
            const dataSource = database_1.AppDataSource.isInitialized
                ? database_1.AppDataSource
                : await database_1.AppDataSource.initialize();
            return await dataSource.transaction(async (em) => {
                const shipRepository = em.getRepository(Ship_1.Ship);
                const seenIds = new Set();
                let processedCount = 0;
                for (const record of records) {
                    try {
                        const shipData = this.mapRecordToShip(record, isVehicle, Ship_1.ShipDataSource.SHEETS);
                        if (!shipData.name || !shipData.manufacturer) {
                            logger_1.logger.debug('Skipping record with missing name or manufacturer', record);
                            continue;
                        }
                        let ship = await shipRepository.findOne({
                            where: { name: shipData.name, organizationId: (0, typeorm_1.IsNull)() },
                        });
                        if (ship) {
                            Object.assign(ship, shipData);
                            ship.isActive = true;
                            ship.updatedAt = new Date();
                        }
                        else {
                            ship = shipRepository.create({
                                id: (0, node_crypto_1.randomUUID)(),
                                ...shipData,
                                organizationId: null,
                                isActive: true,
                            });
                        }
                        const saved = await shipRepository.save(ship);
                        seenIds.add(saved.id);
                        processedCount++;
                    }
                    catch (error) {
                        logger_1.logger.error(`Error processing record:`, { record, error: (0, errorHandler_1.getErrorMessage)(error) });
                    }
                }
                if (seenIds.size > 0) {
                    const result = await em
                        .createQueryBuilder()
                        .update(Ship_1.Ship)
                        .set({ isActive: false, updatedAt: new Date() })
                        .where('"dataSource" = :ds', { ds: Ship_1.ShipDataSource.SHEETS })
                        .andWhere('"organizationId" IS NULL')
                        .andWhere('"isVehicle" = :isVehicle', { isVehicle })
                        .andWhere('"isActive" = true')
                        .andWhere('id NOT IN (:...seenIds)', { seenIds: Array.from(seenIds) })
                        .execute();
                    if (typeof result.affected === 'number' && result.affected > 0) {
                        logger_1.logger.info(`Soft-deleted ${result.affected} stale Sheets ${isVehicle ? 'vehicles' : 'ships'} not present in latest fetch`);
                    }
                }
                return processedCount;
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch data from ${sheetUrl}:`, { error: (0, errorHandler_1.getErrorMessage)(error) });
            throw error;
        }
    }
    static mapRecordToShip(record, isVehicle, source = Ship_1.ShipDataSource.SHEETS) {
        return {
            name: this.parseString(record.name || record.Name || record.ship_name || record['Ship Name']),
            manufacturer: this.parseString(record.manufacturer || record.Manufacturer || record.make || record.Make),
            manufacturerCode: this.parseString(record.manufacturer_code || record['Manufacturer Code'] || record.code),
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
            cargo: this.parseNumber(record.cargo || record.Cargo || record.cargo_capacity || record['Cargo Capacity']),
            vehicleCargo: this.parseNumber(record.vehicle_cargo || record['Vehicle Cargo']),
            price: this.parseDecimal(record.price || record.Price || record.in_game_price || record['In-Game Price']),
            pledgePrice: this.parseNumber(record.pledge_price || record['Pledge Price'] || record.pledgePrice),
            speed: this.parseNumber(record.speed || record.Speed || record.scm_speed || record['SCM Speed']),
            afterburnerSpeed: this.parseNumber(record.afterburner_speed || record['Afterburner Speed'] || record.max_speed),
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
    static generateShipId(name, manufacturer) {
        const cleanName = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
        const cleanManufacturer = manufacturer.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
        return `${cleanManufacturer}-${cleanName}`;
    }
    static parseString(value) {
        if (value === null || value === undefined || value === '') {
            return undefined;
        }
        return String(value).trim();
    }
    static parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return undefined;
        }
        const num = typeof value === 'number'
            ? value
            : Number.parseFloat(String(value).replaceAll(/[^0-9.-]/g, ''));
        return Number.isNaN(num) ? undefined : Math.round(num);
    }
    static parseDecimal(value) {
        if (value === null || value === undefined || value === '') {
            return undefined;
        }
        const num = typeof value === 'number'
            ? value
            : Number.parseFloat(String(value).replaceAll(/[^0-9.-]/g, ''));
        return Number.isNaN(num) ? undefined : num;
    }
    static parseArray(value) {
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
    static parseSize(value) {
        if (!value) {
            return undefined;
        }
        const sizeStr = String(value).toLowerCase().trim();
        if (sizeStr.includes('vehicle')) {
            return Ship_1.ShipSize.VEHICLE;
        }
        if (sizeStr.includes('snub')) {
            return Ship_1.ShipSize.SNUB;
        }
        if (sizeStr.includes('small')) {
            return Ship_1.ShipSize.SMALL;
        }
        if (sizeStr.includes('medium')) {
            return Ship_1.ShipSize.MEDIUM;
        }
        if (sizeStr === 'sub_capital' ||
            sizeStr.includes('sub capital') ||
            sizeStr.includes('sub-capital')) {
            return Ship_1.ShipSize.SUB_CAPITAL;
        }
        if (sizeStr.includes('large')) {
            return Ship_1.ShipSize.LARGE;
        }
        if (sizeStr.includes('capital')) {
            return Ship_1.ShipSize.CAPITAL;
        }
        return undefined;
    }
    static parseStatus(value) {
        if (!value) {
            return Ship_1.ShipStatus.FLIGHT_READY;
        }
        const statusStr = String(value).toLowerCase().trim();
        if (statusStr.includes('concept')) {
            return Ship_1.ShipStatus.IN_CONCEPT;
        }
        if (statusStr.includes('production')) {
            return Ship_1.ShipStatus.IN_PRODUCTION;
        }
        if (statusStr.includes('announced')) {
            return Ship_1.ShipStatus.ANNOUNCED;
        }
        if (statusStr.includes('flight') || statusStr.includes('ready')) {
            return Ship_1.ShipStatus.FLIGHT_READY;
        }
        return Ship_1.ShipStatus.FLIGHT_READY;
    }
    static extractMetadata(record) {
        const metadata = {};
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
    static async forceRefresh() {
        logger_1.logger.info('Forcing manual ship data refresh...');
        await this.execute();
    }
    static schedule() {
        if (this.scheduledTask) {
            logger_1.logger.warn('Ship data fetch job already scheduled');
            return;
        }
        this.scheduledTask = (0, node_cron_1.schedule)('0 2 * * *', async () => {
            try {
                await this.execute();
            }
            catch (error) {
                logger_1.logger.error('Scheduled ship data fetch failed:', error);
            }
        }, {
            timezone: 'UTC',
            name: 'ship-data-fetch',
        });
        void this.scheduledTask.start();
        logger_1.logger.info('Ship data fetch job scheduled (daily at 02:00 UTC)');
        setTimeout(() => {
            void (async () => {
                try {
                    logger_1.logger.info('Running initial ship data fetch...');
                    await this.execute();
                }
                catch (error) {
                    logger_1.logger.error('Initial ship data fetch failed:', error);
                }
            })();
        }, 60000);
    }
    static stop() {
        if (this.scheduledTask) {
            void this.scheduledTask.stop();
            this.scheduledTask = null;
            logger_1.logger.info('Ship data fetch job stopped');
        }
    }
}
exports.ShipDataFetcher = ShipDataFetcher;
//# sourceMappingURL=shipDataFetcher.js.map