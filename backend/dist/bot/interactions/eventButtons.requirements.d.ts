import { type ShipRequirement } from '../constants/shipTaxonomy';
export declare function parseRequiredShipTypes(raw: string | null | undefined): ShipRequirement[];
export declare function computeFilledCounts(reqs: ShipRequirement[], ships: Array<{
    id?: string;
    ownerId: string;
    shipType: string;
    role?: string;
}>): void;
//# sourceMappingURL=eventButtons.requirements.d.ts.map