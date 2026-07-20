"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCommonShipFilters = applyCommonShipFilters;
function applyCommonShipFilters(query, filters) {
    if (filters.status) {
        if (Array.isArray(filters.status)) {
            query.andWhere('ship.status IN (:...statuses)', { statuses: filters.status });
        }
        else {
            query.andWhere('ship.status = :status', { status: filters.status });
        }
    }
    if (filters.condition) {
        if (Array.isArray(filters.condition)) {
            query.andWhere('ship.condition IN (:...conditions)', {
                conditions: filters.condition
            });
        }
        else {
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
        query.andWhere('(ship.shipName ILIKE :search OR ship.customName ILIKE :search OR ship.notes ILIKE :search)', { search: `%${filters.search}%` });
    }
}
//# sourceMappingURL=shipServiceHelpers.js.map