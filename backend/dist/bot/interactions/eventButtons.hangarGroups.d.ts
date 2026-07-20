import { type ShipRoleCategory } from '../constants/shipTaxonomy';
export declare const MAX_HANGAR_OPTIONS = 24;
export interface HangarSuggestion {
    userShipId: string;
    displayName: string;
    catalogueName: string;
    roleCategory?: ShipRoleCategory;
    shipType?: string;
    maxCrew: number;
    matchesRequirement: boolean;
}
export interface HangarGroup {
    key: string;
    label: string;
    emoji: string;
    ships: HangarSuggestion[];
}
export declare function buildHangarGroups(suggestions: HangarSuggestion[]): HangarGroup[];
//# sourceMappingURL=eventButtons.hangarGroups.d.ts.map