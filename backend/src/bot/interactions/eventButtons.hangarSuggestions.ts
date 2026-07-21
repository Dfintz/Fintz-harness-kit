/**
 * Hangar ship-suggestion sourcing for the event bring-ship/crew pickers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the logic
 * that queries a user's hangar and turns it into requirement-aware suggestions its own
 * ownership boundary, separate from the Discord interaction handlers. It is the query
 * side that feeds the pure grouping logic in `eventButtons.hangarGroups.ts`.
 *
 * `getHangarSuggestions` pages through the user's active `UserShip` rows, joins the
 * `Ship` catalogue for role/crew data, matches each ship against the activity's
 * requirements, and returns a sorted `HangarSuggestion[]`. `buildShipOptions` renders
 * that list into Discord select-menu options. `isBundledShipName` and
 * `resolveShipTaxonomy` are the shared helpers behind the suggestion list; the
 * single-ship handler path uses them too. All four are imported back by
 * `eventButtons.ts`; they are not re-exported (no external or test consumers).
 *
 * The module depends only on data/taxonomy collaborators and the `HangarSuggestion`
 * type from the grouping sibling — it never imports `eventButtons.ts`, keeping the
 * import graph acyclic (one-way: handlers → suggestions).
 */
import { AppDataSource } from '../../config/database';
import { Ship } from '../../models/Ship';
import { UserShip } from '../../models/UserShip';
import {
  getShipRoleEmoji,
  SHIP_ROLES,
  shipMatchesRequirement,
  TYPE_TO_ROLE,
  type ShipRequirement,
  type ShipRoleCategory,
} from '../constants/shipTaxonomy';

import { type HangarSuggestion } from './eventButtons.hangarGroups';

/** Batch size for hangar ship queries. */
const HANGAR_QUERY_PAGE_SIZE = 200;

/** Safety cap on number of pages to scan from a user's hangar. */
const HANGAR_QUERY_MAX_PAGES = 25;

const BUNDLED_SHIP_NAME_TOKEN = ' with ';

export function isBundledShipName(shipName: string | null | undefined): boolean {
  if (!shipName) {
    return false;
  }
  return shipName.toLowerCase().includes(BUNDLED_SHIP_NAME_TOKEN);
}

/** Resolve taxonomy role/type from a Ship catalogue entry. */
export function resolveShipTaxonomy(catalogue: Ship | undefined): {
  roleCategory: ShipRoleCategory | undefined;
  shipType: string | undefined;
} {
  let roleCategory: ShipRoleCategory | undefined;
  let shipType: string | undefined;

  if (catalogue?.role) {
    const asType = TYPE_TO_ROLE[catalogue.role];
    if (asType) {
      shipType = catalogue.role;
      roleCategory = asType;
    } else if (SHIP_ROLES.includes(catalogue.role as ShipRoleCategory)) {
      roleCategory = catalogue.role as ShipRoleCategory;
    }
  }

  if (!shipType && catalogue?.roles && catalogue.roles.length > 0) {
    for (const r of catalogue.roles) {
      const parent = TYPE_TO_ROLE[r];
      if (parent) {
        shipType = r;
        roleCategory ??= parent;
        break;
      }
    }
  }

  return { roleCategory, shipType };
}

/**
 * Query a user's hangar and match ships against event requirements.
 *
 * Joins UserShip → Ship catalogue to obtain role and crew data,
 * then checks each ship against the activity's `requiredShipTypes`.
 */
export async function getHangarSuggestions(
  userId: string,
  requirements: ShipRequirement[]
): Promise<HangarSuggestion[]> {
  if (!AppDataSource.isInitialized) {
    return [];
  }

  const userShipRepo = AppDataSource.getRepository(UserShip);
  const shipRepo = AppDataSource.getRepository(Ship);

  // 1. Fetch active hangar ships for this user in pages so large hangars are fully scanned.
  const userShips: UserShip[] = [];
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

  // 2. Batch-load Ship catalogue entries for ships with a catalogue link
  const shipIds = selectableUserShips.map(us => us.shipId).filter((id): id is string => !!id);

  let catalogueMap = new Map<string, Ship>();
  if (shipIds.length > 0) {
    const catalogueShips = await shipRepo
      .createQueryBuilder('ship')
      .where('ship.id IN (:...ids)', { ids: shipIds })
      .getMany();
    catalogueMap = new Map(catalogueShips.map(s => [s.id, s]));
  }

  // 3. Build suggestion list
  const suggestions: HangarSuggestion[] = [];

  for (const us of selectableUserShips) {
    const catalogue = us.shipId ? catalogueMap.get(us.shipId) : undefined;
    const { roleCategory, shipType } = resolveShipTaxonomy(catalogue);

    const maxCrew = catalogue?.maxCrew ?? catalogue?.crew ?? 1;
    // Use || so empty-string customName/shipName fall through to the next fallback
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const displayName = us.customName?.trim() || us.shipName?.trim() || 'Unknown Ship';

    // 4. Match against event requirements
    const matchesRequirement =
      requirements.length === 0 ||
      requirements.some(
        req => req.filled < req.count && shipMatchesRequirement(roleCategory, shipType, req)
      );

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

  // Sort: matching ships first, then alphabetical
  suggestions.sort((a, b) => {
    if (a.matchesRequirement !== b.matchesRequirement) {
      return a.matchesRequirement ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return suggestions;
}

/** Build ship select-menu options from a suggestion list. */
export function buildShipOptions(
  suggestions: HangarSuggestion[]
): Array<{ label: string; description: string; value: string; emoji: string }> {
  return suggestions.map(s => {
    const emoji = s.matchesRequirement ? '✅' : getShipRoleEmoji(s.roleCategory);
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
