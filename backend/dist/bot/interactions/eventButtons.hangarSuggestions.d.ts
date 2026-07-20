import { Ship } from '../../models/Ship';
import { type ShipRequirement, type ShipRoleCategory } from '../constants/shipTaxonomy';
import { type HangarSuggestion } from './eventButtons.hangarGroups';
export declare function isBundledShipName(shipName: string | null | undefined): boolean;
export declare function resolveShipTaxonomy(catalogue: Ship | undefined): {
    roleCategory: ShipRoleCategory | undefined;
    shipType: string | undefined;
};
export declare function getHangarSuggestions(userId: string, requirements: ShipRequirement[]): Promise<HangarSuggestion[]>;
export declare function buildShipOptions(suggestions: HangarSuggestion[]): Array<{
    label: string;
    description: string;
    value: string;
    emoji: string;
}>;
//# sourceMappingURL=eventButtons.hangarSuggestions.d.ts.map