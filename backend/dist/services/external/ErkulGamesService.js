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
exports.erkulGamesService = exports.ErkulGamesService = void 0;
const appInsights = __importStar(require("applicationinsights"));
const axios_1 = __importStar(require("axios"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
class ErkulGamesService {
    baseUrl = 'https://www.erkul.games';
    serverBaseUrl = 'https://server.erkul.games';
    browserUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    static MIN_REQUEST_INTERVAL_MS = 1500;
    static MAX_RETRY_ATTEMPTS = 3;
    static MAX_BACKOFF_MS = 8000;
    static SESSION_TOKEN_CACHE_KEY = 'erkul:session-token';
    static SESSION_TOKEN_TTL_SECONDS = 3000;
    static shipSchemaGuard = joi_1.default.alternatives()
        .try(joi_1.default.object({
        name: joi_1.default.string().min(1).required(),
        manufacturer: joi_1.default.string().min(1).required(),
    }).unknown(true), joi_1.default.object({
        data: joi_1.default.object({
            name: joi_1.default.string().min(1).required(),
        })
            .unknown(true)
            .required(),
    }).unknown(true))
        .required();
    lastRequestAt = 0;
    constructor() {
    }
    isValidErkulUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname === 'erkul.games' || parsed.hostname === 'www.erkul.games';
        }
        catch {
            return false;
        }
    }
    extractShipName(url) {
        try {
            const parsed = new URL(url);
            const shipParam = parsed.searchParams.get('ship');
            if (shipParam) {
                return shipParam
                    .replaceAll(/_/g, ' ')
                    .replace(/\b\w/g, char => char.toUpperCase())
                    .replace(/\B\w/g, char => char.toLowerCase());
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error extracting ship name from Erkul URL:', error);
            return null;
        }
    }
    extractLoadoutId(url) {
        try {
            const parsed = new URL(url);
            const match = parsed.pathname.match(/^(?:\/live)?\/loadout\/([a-zA-Z0-9_-]+)$/);
            return match ? match[1] : null;
        }
        catch {
            return null;
        }
    }
    async parseErkulUrl(url) {
        if (!this.isValidErkulUrl(url)) {
            return {
                success: false,
                error: 'Invalid Erkul.games URL',
            };
        }
        try {
            const loadoutId = this.extractLoadoutId(url);
            if (loadoutId) {
                return await this.fetchSharedLoadout(loadoutId, url);
            }
            const parsed = new URL(url);
            const components = [];
            const shipName = this.extractShipName(url);
            if (!shipName) {
                return {
                    success: false,
                    error: 'Could not determine ship name from URL. Use a calculator URL (https://www.erkul.games/live/calculator?ship=SHIP_NAME) or a loadout share URL (https://www.erkul.games/loadout/ID).',
                };
            }
            const componentPrefixes = [
                'power',
                'cooler',
                'shield',
                'qd',
                'weapon',
                'turret',
                'missile',
                'emp',
                'utility',
            ];
            const searchParamsArray = Array.from(parsed.searchParams.entries());
            for (const [key, value] of searchParamsArray) {
                for (const prefix of componentPrefixes) {
                    if (key.startsWith(prefix) && value) {
                        components.push({
                            slot: key,
                            name: value.replaceAll(/_/g, ' '),
                            type: prefix,
                        });
                    }
                }
            }
            const loadout = {
                shipName,
                components,
                url,
                parsedAt: new Date(),
            };
            logger_1.logger.info('Parsed Erkul.games loadout', {
                shipName,
                componentCount: components.length,
            });
            return {
                success: true,
                loadout,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Error parsing Erkul.games URL:', error);
            return {
                success: false,
                error: `Failed to parse Erkul URL: ${errorMessage}`,
            };
        }
    }
    async fetchSharedLoadout(loadoutId, originalUrl) {
        try {
            const sessionToken = await this.getSessionToken();
            const response = await this.fetchWithRetry(`${this.serverBaseUrl}/live/loadout/${loadoutId}`, {
                timeout: 15000,
                headers: {
                    Accept: 'application/json',
                    'User-Agent': this.browserUserAgent,
                    Origin: 'https://www.erkul.games',
                    Referer: 'https://www.erkul.games/',
                    Authorization: `Bearer ${sessionToken}`,
                },
            });
            const data = response.data;
            return this.parseSharedLoadoutResponse(data, originalUrl);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.warn('Failed to fetch shared loadout from Erkul server', {
                loadoutId,
                error: errorMessage,
            });
            return {
                success: false,
                error: `Could not fetch shared loadout "${loadoutId}". The loadout may have expired or been deleted. You can also try the calculator URL format: https://www.erkul.games/live/calculator?ship=SHIP_NAME`,
            };
        }
    }
    parseSharedLoadoutResponse(data, originalUrl) {
        try {
            const shipName = data.shipName ?? data.ship ?? data.name;
            const nestedData = data.data;
            const resolvedShipName = shipName ?? nestedData?.name ?? nestedData?.shipName;
            if (!resolvedShipName) {
                return {
                    success: false,
                    error: 'Loadout data does not contain a ship name. The loadout may be invalid or the format is unsupported.',
                };
            }
            const components = [];
            const rawComponents = data.components ??
                nestedData?.components ??
                data.loadout;
            if (Array.isArray(rawComponents)) {
                for (const comp of rawComponents) {
                    if (comp && typeof comp === 'object') {
                        const c = comp;
                        const slot = c.slot ?? c.portName ?? c.itemPortName ?? '';
                        const name = c.name ?? c.itemName ?? '';
                        const type = c.type ?? c.category ?? '';
                        if (name) {
                            components.push({ slot, name, type });
                        }
                    }
                }
            }
            const formattedName = resolvedShipName.includes('_')
                ? resolvedShipName
                    .replaceAll(/_/g, ' ')
                    .replace(/\b\w/g, char => char.toUpperCase())
                    .replace(/\B\w/g, char => char.toLowerCase())
                : resolvedShipName;
            const loadout = {
                shipName: formattedName,
                components,
                url: originalUrl,
                parsedAt: new Date(),
            };
            logger_1.logger.info('Parsed shared Erkul.games loadout', {
                shipName: formattedName,
                componentCount: components.length,
            });
            return { success: true, loadout };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Error parsing shared loadout response:', error);
            return {
                success: false,
                error: `Failed to parse shared loadout data: ${errorMessage}`,
            };
        }
    }
    generateErkulUrl(shipName, components, localName) {
        const params = new URLSearchParams();
        const erkulShipName = localName
            ? localName.toUpperCase()
            : shipName.toUpperCase().replaceAll(/\s+/g, '_');
        params.append('ship', erkulShipName);
        if (components) {
            components.forEach(component => {
                const erkulComponentName = component.name.toUpperCase().replaceAll(/\s+/g, '_');
                params.append(component.slot, erkulComponentName);
            });
        }
        return `${this.baseUrl}/live/calculator?${params.toString()}`;
    }
    static generateSpviewerUrl(localName) {
        return `https://www.spviewer.eu/performance?ship=${localName}`;
    }
    async validateAndParse(url) {
        if (!this.isValidErkulUrl(url)) {
            return {
                success: false,
                error: 'URL is not a valid Erkul.games URL',
            };
        }
        return this.parseErkulUrl(url);
    }
    getComponentTypes() {
        return [
            'power_plant',
            'cooler',
            'shield_generator',
            'quantum_drive',
            'weapon',
            'turret',
            'missile_rack',
            'utility',
            'armor',
            'scanner',
            'radar',
            'mining_laser',
            'tractor_beam',
        ];
    }
    async getSessionToken() {
        try {
            const cached = await redis_1.cache.get(ErkulGamesService.SESSION_TOKEN_CACHE_KEY);
            if (cached && typeof cached === 'string' && cached.length > 0) {
                return cached;
            }
        }
        catch (error) {
            logger_1.logger.debug('Erkul session token cache lookup failed, fetching fresh token', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        const response = await this.fetchWithRetry(`${this.serverBaseUrl}/informations`, {
            timeout: 15000,
            headers: {
                Accept: 'application/json',
                'User-Agent': this.browserUserAgent,
                Origin: 'https://www.erkul.games',
                Referer: 'https://www.erkul.games/',
            },
        });
        const token = this.extractSessionToken(response.data);
        if (!token) {
            logger_1.logger.warn('Unexpected Erkul /informations response format', {
                type: typeof response.data,
                isArray: Array.isArray(response.data),
                keys: response.data && typeof response.data === 'object'
                    ? Object.keys(response.data)
                    : [],
            });
            throw new Error('No session token returned from Erkul server — API response format may have changed');
        }
        try {
            await redis_1.cache.set(ErkulGamesService.SESSION_TOKEN_CACHE_KEY, token, ErkulGamesService.SESSION_TOKEN_TTL_SECONDS);
        }
        catch (error) {
            logger_1.logger.debug('Failed to cache Erkul session token', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return token;
    }
    extractSessionToken(data) {
        if (Array.isArray(data)) {
            for (const entry of data) {
                if (entry &&
                    typeof entry === 'object' &&
                    typeof entry.sessionToken === 'string') {
                    return entry.sessionToken;
                }
            }
        }
        if (data &&
            typeof data === 'object' &&
            typeof data.sessionToken === 'string') {
            return data.sessionToken;
        }
        if (data &&
            typeof data === 'object' &&
            data.data &&
            typeof data.data.sessionToken === 'string') {
            return data.data.sessionToken;
        }
        return null;
    }
    async throttle() {
        const elapsed = Date.now() - this.lastRequestAt;
        const wait = ErkulGamesService.MIN_REQUEST_INTERVAL_MS - elapsed;
        if (wait > 0) {
            await new Promise(resolve => {
                setTimeout(resolve, wait);
            });
        }
        this.lastRequestAt = Date.now();
    }
    async fetchWithRetry(url, config) {
        let lastError;
        for (let attempt = 0; attempt < ErkulGamesService.MAX_RETRY_ATTEMPTS; attempt++) {
            await this.throttle();
            try {
                return await axios_1.default.get(url, config);
            }
            catch (error) {
                lastError = error;
                const status = error instanceof axios_1.AxiosError ? error.response?.status : undefined;
                const isRetryable = status === 429 || status === 503;
                const isFinalAttempt = attempt === ErkulGamesService.MAX_RETRY_ATTEMPTS - 1;
                if (!isRetryable || isFinalAttempt) {
                    throw error;
                }
                const backoffMs = Math.min(2 ** attempt * 1000, ErkulGamesService.MAX_BACKOFF_MS);
                logger_1.logger.warn('Erkul request failed with retryable status, backing off', {
                    url,
                    status,
                    attempt: attempt + 1,
                    backoffMs,
                });
                await new Promise(resolve => {
                    setTimeout(resolve, backoffMs);
                });
            }
        }
        throw lastError instanceof Error ? lastError : new Error('Erkul request failed after retries');
    }
    async fetchShipList() {
        try {
            logger_1.logger.info('Fetching ship list from Erkul.games server API...');
            const sessionToken = await this.getSessionToken();
            logger_1.logger.debug('Erkul session token obtained');
            const response = await this.fetchWithRetry(`${this.serverBaseUrl}/live/ships`, {
                timeout: 60000,
                headers: {
                    Accept: 'application/json',
                    'User-Agent': this.browserUserAgent,
                    Origin: 'https://www.erkul.games',
                    Referer: 'https://www.erkul.games/live/ships',
                    Authorization: `Bearer ${sessionToken}`,
                },
            });
            const rawContentType = response.headers['content-type'];
            const contentType = typeof rawContentType === 'string'
                ? rawContentType
                : Array.isArray(rawContentType)
                    ? rawContentType.join(',')
                    : '';
            if (!contentType.includes('application/json')) {
                logger_1.logger.warn('Erkul server returned non-JSON response', {
                    contentType,
                    statusCode: response.status,
                });
                return {
                    success: false,
                    error: `Expected JSON response but got ${contentType}`,
                };
            }
            const ships = this.parseShipData(response.data);
            if (ships.length === 0) {
                logger_1.logger.warn('No ships found in Erkul server response');
                return {
                    success: false,
                    error: 'No ships found in response data',
                };
            }
            logger_1.logger.info(`Successfully fetched ${ships.length} ships from Erkul.games server API`);
            return {
                success: true,
                ships,
                fetchedAt: new Date(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Error fetching ship list from Erkul.games server API:', error);
            return {
                success: false,
                error: `Failed to fetch ship list: ${errorMessage}`,
            };
        }
    }
    parseShipData(data) {
        const ships = [];
        try {
            let shipArray = [];
            if (Array.isArray(data)) {
                shipArray = data;
            }
            else if (data &&
                typeof data === 'object' &&
                'ships' in data &&
                Array.isArray(data.ships)) {
                shipArray = data.ships;
            }
            else if (data &&
                typeof data === 'object' &&
                'data' in data &&
                Array.isArray(data.data)) {
                shipArray = data.data;
            }
            else if (data && typeof data === 'object' && data !== null) {
                shipArray = Object.values(data);
            }
            this.validateShipPayloadShape(shipArray);
            for (const shipData of shipArray) {
                try {
                    const parsedShip = this.parseShipEntry(shipData);
                    if (parsedShip) {
                        ships.push(parsedShip);
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Failed to parse ship entry', { shipData, error });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error parsing ship data structure:', error);
        }
        return ships;
    }
    validateShipPayloadShape(shipArray) {
        if (shipArray.length === 0) {
            return;
        }
        const sampleSize = Math.min(5, shipArray.length);
        for (let i = 0; i < sampleSize; i++) {
            const { error } = ErkulGamesService.shipSchemaGuard.validate(shipArray[i], {
                abortEarly: true,
                allowUnknown: true,
            });
            if (error) {
                const message = `Erkul ship payload failed schema guard at index ${i}: ${error.message}`;
                logger_1.logger.error(message, {
                    index: i,
                    sampleKeys: shipArray[i] && typeof shipArray[i] === 'object'
                        ? Object.keys(shipArray[i])
                        : [],
                });
                try {
                    appInsights.defaultClient?.trackEvent({
                        name: 'ErkulSchemaValidationFailed',
                        properties: {
                            index: String(i),
                            error: error.message,
                        },
                    });
                }
                catch {
                }
                throw new Error(message);
            }
        }
    }
    static MAPPED_SHIP_FIELDS = new Set([
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
        'type',
        'shipName',
        'Name',
        'make',
        'Manufacturer',
        'manufacturer_name',
        'manufacturerName',
        'manufacturer_code',
        'code',
        'Size',
        'Role',
        'focus',
        'Roles',
        'Crew',
        'max_crew',
        'MaxCrew',
        'min_crew',
        'MinCrew',
        'Length',
        'Beam',
        'width',
        'Width',
        'Height',
        'Mass',
        'weight',
        'Cargo',
        'cargoCapacity',
        'cargo_capacity',
        'Price',
        'inGamePrice',
        'in_game_price',
        'Speed',
        'scmSpeed',
        'scm_speed',
        'maxSpeed',
        'max_speed',
        'afterburner_speed',
        'quantum_speed',
        'quantum_fuel_capacity',
        'quantumFuel',
        'hydrogen_fuel_capacity',
        'hydrogenFuel',
        'Shields',
        'shieldHp',
        'shield_hp',
        'Armor',
        'hullHp',
        'hull_hp',
        'Status',
        'production_status',
        'is_vehicle',
    ]);
    parseShipEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        const record = entry;
        if (record.calculatorType === 'ship' && record.data && typeof record.data === 'object') {
            return this.parseErkulServerEntry(record);
        }
        return this.parseFlatShipEntry(record);
    }
    parseErkulServerEntry(record) {
        const data = record.data;
        const name = data.name;
        if (!name) {
            return null;
        }
        const mfData = data.manufacturerData;
        const manufacturer = mfData?.data?.name || 'Unknown';
        const vehicle = data.vehicle;
        const ifcs = data.ifcs;
        const hull = data.hull;
        const numericSize = data.size;
        let sizeStr;
        if (numericSize !== undefined) {
            switch (numericSize) {
                case 1:
                    sizeStr = 'snub';
                    break;
                case 2:
                    sizeStr = 'small';
                    break;
                case 3:
                    sizeStr = 'medium';
                    break;
                case 4:
                    sizeStr = 'large';
                    break;
                case 5:
                    sizeStr = 'sub_capital';
                    break;
                case 6:
                    sizeStr = 'capital';
                    break;
                default:
                    sizeStr = numericSize <= 1 ? 'snub' : 'capital';
                    break;
            }
        }
        const subType = data.subType;
        const isVehicle = subType === 'Vehicle_GroundVehicle';
        if (isVehicle && sizeStr) {
            sizeStr = 'vehicle';
        }
        const loadout = data.loadout;
        const hardpoints = [];
        const weapons = [];
        if (loadout) {
            const weaponCounts = new Map();
            for (const val of Object.values(loadout)) {
                const editable = Boolean(val?.editable);
                if (!editable) {
                    continue;
                }
                const itemTypes = val?.itemTypes;
                const type = itemTypes?.[0]?.type;
                const portName = String(val?.itemPortName || '');
                const maxSize = Number(val?.maxSize || 0);
                if (!type || type === 'Paints' || type === 'Flair_Cockpit' || type === 'SeatAccess') {
                    continue;
                }
                hardpoints.push({ type, size: maxSize, location: portName });
                if (type === 'Turret' || type === 'MissileLauncher' || type === 'WeaponGun') {
                    const key = `${type}-S${maxSize}`;
                    const existing = weaponCounts.get(key);
                    if (existing) {
                        existing.count++;
                    }
                    else {
                        weaponCounts.set(key, { type, size: maxSize, count: 1 });
                    }
                }
            }
            weapons.push(...weaponCounts.values());
        }
        const localName = record.localName;
        const shipData = {
            name: String(name).trim(),
            manufacturer: String(manufacturer).trim(),
            manufacturerCode: mfData?.data?.shortName,
            description: data.description,
            role: vehicle?.role,
            size: sizeStr,
            crew: vehicle?.crewSize,
            mass: hull?.mass,
            cargo: data.cargo,
            speed: ifcs?.scmSpeed,
            afterburnerSpeed: ifcs?.maxSpeed,
            hydrogenFuelCapacity: data.fuelCapacity,
            quantumFuelCapacity: data.qtFuelCapacity,
            isVehicle,
            localName,
            career: vehicle?.career,
            hardpoints: hardpoints.length > 0 ? hardpoints : undefined,
            weapons: weapons.length > 0 ? weapons : undefined,
        };
        return shipData;
    }
    parseFlatShipEntry(entryRecord) {
        const name = entryRecord.name || entryRecord.shipName || entryRecord.Name || entryRecord.ship_name;
        if (!name) {
            return null;
        }
        const manufacturer = entryRecord.manufacturer ||
            entryRecord.make ||
            entryRecord.Manufacturer ||
            entryRecord.manufacturerName ||
            entryRecord.manufacturer_name;
        if (!manufacturer) {
            return null;
        }
        const shipData = {
            name: String(name).trim(),
            manufacturer: String(manufacturer).trim(),
        };
        if (entryRecord.manufacturerCode || entryRecord.manufacturer_code || entryRecord.code) {
            shipData.manufacturerCode = String(entryRecord.manufacturerCode || entryRecord.manufacturer_code || entryRecord.code).trim();
        }
        if (entryRecord.size || entryRecord.Size) {
            shipData.size = String(entryRecord.size || entryRecord.Size)
                .toLowerCase()
                .trim();
        }
        if (entryRecord.role || entryRecord.Role || entryRecord.focus) {
            shipData.role = String(entryRecord.role || entryRecord.Role || entryRecord.focus).trim();
        }
        const numericFields = [
            ['crew', ['crew', 'Crew', 'maxCrew', 'max_crew']],
            ['minCrew', ['minCrew', 'min_crew', 'MinCrew']],
            ['maxCrew', ['maxCrew', 'max_crew', 'MaxCrew']],
            ['mass', ['mass', 'Mass', 'weight']],
            ['cargo', ['cargo', 'Cargo', 'cargoCapacity', 'cargo_capacity']],
            ['speed', ['speed', 'Speed', 'scmSpeed', 'scm_speed']],
            ['afterburnerSpeed', ['afterburnerSpeed', 'afterburner_speed', 'maxSpeed', 'max_speed']],
            ['quantumFuelCapacity', ['quantumFuelCapacity', 'quantum_fuel_capacity', 'quantumFuel']],
            ['hydrogenFuelCapacity', ['hydrogenFuelCapacity', 'hydrogen_fuel_capacity', 'hydrogenFuel']],
        ];
        for (const [field, possibleKeys] of numericFields) {
            for (const key of possibleKeys) {
                if (entryRecord[key] !== undefined &&
                    entryRecord[key] !== null &&
                    entryRecord[key] !== '') {
                    const value = typeof entryRecord[key] === 'number'
                        ? entryRecord[key]
                        : Number.parseFloat(String(entryRecord[key]).replaceAll(/[^0-9.-]/g, ''));
                    if (!Number.isNaN(value)) {
                        shipData[field] = value;
                        break;
                    }
                }
            }
        }
        if (entryRecord.isVehicle !== undefined) {
            shipData.isVehicle = Boolean(entryRecord.isVehicle);
        }
        else if (entryRecord.type) {
            shipData.isVehicle = String(entryRecord.type).toLowerCase().includes('vehicle');
        }
        return shipData;
    }
}
exports.ErkulGamesService = ErkulGamesService;
exports.erkulGamesService = new ErkulGamesService();
//# sourceMappingURL=ErkulGamesService.js.map