"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBundledShipName = isBundledShipName;
exports.resolveShipTaxonomy = resolveShipTaxonomy;
exports.getHangarSuggestions = getHangarSuggestions;
exports.buildShipOptions = buildShipOptions;
const database_1 = require("../../config/database");
const Ship_1 = require("../../models/Ship");
const UserShip_1 = require("../../models/UserShip");
const shipTaxonomy_1 = require("../constants/shipTaxonomy");
const HANGAR_QUERY_PAGE_SIZE = 200;
const HANGAR_QUERY_MAX_PAGES = 25;
const BUNDLED_SHIP_NAME_TOKEN = ' with ';
function isBundledShipName(shipName) {
    if (!shipName) {
        return false;
    }
    return shipName.toLowerCase().includes(BUNDLED_SHIP_NAME_TOKEN);
}
function resolveShipTaxonomy(catalogue) {
    let roleCategory;
    let shipType;
    if (catalogue?.role) {
        const asType = shipTaxonomy_1.TYPE_TO_ROLE[catalogue.role];
        if (asType) {
            shipType = catalogue.role;
            roleCategory = asType;
        }
        else if (shipTaxonomy_1.SHIP_ROLES.includes(catalogue.role)) {
            roleCategory = catalogue.role;
        }
    }
    if (!shipType && catalogue?.roles && catalogue.roles.length > 0) {
        for (const r of catalogue.roles) {
            const parent = shipTaxonomy_1.TYPE_TO_ROLE[r];
            if (parent) {
                shipType = r;
                roleCategory ??= parent;
                break;
            }
        }
    }
    return { roleCategory, shipType };
}
async function getHangarSuggestions(userId, requirements) {
    if (!database_1.AppDataSource.isInitialized) {
        return [];
    }
    const userShipRepo = database_1.AppDataSource.getRepository(UserShip_1.UserShip);
    const shipRepo = database_1.AppDataSource.getRepository(Ship_1.Ship);
    const userShips = [];
    for (let page = 0; page < HANGAR_QUERY_MAX_PAGES; page += 1) {
        const batch = await userShipRepo.find({
            where: { userId, isActive: true },
            skip: page * HANGAR_QUERY_PAGE_SIZE,
            take: HANGAR_QUERY_PAGE_SIZE,
            order: { shipName: 'ASC', id: 'ASC' },
        });
        if (batch.length === 0) {
            break;
        }
        userShips.push(...batch);
        if (batch.length < HANGAR_QUERY_PAGE_SIZE) {
            break;
        }
    }
    if (userShips.length === 0) {
        return [];
    }
    const selectableUserShips = userShips.filter(us => !isBundledShipName(us.shipName));
    if (selectableUserShips.length === 0) {
        return [];
    }
    const shipIds = selectableUserShips.map(us => us.shipId).filter((id) => !!id);
    let catalogueMap = new Map();
    if (shipIds.length > 0) {
        const catalogueShips = await shipRepo
            .createQueryBuilder('ship')
            .where('ship.id IN (:...ids)', { ids: shipIds })
            .getMany();
        catalogueMap = new Map(catalogueShips.map(s => [s.id, s]));
    }
    const suggestions = [];
    for (const us of selectableUserShips) {
        const catalogue = us.shipId ? catalogueMap.get(us.shipId) : undefined;
        const { roleCategory, shipType } = resolveShipTaxonomy(catalogue);
        const maxCrew = catalogue?.maxCrew ?? catalogue?.crew ?? 1;
        const displayName = us.customName?.trim() || us.shipName?.trim() || 'Unknown Ship';
        const matchesRequirement = requirements.length === 0 ||
            requirements.some(req => req.filled < req.count && (0, shipTaxonomy_1.shipMatchesRequirement)(roleCategory, shipType, req));
        suggestions.push({
            userShipId: us.id,
            displayName,
            catalogueName: us.shipName ?? 'Unknown',
            roleCategory,
            shipType,
            maxCrew,
            matchesRequirement,
        });
    }
    suggestions.sort((a, b) => {
        if (a.matchesRequirement !== b.matchesRequirement) {
            return a.matchesRequirement ? -1 : 1;
        }
        return a.displayName.localeCompare(b.displayName);
    });
    return suggestions;
}
function buildShipOptions(suggestions) {
    return suggestions.map(s => {
        const emoji = s.matchesRequirement ? '✅' : (0, shipTaxonomy_1.getShipRoleEmoji)(s.roleCategory);
        const roleLabel = s.roleCategory ? ` • ${s.roleCategory}` : '';
        const typeLabel = s.shipType ? ` (${s.shipType})` : '';
        const crewLabel = s.maxCrew > 1 ? ` • ${s.maxCrew} crew` : '';
        return {
            label: s.displayName.slice(0, 100),
            description: `${s.catalogueName}${typeLabel}${roleLabel}${crewLabel}`.slice(0, 100),
            value: s.userShipId,
            emoji,
        };
    });
}
//# sourceMappingURL=eventButtons.hangarSuggestions.js.map