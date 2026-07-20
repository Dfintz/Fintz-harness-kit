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
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateShips = exports.loadShipsFromJson = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const typeorm_1 = require("typeorm");
const database_1 = require("../config/database");
const Ship_1 = require("../models/Ship");
const logger_1 = require("../utils/logger");
const loadShipsFromJson = () => {
    try {
        const dataPath = path.join(__dirname, '../data/ships-data.json');
        logger_1.logger.info(`Loading ship data from ${dataPath}...`);
        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        if (!jsonData.ships || !Array.isArray(jsonData.ships)) {
            throw new Error('Invalid JSON structure: expected "ships" array');
        }
        logger_1.logger.info(`Loaded ${jsonData.ships.length} ships from JSON file`);
        return jsonData.ships;
    }
    catch (error) {
        logger_1.logger.error('Error loading ship data from JSON:', error);
        throw error;
    }
};
exports.loadShipsFromJson = loadShipsFromJson;
const mapSize = (sizeStr) => {
    const normalized = sizeStr.toLowerCase().trim();
    if (normalized === 'vehicle' || normalized === 'snub') {
        return normalized === 'vehicle' ? Ship_1.ShipSize.VEHICLE : Ship_1.ShipSize.SNUB;
    }
    else if (normalized === 'small') {
        return Ship_1.ShipSize.SMALL;
    }
    else if (normalized === 'medium') {
        return Ship_1.ShipSize.MEDIUM;
    }
    else if (normalized === 'large') {
        return Ship_1.ShipSize.LARGE;
    }
    else if (normalized === 'capital') {
        return Ship_1.ShipSize.CAPITAL;
    }
    return Ship_1.ShipSize.SMALL;
};
const generateShipId = (name, manufacturer) => `${manufacturer.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}`;
const populateShips = async () => {
    const customDataSource = new typeorm_1.DataSource({
        ...database_1.AppDataSource.options,
        synchronize: false
    });
    try {
        logger_1.logger.info('Starting ship population process...');
        logger_1.logger.info('⚠️  Synchronize disabled to preserve nullable organizationId constraint');
        await customDataSource.initialize();
        logger_1.logger.info('Database connection initialized');
        const shipRepository = customDataSource.getRepository(Ship_1.Ship);
        const shipData = loadShipsFromJson();
        logger_1.logger.info(`Processing ${shipData.length} ships...`);
        let created = 0;
        let updated = 0;
        let skipped = 0;
        for (const data of shipData) {
            try {
                const shipId = generateShipId(data.name, data.manufacturer);
                let ship = await shipRepository.findOne({ where: { id: shipId } });
                if (ship) {
                    ship.name = data.name;
                    ship.manufacturer = data.manufacturer;
                    ship.role = data.role;
                    ship.size = data.size ? mapSize(data.size) : undefined;
                    ship.crew = data.crew;
                    ship.cargo = data.cargo;
                    ship.price = data.price;
                    ship.isVehicle = data.isVehicle;
                    ship.isActive = true;
                    await shipRepository.save(ship);
                    updated++;
                }
                else {
                    ship = shipRepository.create({
                        id: shipId,
                        name: data.name,
                        manufacturer: data.manufacturer,
                        role: data.role,
                        size: data.size ? mapSize(data.size) : undefined,
                        crew: data.crew,
                        cargo: data.cargo,
                        price: data.price,
                        isVehicle: data.isVehicle,
                        status: Ship_1.ShipStatus.FLIGHT_READY,
                        isActive: true
                    });
                    ship.organizationId = null;
                    await shipRepository.save(ship);
                    created++;
                }
                if ((created + updated) % 10 === 0) {
                    logger_1.logger.info(`Progress: ${created} created, ${updated} updated, ${skipped} skipped`);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error processing ship ${data.name}:`, error);
                skipped++;
            }
        }
        logger_1.logger.info('Ship population complete!');
        logger_1.logger.info(`Summary: ${created} created, ${updated} updated, ${skipped} skipped`);
        logger_1.logger.info(`Total ships in database: ${await shipRepository.count()}`);
    }
    catch (error) {
        logger_1.logger.error('Fatal error during ship population:', error);
        throw error;
    }
    finally {
        if (customDataSource.isInitialized) {
            await customDataSource.destroy();
            logger_1.logger.info('Database connection closed');
        }
    }
};
exports.populateShips = populateShips;
if (require.main === module) {
    void (async () => {
        try {
            await populateShips();
            logger_1.logger.info('Script completed successfully');
            process.exit(0);
        }
        catch (error) {
            logger_1.logger.error('Script failed:', error);
            process.exit(1);
        }
    })();
}
//# sourceMappingURL=populate-ships.js.map