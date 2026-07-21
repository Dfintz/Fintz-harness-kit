/**
 * SCStats shared type definitions
 *
 * Wave 2.5 — Sprint 0 (D3)
 *
 * Types shared between the backend SCStats services and the
 * frontend SCStats components / hooks.
 */

// ---------------------------------------------------------------------------
// Individual player metrics
// ---------------------------------------------------------------------------

/**
 * Processed SCStats metrics for a single player.
 * Nullable fields indicate no data has been imported yet.
 */
export interface SCStatsMetrics {
  totalHours: number | null;
  kdRatio: number | null;
  missionsCompleted: number | null;
  favoriteVehicle: string | null;
}

/**
 * API response for `GET /api/v2/scstats/users/:userId`.
 */
export interface SCStatsPlayerData {
  hasData: boolean;
  lastImport: string | null;
  totalImports: number;
  consentGranted: boolean;
  metrics: SCStatsMetrics | null;
  isStale: boolean;
}

/**
 * Result returned by `POST /api/v2/scstats/users/:userId/import`.
 */
export interface SCStatsImportResult {
  success: boolean;
  message: string;
  imported: SCStatsMetrics;
  lastImport: string;
}

// ---------------------------------------------------------------------------
// Raw export format (from the SCStats desktop application)
// ---------------------------------------------------------------------------

/**
 * Structure of the JSON file exported by the SCStats application.
 * Used by the backend import service for parsing and validation.
 */
export interface SCStatsRawExport {
  metadata: {
    version: string;
    exportDate: string;
  };
  playtime: {
    totalHours: number;
    sessionCount: number;
    averageSessionLength: number;
  };
  combat: {
    kills: { total: number; player: number; npc: number };
    deaths: { total: number };
    kd: number;
    killsPerHour?: number;
  };
  missions: {
    totalCompleted: number;
    byType: Record<string, number>;
  };
  vehicles: {
    favoriteByFlightTime: { name: string; hours: number };
  };
}

// ---------------------------------------------------------------------------
// CSV import types (SCStats desktop app — separate CSV exports)
// ---------------------------------------------------------------------------

/**
 * A row from the playtime_versions CSV export.
 */
export interface SCStatsPlaytimeRow {
  version: string;
  hours: number;
  builds: string;
}

/**
 * A row from the loadout CSV exports (top items or detailed items).
 */
export interface SCStatsLoadoutRow {
  port: string;
  item: string;
  sessions: number;
  wornTime: string;
  isTopItem: boolean;
}

/**
 * A row from the purchases CSV export.
 */
export interface SCStatsPurchaseRow {
  item: string;
  qty: number;
  spent: string;
  topShop: string;
}

/**
 * A row from the ships CSV export.
 */
export interface SCStatsShipRow {
  ship: string;
  totalTime: string;
  sessions: number;
  longestFlight: string;
  firstFlown: string;
  lastFlown: string;
}

/**
 * Aggregated flight hours grouped by ship career (e.g. "Combat", "Transport").
 * Derived by matching SCStats ship names against the ship catalog.
 */
export interface SCStatsCareerHours {
  career: string;
  hours: number;
  shipCount: number;
}

/**
 * Complete parsed CSV data stored per user.
 */
export interface SCStatsCsvData {
  playtime: SCStatsPlaytimeRow[];
  loadoutTop: SCStatsLoadoutRow[];
  loadoutDetail: SCStatsLoadoutRow[];
  purchases: SCStatsPurchaseRow[];
  ships: SCStatsShipRow[];
}

/**
 * Derived summary from CSV imports.
 */
export interface SCStatsCsvSummary {
  totalPlaytimeHours: number;
  versionsPlayed: number;
  mostPlayedVersion: string;
  totalShipsFlown: number;
  totalFlightTimeHours: number;
  mostFlownShip: string;
  totalAuecSpent: number;
  uniqueItemsPurchased: number;
  favoriteShop: string;
  primaryWeapon: string;
  totalLoadoutSessions: number;
  /** Flight hours aggregated by ship career. Empty if catalog matching unavailable. */
  hoursByCareer: SCStatsCareerHours[];
}

/**
 * Response from CSV import endpoint.
 */
export interface SCStatsCsvImportResult {
  success: boolean;
  message: string;
  summary: SCStatsCsvSummary;
  counts: {
    playtime: number;
    loadoutTop: number;
    loadoutDetail: number;
    purchases: number;
    ships: number;
  };
}

/**
 * Per-category import timestamps for partial upload tracking.
 */
export interface SCStatsCsvCategoryStatus {
  playtimeImportedAt: string | null;
  loadoutImportedAt: string | null;
  purchasesImportedAt: string | null;
  shipsImportedAt: string | null;
}

/**
 * Response from CSV data retrieval.
 */
export interface SCStatsCsvPlayerData {
  hasData: boolean;
  lastImport: string | null;
  consentGranted: boolean;
  summary: SCStatsCsvSummary | null;
  data: SCStatsCsvData | null;
  /** Per-category import timestamps (null if category not yet imported). */
  categoryStatus: SCStatsCsvCategoryStatus | null;
}

// ---------------------------------------------------------------------------
// Organization analytics
// ---------------------------------------------------------------------------

/**
 * Bucketed skill distribution (low / medium / high / expert).
 */
export interface SkillDistribution {
  low: number;
  medium: number;
  high: number;
  expert: number;
}

/**
 * Organization-level SCStats analytics summary returned by
 * `GET /api/v2/scstats/organizations/:orgId/analytics`.
 */
export interface OrgSCStatsAnalytics {
  memberCount: number;
  verifiedCount: number;
  verificationRate: number;
  averageKD: number;
  averageTotalHours: number;
  averageMissionsCompleted: number;
  topPerformers: Array<{
    userId: string;
    kdRatio: number;
    totalHours: number;
  }>;
  skillDistribution: Record<string, SkillDistribution>;
  /** Aggregated flight hours by career across all org members with CSV data. */
  careerBreakdown: SCStatsCareerHours[];
}
