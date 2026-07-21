/**
 * Ship Career Display Mapping
 *
 * Transforms raw career values from the ship catalogue (sourced from Erkul)
 * into user-facing display categories used in skill distribution, analytics,
 * and flight-hours aggregation.
 *
 * Categories:
 *   Combat (with sub-categories: Gunship, Capital Crew)
 *   Hauling, Mining, Salvaging, Industrial, Exploration,
 *   Medical, Racing, Driving, Multi-Role
 */

/* ------------------------------------------------------------------ */
/*  Ship-level career overrides                                        */
/*  Ships whose external data source has incorrect/missing careers.     */
/* ------------------------------------------------------------------ */

const SHIP_CAREER_OVERRIDES: Record<string, string> = {
  asgard: 'Gunship',
  'avenger titan': 'Combat',
  'constellation andromeda': 'Combat',
  'mercury star runner': 'Transporter',
  // Teach's Special paint variants — missing career in catalogue
  'fortune teach\'s special': 'Salvaging',
  'golem teach\'s special': 'Mining',
  'nomad teach\'s special': 'Combat',
  'vulture teach\'s special': 'Salvaging',
  'mole teach\'s special': 'Mining',
  'starfarer teach\'s special': 'Hauling',
  'reclaimer teach\'s special': 'Salvaging',
  // Concept ships with RSI Focus but missing career in CSV
  expanse: 'Industrial',
  legionnaire: 'Combat',
  vulcan: 'Medical',
  'hull b': 'Hauling',
  railen: 'Hauling',
  'e1 spirit': 'Hauling',
  'zeus mk ii mr': 'Combat',
  arrastra: 'Mining',
  crucible: 'Medical',
  galaxy: 'Multi-Role',
  genesis: 'Hauling',
  ironclad: 'Hauling',
  'ironclad assault': 'Combat',
  liberator: 'Capital Crew',
  nautilus: 'Combat',
  endeavor: 'Exploration',
  'hull d': 'Hauling',
  kraken: 'Capital Crew',
  'kraken privateer': 'Capital Crew',
  merchantman: 'Hauling',
  odyssey: 'Exploration',
  pioneer: 'Industrial',
  'hull e': 'Hauling',
  javelin: 'Capital Crew',
  orion: 'Mining',
};

/* ------------------------------------------------------------------ */
/*  Simple career renames (no extra context needed)                     */
/* ------------------------------------------------------------------ */

const SIMPLE_RENAMES: Record<string, string> = {
  transporter: 'Hauling',
  support: 'Medical',
  ground: 'Driving',
  'ground combat': 'Driving',
  competition: 'Racing',
  gunship: 'Gunship',
  exploration: 'Exploration',
  'multi-role': 'Multi-Role',
  multirole: 'Multi-Role',
};

/* ------------------------------------------------------------------ */
/*  Capital combat sizes                                               */
/* ------------------------------------------------------------------ */

const CAPITAL_SIZES = new Set(['large', 'sub_capital', 'capital']);

/**
 * Resolve a role string into a career for Industrial or Starter ships.
 */
function resolveRoleBasedCareer(roleLower: string, fallback: string): string {
  if (roleLower.includes('mining') || roleLower.includes('refin')) {
    return 'Mining';
  }
  if (roleLower.includes('salvag')) {
    return 'Salvaging';
  }
  if (roleLower.includes('combat') || roleLower.includes('fighter')) {
    return 'Combat';
  }
  if (
    roleLower.includes('transport') ||
    roleLower.includes('freight') ||
    roleLower.includes('haul')
  ) {
    return 'Hauling';
  }
  if (roleLower.includes('explor') || roleLower.includes('pathfinder')) {
    return 'Exploration';
  }
  if (roleLower.includes('medical')) {
    return 'Medical';
  }
  if (roleLower.includes('racing') || roleLower.includes('competition')) {
    return 'Racing';
  }
  return fallback;
}

/**
 * Resolve a raw ship career from the catalogue into a display category.
 *
 * @param rawCareer  Career string stored in the DB (e.g. "Transporter", "Combat")
 * @param role       Ship role / sub-role (e.g. "Light Fighter", "Mining")
 * @param size       Ship size enum value (e.g. "large", "capital")
 * @param shipName   Human-readable ship name for per-ship overrides
 */
export function resolveDisplayCareer(
  rawCareer: string,
  role?: string,
  size?: string,
  shipName?: string
): string {
  let career = rawCareer;

  // Per-ship overrides take precedence
  if (shipName) {
    const override = SHIP_CAREER_OVERRIDES[shipName.toLowerCase()];
    if (override) {
      career = override;
    }
  }

  const careerLower = career.toLowerCase().trim();
  const roleLower = (role ?? '').toLowerCase();
  const sizeLower = (size ?? '').toLowerCase();

  // Check simple renames first
  const simpleResult = SIMPLE_RENAMES[careerLower];
  if (simpleResult) {
    return simpleResult;
  }

  // Role/size-dependent mappings
  switch (careerLower) {
    case 'industrial':
      if (roleLower.includes('mining') || roleLower.includes('refin')) {
        return 'Mining';
      }
      if (roleLower.includes('salvag')) {
        return 'Salvaging';
      }
      return 'Industrial';

    case 'combat':
      if (CAPITAL_SIZES.has(sizeLower)) {
        return 'Capital Crew';
      }
      return 'Combat';

    case 'starter':
      return resolveRoleBasedCareer(roleLower, 'Combat');

    default:
      // If career is empty/unknown, try to infer from role
      if (!career || career.toLowerCase() === 'unknown') {
        const inferred = resolveRoleBasedCareer(roleLower, '');
        return inferred || 'Unknown';
      }
      return career;
  }
}
