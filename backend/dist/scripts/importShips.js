"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const database_1 = require("../config/database");
const Ship_1 = require("../models/Ship");
const logger_1 = require("../utils/logger");
const toNumber = (val) => {
    if (!val) {
        return undefined;
    }
    const cleaned = String(val)
        .replace(/[,\s]/g, '')
        .replace(/[^0-9.-]/g, '');
    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num) ? undefined : num;
};
const parseDimensions = (dim) => {
    if (!dim) {
        return { length: undefined, beam: undefined, height: undefined };
    }
    const parts = String(dim)
        .split('x')
        .map(p => p.trim());
    const [length, beam, height] = [parts[0], parts[1], parts[2]].map(toNumber);
    return { length, beam, height };
};
const normalizeManufacturer = (m) => {
    if (!m) {
        return undefined;
    }
    return m.replace(/\s*\([^)]*\)\s*/g, '').trim();
};
const mapSize = (size) => {
    if (!size) {
        return undefined;
    }
    const n = String(size).trim().toLowerCase();
    switch (n) {
        case 'vehicle':
            return Ship_1.ShipSize.VEHICLE;
        case 'snub':
            return Ship_1.ShipSize.SNUB;
        case 'small':
        case '1':
            return Ship_1.ShipSize.SMALL;
        case 'medium':
        case '2':
            return Ship_1.ShipSize.MEDIUM;
        case 'large':
        case '4':
            return Ship_1.ShipSize.LARGE;
        case 'capital':
        case '5':
            return Ship_1.ShipSize.CAPITAL;
        default:
            return undefined;
    }
};
const makeId = (name, manufacturer) => {
    const slug = (s) => s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$|(--)+/g, '');
    return `${slug(manufacturer)}:${slug(name)}`;
};
const main = async () => {
    const jsonPathArg = process.argv[2];
    if (!jsonPathArg) {
        logger_1.logger.error('Usage: node dist/scripts/importShips.js <path-to-json>');
        process.exit(1);
    }
    const baseDir = process.cwd();
    const resolvedPath = node_path_1.default.resolve(jsonPathArg);
    if (!resolvedPath.startsWith(baseDir + node_path_1.default.sep) && resolvedPath !== baseDir) {
        logger_1.logger.error(`Path traversal detected: path must be within ${baseDir}`);
        process.exit(1);
    }
    const jsonPath = resolvedPath;
    if (!node_fs_1.default.existsSync(jsonPath)) {
        logger_1.logger.error(`File not found: ${jsonPath}`);
        process.exit(1);
    }
    const raw = node_fs_1.default.readFileSync(jsonPath, 'utf-8');
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch (e) {
        logger_1.logger.error('Invalid JSON file:', e);
        process.exit(1);
    }
    await database_1.AppDataSource.initialize();
    const repo = database_1.AppDataSource.getRepository(Ship_1.Ship);
    let inserted = 0;
    let updated = 0;
    for (const row of data) {
        const name = (row['Name'] || '').trim();
        const manufacturerRaw = (row['Manufacturer'] || '').trim();
        if (!name || !manufacturerRaw) {
            continue;
        }
        const manufacturer = normalizeManufacturer(manufacturerRaw);
        const id = makeId(name, manufacturer);
        const existing = await repo.findOne({ where: { id } });
        const { length, beam, height } = parseDimensions(row['Dimensions']);
        const ship = {
            id,
            name,
            manufacturer,
            role: (row['Role'] || '').trim() || undefined,
            size: mapSize(row['Size']),
            crew: toNumber(row['Crew size']),
            cargo: toNumber(row['Cargo']),
            mass: toNumber(row['Mass']),
            price: toNumber(row['Price']),
            length,
            beam,
            height,
            speed: toNumber(row['SCM speed']),
            afterburnerSpeed: toNumber(row['SCM boost speed forward']),
            hydrogenFuelCapacity: toNumber(row['Hydrogen capacity']),
            quantumFuelCapacity: toNumber(row['QT fuel capacity']),
            shields: toNumber(row['HP']),
            armor: toNumber(row['Armor']),
            isActive: true,
            status: Ship_1.ShipStatus.FLIGHT_READY,
            metadata: {
                career: row['Career'] || undefined,
                shieldFaceType: row['Shield face type'] || undefined,
                cmDecoy: row['CM decoy'] || undefined,
                cmNoise: row['CM noise'] || undefined,
            },
        };
        if (existing) {
            await repo.update({ id }, ship);
            updated++;
        }
        else {
            await repo.insert(ship);
            inserted++;
        }
    }
    logger_1.logger.info(`Import complete. Inserted: ${inserted}, Updated: ${updated}`);
    await database_1.AppDataSource.destroy();
};
main().catch(async (err) => {
    logger_1.logger.error('Import failed:', err);
    try {
        await database_1.AppDataSource.destroy();
    }
    catch {
    }
    process.exit(1);
});
//# sourceMappingURL=importShips.js.map