/**
 * Citizen Watchlist Types
 *
 * Shared types for the Citizen Watchlist system (Wave 2.1).
 * Watchlist entries track **individual RSI citizens** that an org's
 * intel team wants to monitor — e.g., known hostiles, suspects, or persons
 * of interest.
 *
 * Organization-level relationships are managed on the Relations page.
 * Watchlist entries may reference RSI citizens that are NOT on the platform.
 */

// ─── Watchlist Reason ────────────────────────────────────────────────

/**
 * Why an RSI citizen was added to the watchlist.
 */
export enum WatchlistReason {
  /** Known hostile player */
  HOSTILE = 'hostile',
  /** Known griefer or pirate */
  GRIEFER = 'griefer',
  /** Suspected of hostile intent */
  SUSPICIOUS = 'suspicious',
  /** Under active investigation */
  UNDER_INVESTIGATION = 'under_investigation',
  /** Player uses RSI "redacted" visibility */
  REDACTED = 'redacted',
  /** Previously had negative interactions */
  NEGATIVE_HISTORY = 'negative_history',
  /** Player suspected of impersonation */
  IMPERSONATION = 'impersonation',
  /** Known spy or infiltrator */
  SPY = 'spy',
  /** Custom / other reason (see notes) */
  OTHER = 'other',
}

// ─── Watchlist Threat Level ──────────────────────────────────────────

/**
 * Threat level assigned to a watchlisted citizen.
 * Determines the flag severity when this citizen is encountered.
 */
export enum WatchlistThreatLevel {
  /** Low concern — informational tracking */
  LOW = 'low',
  /** Moderate concern — flag as MEDIUM */
  MODERATE = 'moderate',
  /** High concern — flag as HIGH */
  HIGH = 'high',
  /** Critical concern — flag as CRITICAL */
  CRITICAL = 'critical',
}

// ─── DTOs ────────────────────────────────────────────────────────────

/**
 * DTO for creating a watchlist entry.
 */
export interface CreateWatchlistEntryDto {
  /** RSI citizen handle (spectrum ID) */
  rsiHandle: string;
  /** Display name of the citizen (for reference) */
  citizenName: string;
  /** Why this citizen is on the watchlist */
  reason: WatchlistReason;
  /** Assessed threat level */
  threatLevel: WatchlistThreatLevel;
  /** Free-text notes from the intel officer */
  notes?: string;
}

/**
 * DTO for updating a watchlist entry.
 */
export interface UpdateWatchlistEntryDto {
  /** Updated reason (optional) */
  reason?: WatchlistReason;
  /** Updated threat level (optional) */
  threatLevel?: WatchlistThreatLevel;
  /** Updated notes (optional) */
  notes?: string;
  /** Updated display name (optional) */
  citizenName?: string;
}

/**
 * Query parameters for listing watchlist entries.
 */
export interface ListWatchlistQuery {
  /** Filter by reason(s) */
  reasons?: WatchlistReason[];
  /** Filter by threat level(s) */
  threatLevels?: WatchlistThreatLevel[];
  /** Search by RSI handle or citizen name */
  search?: string;
  /** Pagination */
  page?: number;
  pageSize?: number;
  /** Sort */
  sortBy?: 'createdAt' | 'citizenName' | 'threatLevel' | 'reason';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Summary DTO returned from API.
 */
export interface WatchlistEntrySummary {
  id: string;
  organizationId: string;
  rsiHandle: string;
  citizenName: string;
  reason: WatchlistReason;
  threatLevel: WatchlistThreatLevel;
  notes?: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of a cross-reference check.
 * Given an RSI handle (from a member's RSI profile),
 * returns matching watchlist entries.
 */
export interface WatchlistCrossReferenceResult {
  /** RSI citizen handle that matched */
  rsiHandle: string;
  /** The watchlist entry that matched */
  entry: WatchlistEntrySummary;
}
