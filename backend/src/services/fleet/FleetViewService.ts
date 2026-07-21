import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { Ship, ShipStatus } from '../../models/Ship';
import {
    FleetViewExportOptions,
    FleetViewImportOptions,
    FleetViewImportResult,
    FleetViewSchema,
    FleetViewShip
} from '../../types/fleetview';

/**
 * Service for converting between FleetView schema and internal Ship model
 * Used for importing/exporting fleet data to hangar.link/fleet/canvas
 */
export class FleetViewService {
    private shipRepository = AppDataSource.getRepository(Ship);

    /**
     * Export ships to FleetView schema format
     */
    async exportToFleetView(options: FleetViewExportOptions): Promise<FleetViewSchema> {
        const { organizationId, userId, includeStatistics = true, includeInactive = false } = options;

        // Build query
        const queryBuilder = this.shipRepository.createQueryBuilder('ship');
        
        if (organizationId) {
            queryBuilder.where('ship.organizationId = :organizationId', { organizationId });
        } else if (userId) {
            // For personal fleet, use user's default organization
            queryBuilder.where('ship.organizationId = :organizationId', { organizationId: `user-${userId}` });
        }

        if (!includeInactive) {
            queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
        }

        const ships = await queryBuilder.getMany();

        // Convert ships to FleetView format
        const fleetViewShips: FleetViewShip[] = ships.map((ship: Ship) => this.shipToFleetView(ship));

        const schema: FleetViewSchema = {
            version: '1.0',
            updated: new Date().toISOString(),
            ships: fleetViewShips
        };

        // Add statistics if requested
        if (includeStatistics) {
            schema.statistics = this.calculateStatistics(ships);
        }

        return schema;
    }

    /**
     * Import ships from FleetView schema format
     */
    async importFromFleetView(
        schema: FleetViewSchema, 
        options: FleetViewImportOptions
    ): Promise<FleetViewImportResult> {
        const { skipDuplicates = true, organizationId, userId } = options;
        const result: FleetViewImportResult = {
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
            ships: []
        };

        // If not merging, we could delete existing ships first (commented out for safety)
        // if (!merge) {
        //     await this.shipRepository.delete({ organizationId });
        // }

        for (const fleetViewShip of schema.ships) {
            try {
                const shipName = fleetViewShip.name;
                const manufacturer = fleetViewShip.manufacturer || 'Unknown';

                // Check for duplicates
                if (skipDuplicates) {
                    const existingShip = await this.shipRepository.findOne({
                        where: {
                            name: shipName,
                            manufacturer,
                            organizationId
                        }
                    });

                    if (existingShip) {
                        result.skipped++;
                        result.ships.push({
                            name: shipName,
                            status: 'skipped',
                            message: 'Ship already exists'
                        });
                        continue;
                    }
                }

                // Create new ship
                const ship = this.fleetViewToShip(fleetViewShip, organizationId, userId);
                await this.shipRepository.save(ship);

                result.imported++;
                result.ships.push({
                    name: shipName,
                    status: 'imported'
                });

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Failed to import ${fleetViewShip.name}: ${errorMessage}`);
                result.ships.push({
                    name: fleetViewShip.name,
                    status: 'error',
                    message: errorMessage
                });
            }
        }

        result.success = result.errors.length === 0;
        return result;
    }

    /**
     * Convert internal Ship model to FleetView format
     */
    private shipToFleetView(ship: Ship): FleetViewShip {
        const fleetViewShip: FleetViewShip = {
            name: ship.name,
            manufacturer: ship.manufacturer,
            kind: ship.role || undefined,
            owned: 1, // Default to 1, could be extended to track quantity
            notes: ship.description || undefined,
        };

        // Map LTI from metadata if available
        if (ship.metadata && typeof ship.metadata === 'object') {
            if ('lti' in ship.metadata) {
                fleetViewShip.lti = ship.metadata.lti as boolean;
            }
            if ('warbond' in ship.metadata) {
                fleetViewShip.warbond = ship.metadata.warbond as boolean;
            }
            if ('tags' in ship.metadata && Array.isArray(ship.metadata.tags)) {
                fleetViewShip.tags = ship.metadata.tags;
            }
        }

        // Add cost information
        if (ship.pledgePrice) {
            fleetViewShip.cost = ship.pledgePrice;
        } else if (ship.price) {
            fleetViewShip.cost = Number(ship.price);
        }

        return fleetViewShip;
    }

    /**
     * Convert FleetView format to internal Ship model
     */
    private fleetViewToShip(fleetViewShip: FleetViewShip, organizationId: string, _userId: string): Ship {
        const shipId = this.generateShipId(fleetViewShip.name, fleetViewShip.manufacturer || 'Unknown');
        
        const ship = new Ship();
        ship.id = shipId;
        ship.name = fleetViewShip.name;
        ship.manufacturer = fleetViewShip.manufacturer || 'Unknown';
        ship.role = fleetViewShip.kind || undefined;
        ship.description = fleetViewShip.notes || undefined;
        ship.organizationId = organizationId;
        ship.status = ShipStatus.FLIGHT_READY;
        ship.isActive = true;

        // Store FleetView-specific data in metadata
        ship.metadata = {
            importedFromFleetView: true,
            importDate: new Date().toISOString(),
            lti: fleetViewShip.lti || false,
            warbond: fleetViewShip.warbond || false,
            pledge: fleetViewShip.pledge,
            tags: fleetViewShip.tags || []
        };

        // Set price information
        if (fleetViewShip.cost) {
            ship.pledgePrice = fleetViewShip.cost;
            ship.price = fleetViewShip.cost;
        }

        return ship;
    }

    /**
     * Calculate statistics for exported fleet
     */
    private calculateStatistics(ships: Ship[]): FleetViewSchema['statistics'] {
        const stats = {
            totalShips: ships.length,
            totalValue: 0,
            manufacturers: {} as Record<string, number>,
            roles: {} as Record<string, number>
        };

        for (const ship of ships) {
            // Calculate total value
            if (ship.pledgePrice) {
                stats.totalValue += ship.pledgePrice;
            } else if (ship.price) {
                stats.totalValue += Number(ship.price);
            }

            // Count manufacturers
            const manufacturer = ship.manufacturer || 'Unknown';
            stats.manufacturers[manufacturer] = (stats.manufacturers[manufacturer] || 0) + 1;

            // Count roles
            const role = ship.role || 'Unknown';
            stats.roles[role] = (stats.roles[role] || 0) + 1;
        }

        return stats;
    }

    /**
     * Generate a unique ship ID from name and manufacturer
     */
    private generateShipId(name: string, manufacturer: string): string {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const cleanManufacturer = manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const uniqueSuffix = uuidv4().split('-')[0];
        return `${cleanManufacturer}-${cleanName}-${uniqueSuffix}`;
    }

    /**
     * Validate FleetView schema structure
     */
    validateSchema(schema: unknown): schema is FleetViewSchema {
        if (!schema || typeof schema !== 'object') {
            return false;
        }

        if (!Array.isArray((schema as Record<string, unknown>).ships)) {
            return false;
        }

        // Validate each ship has at minimum a name
        for (const ship of (schema as Record<string, unknown>).ships as Array<Record<string, unknown>>) {
            if (!ship.name || typeof ship.name !== 'string') {
                return false;
            }
        }

        return true;
    }
}

