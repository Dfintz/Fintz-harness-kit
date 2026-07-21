/**
 * Star Citizen Ship Role / Type Taxonomy
 *
 * Source: Official SC ship classification matrix.
 * Each top-level **role** (career focus) maps to an array of specific **types**
 * (sub-roles). When an activity organiser requests a ship they can specify:
 *   - Just the role  → "I need a Combat ship"
 *   - Role + type    → "I need a Light Fighter"
 *   - Flexible       → "Any ship welcome"
 *
 * The `Ship` model's `role` / `roles` columns align with the role name,
 * and the CSV `Role` column aligns with the type string.
 */

/* ------------------------------------------------------------------ */
/*  Role → Type matrix (mirrors the screenshot reference)              */
/* ------------------------------------------------------------------ */

export const SHIP_ROLE_TYPES = {
  Combat: [
    'Light Fighter',
    'Medium Fighter',
    'Heavy Fighter',
    'Gunship',
    'Heavy Gunship',
    'Bomber',
    'Heavy Bomber',
    'Corvette',
    'Frigate',
    'Destroyer',
  ],
  'Combat Support': [
    'Interdictor',
    'Electronic Warfare',
    'Boarding',
    'Dropship',
    'Heavy Dropship',
    'Minelayer',
  ],
  Logistics: [
    'Micro Freight',
    'Light Freight',
    'Medium Freight',
    'Heavy Freight',
    'Super Freight',
    'Medium Data',
    'Landcraft Transport',
    'Passenger Transport',
    'Prisoner Transport',
    'Reporting',
    'Tractor Beam',
  ],
  Support: [
    'Medical',
    'Recovery',
    'Medium Refuel',
    'Heavy Refuel',
    'Snub',
    'Stealth',
    'Light Carrier',
    'Medium Carrier',
    'Commerce',
    'Medium Rearm',
    'Medium Repair',
    'Heavy Repair',
  ],
  Industrial: [
    'Light Mining',
    'Medium Mining',
    'Heavy Mining',
    'Super Mining',
    'Refining',
    'Light Salvage',
    'Medium Salvage',
    'Heavy Salvage',
    'Light Science',
    'Heavy Science',
    'Heavy Construction',
    'Scanning',
    'Fabrication',
  ],
  Bespoke: [
    'Personal Transport',
    'Racing',
    'Luxury Touring',
    'Pathfinder',
    'Expedition',
    'Modular',
  ],
} as const;

/** Top-level role names. */
export type ShipRoleCategory = keyof typeof SHIP_ROLE_TYPES;

/** All valid type strings across every role. */
export type ShipTypeValue = (typeof SHIP_ROLE_TYPES)[ShipRoleCategory][number];

/** Runtime arrays for iteration / select menus. */
export const SHIP_ROLES = Object.keys(SHIP_ROLE_TYPES) as ShipRoleCategory[];

/** Flat list of every type string. */
export const ALL_SHIP_TYPES: string[] = Object.values(SHIP_ROLE_TYPES).flat();

/** Lookup: type string → parent role. */
export const TYPE_TO_ROLE: Record<string, ShipRoleCategory> = {};
for (const [role, types] of Object.entries(SHIP_ROLE_TYPES)) {
  for (const t of types) {
    TYPE_TO_ROLE[t] = role as ShipRoleCategory;
  }
}

/* ------------------------------------------------------------------ */
/*  Ship Requirement (what the activity/job listing needs)             */
/* ------------------------------------------------------------------ */

export interface ShipRequirement {
  /** Top-level role (e.g. "Combat").  Omit for *any* role.  */
  role?: ShipRoleCategory;
  /** Specific type (e.g. "Light Fighter").  Omit for *any* type within the role. */
  type?: string;
  /** How many ships of this spec are needed (default 1). */
  count: number;
  /** How many have been volunteered so far. */
  filled: number;
  /** How strict the requirement is. */
  strictness: 'required' | 'preferred' | 'flexible';
  /** Whether loaner / borrowed ships are accepted. */
  loanerAccepted?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Emoji helpers for the embed                                        */
/* ------------------------------------------------------------------ */

const ROLE_EMOJI: Record<string, string> = {
  Combat: '⚔️',
  'Combat Support': '🛡️',
  Logistics: '📦',
  Support: '🩹',
  Industrial: '⛏️',
  Bespoke: '🔮',
};

/** Return a role-appropriate emoji (falls back to 🚀). */
export function getShipRoleEmoji(role?: string): string {
  if (!role) {
    return '🚀';
  }
  return ROLE_EMOJI[role] ?? '🚀';
}

/* ------------------------------------------------------------------ */
/*  Matching helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Check whether a volunteered ship satisfies a requirement.
 * Matches on role and/or type — `undefined` means wildcard.
 *
 * Role matching uses **exact equality** (case-insensitive) to prevent
 * "Combat" from incorrectly matching "Combat Support".
 * Type matching uses **includes** because the stored `shipType` may have
 * the role appended, e.g. "Light Fighter (Combat)".
 */
export function shipMatchesRequirement(
  shipRole: string | undefined,
  shipType: string | undefined,
  req: ShipRequirement
): boolean {
  // If the requirement specifies a role, the ship's role must match exactly
  if (req.role) {
    if (!shipRole) {
      return false;
    }
    const normalised = shipRole.toLowerCase().trim();
    const reqNormalised = req.role.toLowerCase().trim();
    // Exact match — "combat" !== "combat support"
    if (normalised !== reqNormalised) {
      return false;
    }
  }

  // If the requirement specifies a type, check substring (stored type may include role suffix)
  if (req.type) {
    if (!shipType) {
      return false;
    }
    const normalised = shipType.toLowerCase().trim();
    const reqNormalised = req.type.toLowerCase().trim();
    if (!normalised.includes(reqNormalised) && normalised !== reqNormalised) {
      return false;
    }
  }

  return true;
}
