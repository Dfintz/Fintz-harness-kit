import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { ShipCondition, ShipOwnershipStatus } from '../../models/UserShip';
export interface CommonShipFilters {
    status?: ShipOwnershipStatus | ShipOwnershipStatus[];
    condition?: ShipCondition | ShipCondition[];
    isAvailable?: boolean;
    isCapital?: boolean;
    assignedCaptain?: string;
    location?: string;
    search?: string;
}
export declare function applyCommonShipFilters<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, filters: CommonShipFilters): void;
//# sourceMappingURL=shipServiceHelpers.d.ts.map