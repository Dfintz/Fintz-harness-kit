/**
 * Star Citizen system location data with 2D map coordinates.
 *
 * Map coordinates use an 800×800 SVG viewBox with Stanton at centre (400,400).
 * Positions are approximate top-down projections of the Stanton system layout.
 *
 * VerseGuide URL pattern: https://verseguide.com/location/STANTON/{code}#{name}
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StarSystemLocation {
  readonly code: string;
  readonly name: string;
  readonly type: 'star' | 'planet' | 'moon' | 'station' | 'lagrange' | 'city' | 'jump_point';
  readonly parent?: string;
  /** X position on the 800×800 system map SVG */
  readonly mapX: number;
  /** Y position on the 800×800 system map SVG */
  readonly mapY: number;
}

export interface SystemArea {
  readonly name: string;
  readonly type: 'asteroid-belt';
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
}

export interface StarSystem {
  readonly id: string;
  readonly name: string;
  readonly locations: readonly StarSystemLocation[];
  readonly areas: readonly SystemArea[];
}

/** Constant for the map SVG viewBox dimension */
export const MAP_SIZE = 800;
/** Centre of the map */
export const MAP_CENTER = MAP_SIZE / 2;

// ---------------------------------------------------------------------------
// Stanton System — locations with map coordinates
// ---------------------------------------------------------------------------

export const STANTON_LOCATIONS: readonly StarSystemLocation[] = [
  // ── Star ────────────────────────────────────────────────────────────────
  { code: '0', name: 'Stanton', type: 'star', mapX: 400, mapY: 400 },

  // ── Hurston (Planet I — inner orbit) ────────────────────────────────────
  { code: '1', name: 'Hurston', type: 'planet', mapX: 505, mapY: 300 },
  { code: '1A', name: 'Arial', type: 'moon', parent: 'Hurston', mapX: 528, mapY: 282 },
  { code: '1B', name: 'Aberdeen', type: 'moon', parent: 'Hurston', mapX: 485, mapY: 278 },
  { code: '1C', name: 'Magda', type: 'moon', parent: 'Hurston', mapX: 530, mapY: 310 },
  { code: '1D', name: 'Ita', type: 'moon', parent: 'Hurston', mapX: 488, mapY: 318 },

  // Hurston stations & cities
  { code: 'S1', name: 'Everus Harbor', type: 'station', parent: 'Hurston', mapX: 512, mapY: 288 },
  { code: 'C1', name: 'Lorville', type: 'city', parent: 'Hurston', mapX: 498, mapY: 308 },

  // ── Crusader (Planet II) ────────────────────────────────────────────────
  { code: '2', name: 'Crusader', type: 'planet', mapX: 230, mapY: 350 },
  { code: '2A', name: 'Cellin', type: 'moon', parent: 'Crusader', mapX: 252, mapY: 332 },
  { code: '2B', name: 'Daymar', type: 'moon', parent: 'Crusader', mapX: 208, mapY: 340 },
  { code: '2C', name: 'Yela', type: 'moon', parent: 'Crusader', mapX: 230, mapY: 322 },

  // Crusader stations & cities
  {
    code: 'S2',
    name: 'Seraphim Station',
    type: 'station',
    parent: 'Crusader',
    mapX: 237,
    mapY: 338,
  },
  { code: 'C2', name: 'Orison', type: 'city', parent: 'Crusader', mapX: 223, mapY: 358 },
  { code: 'S5', name: 'Grim HEX', type: 'station', parent: 'Crusader', mapX: 218, mapY: 310 },

  // ── ArcCorp (Planet III) ────────────────────────────────────────────────
  { code: '3', name: 'ArcCorp', type: 'planet', mapX: 250, mapY: 600 },
  { code: '3A', name: 'Lyria', type: 'moon', parent: 'ArcCorp', mapX: 272, mapY: 582 },
  { code: '3B', name: 'Wala', type: 'moon', parent: 'ArcCorp', mapX: 228, mapY: 586 },

  // ArcCorp stations & cities
  { code: 'S3', name: 'Baijini Point', type: 'station', parent: 'ArcCorp', mapX: 256, mapY: 588 },
  { code: 'C3', name: 'Area18', type: 'city', parent: 'ArcCorp', mapX: 243, mapY: 610 },

  // ── microTech (Planet IV — outer orbit) ─────────────────────────────────
  { code: '4', name: 'microTech', type: 'planet', mapX: 660, mapY: 580 },
  { code: '4A', name: 'Calliope', type: 'moon', parent: 'microTech', mapX: 682, mapY: 562 },
  { code: '4B', name: 'Clio', type: 'moon', parent: 'microTech', mapX: 638, mapY: 566 },
  { code: '4C', name: 'Euterpe', type: 'moon', parent: 'microTech', mapX: 662, mapY: 604 },

  // microTech stations & cities
  { code: 'S4', name: 'Port Tressler', type: 'station', parent: 'microTech', mapX: 666, mapY: 568 },
  { code: 'C4', name: 'New Babbage', type: 'city', parent: 'microTech', mapX: 653, mapY: 590 },

  // ── Lagrange Points / Rest Stops ────────────────────────────────────────
  // Hurston Lagrange
  { code: 'L1', name: 'HUR-L1', type: 'lagrange', parent: 'Hurston', mapX: 455, mapY: 348 },
  { code: 'L2', name: 'HUR-L2', type: 'lagrange', parent: 'Hurston', mapX: 545, mapY: 258 },
  { code: 'L9', name: 'HUR-L3', type: 'lagrange', parent: 'Hurston', mapX: 370, mapY: 235 },
  { code: 'L10', name: 'HUR-L4', type: 'lagrange', parent: 'Hurston', mapX: 560, mapY: 345 },
  { code: 'L11', name: 'HUR-L5', type: 'lagrange', parent: 'Hurston', mapX: 465, mapY: 260 },

  // Crusader Lagrange
  { code: 'L3', name: 'CRU-L1', type: 'lagrange', parent: 'Crusader', mapX: 315, mapY: 375 },
  { code: 'L12', name: 'CRU-L3', type: 'lagrange', parent: 'Crusader', mapX: 155, mapY: 310 },
  { code: 'L4', name: 'CRU-L4', type: 'lagrange', parent: 'Crusader', mapX: 180, mapY: 400 },
  { code: 'L5', name: 'CRU-L5', type: 'lagrange', parent: 'Crusader', mapX: 280, mapY: 290 },

  // ArcCorp Lagrange
  { code: 'L6', name: 'ARC-L1', type: 'lagrange', parent: 'ArcCorp', mapX: 325, mapY: 500 },
  { code: 'L13', name: 'ARC-L2', type: 'lagrange', parent: 'ArcCorp', mapX: 175, mapY: 700 },
  { code: 'L14', name: 'ARC-L3', type: 'lagrange', parent: 'ArcCorp', mapX: 145, mapY: 570 },
  { code: 'L15', name: 'ARC-L4', type: 'lagrange', parent: 'ArcCorp', mapX: 190, mapY: 660 },
  { code: 'L16', name: 'ARC-L5', type: 'lagrange', parent: 'ArcCorp', mapX: 305, mapY: 650 },

  // microTech Lagrange
  { code: 'L7', name: 'MIC-L1', type: 'lagrange', parent: 'microTech', mapX: 530, mapY: 490 },
  { code: 'L8', name: 'MIC-L2', type: 'lagrange', parent: 'microTech', mapX: 730, mapY: 630 },
  { code: 'L17', name: 'MIC-L3', type: 'lagrange', parent: 'microTech', mapX: 755, mapY: 530 },
  { code: 'L18', name: 'MIC-L4', type: 'lagrange', parent: 'microTech', mapX: 690, mapY: 650 },
  { code: 'L19', name: 'MIC-L5', type: 'lagrange', parent: 'microTech', mapX: 600, mapY: 540 },

  // ── Jump Points ──────────────────────────────────────────────────────────
  { code: 'JP1', name: 'Stanton–Pyro JP', type: 'jump_point', mapX: 175, mapY: 470 },
  { code: 'JP2', name: 'Stanton–Magnus JP', type: 'jump_point', mapX: 680, mapY: 260 },
  { code: 'JP3', name: 'Stanton–Terra JP', type: 'jump_point', mapX: 620, mapY: 700 },
  { code: 'JP4', name: 'Stanton–Nyx JP', type: 'jump_point', mapX: 750, mapY: 450 },
];

/** Stanton system areas (asteroid belts, exclusion zones) */
export const STANTON_AREAS: readonly SystemArea[] = [
  { name: 'Aaron Halo', type: 'asteroid-belt', centerX: 400, centerY: 400, radius: 215 },
];

// ---------------------------------------------------------------------------
// Pyro System
// ---------------------------------------------------------------------------

export const PYRO_LOCATIONS: readonly StarSystemLocation[] = [
  { code: '0', name: 'Pyro', type: 'star', mapX: 400, mapY: 400 },

  // ── Pyro I (innermost) ──────────────────────────────────────────────────
  { code: '1', name: 'Pyro I', type: 'planet', mapX: 460, mapY: 340 },

  // ── Monox (Pyro II) ────────────────────────────────────────────────────
  { code: '2', name: 'Monox (Pyro II)', type: 'planet', mapX: 290, mapY: 310 },
  { code: '2A', name: 'Vuur', type: 'moon', parent: 'Monox (Pyro II)', mapX: 272, mapY: 300 },

  // ── Bloom (Pyro III) ───────────────────────────────────────────────────
  { code: '3', name: 'Bloom (Pyro III)', type: 'planet', mapX: 220, mapY: 500 },

  // ── Pyro IV ────────────────────────────────────────────────────────────
  { code: '4', name: 'Pyro IV', type: 'planet', mapX: 350, mapY: 620 },
  { code: '4A', name: 'Ignis', type: 'moon', parent: 'Pyro IV', mapX: 370, mapY: 636 },

  // ── Pyro V ─────────────────────────────────────────────────────────────
  { code: '5', name: 'Pyro V', type: 'planet', mapX: 560, mapY: 600 },
  { code: '5A', name: 'Adir', type: 'moon', parent: 'Pyro V', mapX: 580, mapY: 614 },
  { code: '5B', name: 'Fairo', type: 'moon', parent: 'Pyro V', mapX: 544, mapY: 616 },

  // ── Terminus (Pyro VI — outermost) ──────────────────────────────────────
  { code: '6', name: 'Terminus (Pyro VI)', type: 'planet', mapX: 680, mapY: 440 },

  // ── Stations ───────────────────────────────────────────────────────────
  {
    code: 'S1',
    name: 'Ruin Station',
    type: 'station',
    parent: 'Terminus (Pyro VI)',
    mapX: 335,
    mapY: 608,
  },
  {
    code: 'S2',
    name: 'Checkmate Station',
    type: 'station',
    parent: 'Pyro V',
    mapX: 572,
    mapY: 588,
  },
  {
    code: 'S3',
    name: 'Orbituary',
    type: 'station',
    parent: 'Bloom (Pyro III)',
    mapX: 205,
    mapY: 488,
  },
  { code: 'S4', name: 'Stanton Gateway', type: 'station', mapX: 718, mapY: 332 },
  { code: 'S5', name: 'Nyx Gateway', type: 'station', mapX: 162, mapY: 608 },

  // ── Rough & Ready stations ─────────────────────────────────────────────
  {
    code: 'S6',
    name: 'Patch City',
    type: 'station',
    parent: 'Bloom (Pyro III)',
    mapX: 260,
    mapY: 540,
  },
  { code: 'S7', name: 'Gaslight', type: 'station', parent: 'Pyro V', mapX: 525, mapY: 570 },
  { code: 'S8', name: "Rat's Nest", type: 'station', parent: 'Pyro V', mapX: 590, mapY: 630 },
  {
    code: 'S9',
    name: 'Endgame',
    type: 'station',
    parent: 'Terminus (Pyro VI)',
    mapX: 720,
    mapY: 475,
  },
  {
    code: 'S10',
    name: 'Megumi Refueling',
    type: 'station',
    parent: 'Terminus (Pyro VI)',
    mapX: 650,
    mapY: 415,
  },

  // ── Citizens for Prosperity stations ────────────────────────────────────
  {
    code: 'S11',
    name: 'Starlight Service Station',
    type: 'station',
    parent: 'Bloom (Pyro III)',
    mapX: 290,
    mapY: 505,
  },
  {
    code: 'S12',
    name: "Rod's Fuel 'N Supplies",
    type: 'station',
    parent: 'Pyro V',
    mapX: 545,
    mapY: 575,
  },
  {
    code: 'S13',
    name: 'Dudley & Daughters',
    type: 'station',
    parent: 'Terminus (Pyro VI)',
    mapX: 710,
    mapY: 455,
  },

  // ── Jump Points ──────────────────────────────────────────────────────────
  { code: 'JP1', name: 'Pyro–Stanton JP', type: 'jump_point', mapX: 730, mapY: 320 },
  { code: 'JP2', name: 'Pyro–Nyx JP', type: 'jump_point', mapX: 150, mapY: 620 },
  { code: 'JP3', name: 'Pyro–Castra JP', type: 'jump_point', mapX: 280, mapY: 180 },
];

export const PYRO_AREAS: readonly SystemArea[] = [
  { name: 'Pyro Belt Alpha', type: 'asteroid-belt', centerX: 400, centerY: 400, radius: 180 },
];

export const PYRO_ORBIT_RADII: readonly { name: string; radius: number }[] = [
  { name: 'Pyro I', radius: 85 },
  { name: 'Monox', radius: 140 },
  { name: 'Bloom', radius: 220 },
  { name: 'Pyro IV', radius: 230 },
  { name: 'Pyro V', radius: 250 },
  { name: 'Pyro VI', radius: 285 },
];

// ---------------------------------------------------------------------------
// Nyx System
// ---------------------------------------------------------------------------

export const NYX_LOCATIONS: readonly StarSystemLocation[] = [
  { code: '0', name: 'Nyx', type: 'star', mapX: 400, mapY: 400 },

  // ── Delamar (dwarf planet / asteroid) ──────────────────────────────────
  { code: '1', name: 'Delamar', type: 'planet', mapX: 310, mapY: 320 },
  { code: 'C1', name: 'Levski', type: 'city', parent: 'Delamar', mapX: 296, mapY: 308 },

  // ── Glaciem Ring (Nyx I) ───────────────────────────────────────────────
  { code: '2', name: 'Glaciem (Nyx I)', type: 'planet', mapX: 500, mapY: 280 },

  // ── Nyx II ─────────────────────────────────────────────────────────────
  { code: '3', name: 'Nyx II', type: 'planet', mapX: 580, mapY: 500 },
  { code: '3A', name: 'Keeger', type: 'moon', parent: 'Nyx II', mapX: 600, mapY: 512 },

  // ── Nyx III ────────────────────────────────────────────────────────────
  { code: '4', name: 'Nyx III', type: 'planet', mapX: 280, mapY: 560 },

  // ── Jump Points ──────────────────────────────────────────────────────────
  { code: 'JP1', name: 'Nyx–Pyro JP', type: 'jump_point', mapX: 660, mapY: 300 },
  { code: 'JP2', name: 'Nyx–Odin JP', type: 'jump_point', mapX: 200, mapY: 680 },
];

export const NYX_AREAS: readonly SystemArea[] = [
  { name: 'Delamar Belt', type: 'asteroid-belt', centerX: 400, centerY: 400, radius: 130 },
];

export const NYX_ORBIT_RADII: readonly { name: string; radius: number }[] = [
  { name: 'Delamar', radius: 120 },
  { name: 'Glaciem', radius: 160 },
  { name: 'Nyx II', radius: 210 },
  { name: 'Nyx III', radius: 240 },
];

// ---------------------------------------------------------------------------
// System registry
// ---------------------------------------------------------------------------

export const STAR_SYSTEMS: readonly StarSystem[] = [
  { id: 'STANTON', name: 'Stanton', locations: STANTON_LOCATIONS, areas: STANTON_AREAS },
  { id: 'PYRO', name: 'Pyro', locations: PYRO_LOCATIONS, areas: PYRO_AREAS },
  { id: 'NYX', name: 'Nyx', locations: NYX_LOCATIONS, areas: NYX_AREAS },
];

// ---------------------------------------------------------------------------
// Orbital radii per system (approx map-px) for rendering faint orbit circles
// ---------------------------------------------------------------------------

export const SYSTEM_ORBIT_RADII: Record<string, readonly { name: string; radius: number }[]> = {
  STANTON: [
    { name: 'Hurston', radius: 141 },
    { name: 'Crusader', radius: 177 },
    { name: 'ArcCorp', radius: 250 },
    { name: 'microTech', radius: 316 },
  ],
  PYRO: PYRO_ORBIT_RADII,
  NYX: NYX_ORBIT_RADII,
};

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const VERSEGUIDE_BASE = 'https://verseguide.com/location';

export const buildVerseGuideUrl = (
  systemId: string,
  locationCode: string,
  locationName: string
): string => {
  const encodedName = encodeURIComponent(locationName);
  return `${VERSEGUIDE_BASE}/${encodeURIComponent(systemId)}/${encodeURIComponent(locationCode)}#${encodedName}`;
};
