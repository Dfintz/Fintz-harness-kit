import * as fs from 'fs';
import * as path from 'path';

import { DataSource } from 'typeorm';

import { AppDataSource } from '../config/database';
import { Ship, ShipSize, ShipStatus } from '../models/Ship';
import { logger } from '../utils/logger';


interface ShipData {
    name: string;
    manufacturer: string;
    role?: string;
    size?: string;
    crew?: number;
    cargo?: number;
    price?: number;
    isVehicle: boolean;
}

/**
 * Load ship data from JSON file
 */
const loadShipsFromJson = (): ShipData[] => {
    try {
        const dataPath = path.join(__dirname, '../data/ships-data.json');
        logger.info(`Loading ship data from ${dataPath}...`);
        
        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        
        if (!jsonData.ships || !Array.isArray(jsonData.ships)) {
            throw new Error('Invalid JSON structure: expected "ships" array');
        }
        
        logger.info(`Loaded ${jsonData.ships.length} ships from JSON file`);
        return jsonData.ships;
    } catch (error) {
        logger.error('Error loading ship data from JSON:', error);
        throw error;
    }
};

/**
 * Map size string to ShipSize enum
 */
const mapSize = (sizeStr: string): ShipSize => {
    const normalized = sizeStr.toLowerCase().trim();
    
    if (normalized === 'vehicle' || normalized === 'snub') {
        return normalized === 'vehicle' ? ShipSize.VEHICLE : ShipSize.SNUB;
    } else if (normalized === 'small') {
        return ShipSize.SMALL;
    } else if (normalized === 'medium') {
        return ShipSize.MEDIUM;
    } else if (normalized === 'large') {
        return ShipSize.LARGE;
    } else if (normalized === 'capital') {
        return ShipSize.CAPITAL;
    }
    
    return ShipSize.SMALL; // Default
};

/**
 * Generate a unique ID for a ship
 */
const generateShipId = (name: string, manufacturer: string): string => `${manufacturer.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}`;

/**
 * Populate ships in the database
 */
const populateShips = async (): Promise<void> => {
    // Create a custom DataSource with synchronize disabled to prevent schema overwrites
    const customDataSource = new DataSource({
        ...AppDataSource.options,
        synchronize: false // CRITICAL: Disable synchronize to preserve manual schema changes
    });
    
    try {
        logger.info('Starting ship population process...');
        logger.info('⚠️  Synchronize disabled to preserve nullable organizationId constraint');
        
        // Initialize database connection
        await customDataSource.initialize();
        logger.info('Database connection initialized');
        
        const shipRepository = customDataSource.getRepository(Ship);
        
        // Load ship data from JSON file
        const shipData = loadShipsFromJson();
        
        logger.info(`Processing ${shipData.length} ships...`);
        
        let created = 0;
        let updated = 0;
        let skipped = 0;
        
        for (const data of shipData) {
            try {
                const shipId = generateShipId(data.name, data.manufacturer);
                
                // Check if ship already exists
                let ship = await shipRepository.findOne({ where: { id: shipId } });
                
                if (ship) {
                    // Update existing ship
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
                } else {
                    // Create new ship with explicit null organizationId (reference catalog ship)
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
                        status: ShipStatus.FLIGHT_READY,
                        isActive: true
                    });
                    
                    // Explicitly set organizationId to null for reference ships
                    (ship as unknown as Record<string, unknown>).organizationId = null;
                    
                    await shipRepository.save(ship);
                    created++;
                }
                
                if ((created + updated) % 10 === 0) {
                    logger.info(`Progress: ${created} created, ${updated} updated, ${skipped} skipped`);
                }
                
            } catch (error) {
                logger.error(`Error processing ship ${data.name}:`, error);
                skipped++;
            }
        }
        
        logger.info('Ship population complete!');
        logger.info(`Summary: ${created} created, ${updated} updated, ${skipped} skipped`);
        logger.info(`Total ships in database: ${await shipRepository.count()}`);
        
    } catch (error) {
        logger.error('Fatal error during ship population:', error);
        throw error;
    } finally {
        if (customDataSource.isInitialized) {
            await customDataSource.destroy();
            logger.info('Database connection closed');
        }
    }
}

// Run the script
if (require.main === module) {
    void (async () => {
        try {
            await populateShips();
            logger.info('Script completed successfully');
            process.exit(0);
        } catch (error) {
            logger.error('Script failed:', error);
            process.exit(1);
        }
    })();
}

export { loadShipsFromJson, populateShips };

