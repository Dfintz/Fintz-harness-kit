/**
 * Common helper functions for ship services to reduce query building duplication
 */

import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';


import { ShipCondition, ShipOwnershipStatus } from '../../models/UserShip';

/**
 * Ship filter options that are common between OrganizationShipService and UserShipService
 * Note: These filters apply to owned ships (OrganizationShip/UserShip), not the Ship catalog
 */
export interface CommonShipFilters {
    status?: ShipOwnershipStatus | ShipOwnershipStatus[]; // Ownership status (owned, pledged, loaned, etc.)
    condition?: ShipCondition | ShipCondition[];
    isAvailable?: boolean;
    isCapital?: boolean;
    assignedCaptain?: string;
    location?: string;
    search?: string;
}

/**
 * Apply common ship filters to a query builder
 * Reduces duplication between OrganizationShipService and UserShipService
 */
export function applyCommonShipFilters<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    filters: CommonShipFilters
): void {
    if (filters.status) {
        if (Array.isArray(filters.status)) {
            query.andWhere('ship.status IN (:...statuses)', { statuses: filters.status });
        } else {
            query.andWhere('ship.status = :status', { status: filters.status });
        }
    }

    if (filters.condition) {
        if (Array.isArray(filters.condition)) {
            query.andWhere('ship.condition IN (:...conditions)', { 
                conditions: filters.condition 
            });
        } else {
            query.andWhere('ship.condition = :condition', { condition: filters.condition });
        }
    }

    if (filters.isAvailable !== undefined) {
        query.andWhere('ship.isAvailable = :isAvailable', { 
            isAvailable: filters.isAvailable 
        });
    }

    if (filters.isCapital !== undefined) {
        query.andWhere('ship.isCapital = :isCapital', { 
            isCapital: filters.isCapital 
        });
    }

    if (filters.assignedCaptain) {
        query.andWhere('ship.assignedCaptain = :captain', { 
            captain: filters.assignedCaptain 
        });
    }

    if (filters.location) {
        query.andWhere('ship.location = :location', { location: filters.location });
    }

    if (filters.search) {
        query.andWhere(
            '(ship.shipName ILIKE :search OR ship.customName ILIKE :search OR ship.notes ILIKE :search)',
            { search: `%${filters.search}%` }
        );
    }
}

