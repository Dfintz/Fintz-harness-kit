export declare const SHIP_ROLE_TYPES: {
    readonly Combat: readonly ["Light Fighter", "Medium Fighter", "Heavy Fighter", "Gunship", "Heavy Gunship", "Bomber", "Heavy Bomber", "Corvette", "Frigate", "Destroyer"];
    readonly 'Combat Support': readonly ["Interdictor", "Electronic Warfare", "Boarding", "Dropship", "Heavy Dropship", "Minelayer"];
    readonly Logistics: readonly ["Micro Freight", "Light Freight", "Medium Freight", "Heavy Freight", "Super Freight", "Medium Data", "Landcraft Transport", "Passenger Transport", "Prisoner Transport", "Reporting", "Tractor Beam"];
    readonly Support: readonly ["Medical", "Recovery", "Medium Refuel", "Heavy Refuel", "Snub", "Stealth", "Light Carrier", "Medium Carrier", "Commerce", "Medium Rearm", "Medium Repair", "Heavy Repair"];
    readonly Industrial: readonly ["Light Mining", "Medium Mining", "Heavy Mining", "Super Mining", "Refining", "Light Salvage", "Medium Salvage", "Heavy Salvage", "Light Science", "Heavy Science", "Heavy Construction", "Scanning", "Fabrication"];
    readonly Bespoke: readonly ["Personal Transport", "Racing", "Luxury Touring", "Pathfinder", "Expedition", "Modular"];
};
export type ShipRoleCategory = keyof typeof SHIP_ROLE_TYPES;
export type ShipTypeValue = (typeof SHIP_ROLE_TYPES)[ShipRoleCategory][number];
export declare const SHIP_ROLES: ShipRoleCategory[];
export declare const ALL_SHIP_TYPES: string[];
export declare const TYPE_TO_ROLE: Record<string, ShipRoleCategory>;
export interface ShipRequirement {
    role?: ShipRoleCategory;
    type?: string;
    count: number;
    filled: number;
    strictness: 'required' | 'preferred' | 'flexible';
    loanerAccepted?: boolean;
}
export declare function getShipRoleEmoji(role?: string): string;
export declare function shipMatchesRequirement(shipRole: string | undefined, shipType: string | undefined, req: ShipRequirement): boolean;
//# sourceMappingURL=shipTaxonomy.d.ts.map