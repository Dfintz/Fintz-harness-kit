/**
 * Activity Display System — Shared Constants
 *
 * Single source of truth for activity type and status display metadata.
 * Consumed by:
 *   - Frontend: ActivityCard, PublicJobCard
 *   - Backend bot: eventEmbed, embedBuilder
 *
 * All records are keyed by LOWERCASE model values so callers can normalize
 * with a simple `.toLowerCase()` regardless of whether they receive uppercase
 * (e.g. from Discord events) or lowercase (e.g. from the database).
 */

// ---------------------------------------------------------------------------
// Config interfaces
// ---------------------------------------------------------------------------

export interface ActivityTypeConfig {
  /** Human-readable label: "Mission", "Job Listing" */
  label: string;
  /** Emoji icon: "🎯", "💼" */
  emoji: string;
  /** CSS hex color string: '#ef4444' */
  color: string;
  /** Numeric hex color for Discord ColorResolvable: 0xef4444 */
  colorHex: number;
}

export interface ActivityStatusConfig {
  /** Human-readable label: "In Progress" */
  label: string;
  /** Status emoji: "🔵" */
  emoji: string;
  /** Pre-formatted Discord embed badge: "🔵 In Progress" */
  discordBadge: string;
  /** Primary color: '#fbbf24' */
  color: string;
  /** Web chip background (rgba): 'rgba(245,158,11,0.15)' */
  bgColor: string;
  /** Web chip border (rgba): 'rgba(245,158,11,0.4)' */
  borderColor: string;
}

// ---------------------------------------------------------------------------
// Canonical ActivityType config
// Keys match backend ActivityType enum values (lowercase)
// ---------------------------------------------------------------------------

export const ACTIVITY_TYPE_CONFIG: Record<string, ActivityTypeConfig> = {
  mission: {
    label: 'Mission',
    emoji: '🎯',
    color: '#ef4444',
    colorHex: 0xef4444,
  },
  contract: {
    label: 'Contract',
    emoji: '📋',
    color: '#3b82f6',
    colorHex: 0x3b82f6,
  },
  bounty: {
    label: 'Bounty',
    emoji: '💀',
    color: '#ec4899',
    colorHex: 0xec4899,
  },
  event: {
    label: 'Event',
    emoji: '📅',
    color: '#f1c40f',
    colorHex: 0xf1c40f,
  },
  lfg: {
    label: 'LFG',
    emoji: '🔍',
    color: '#6366f1',
    colorHex: 0x6366f1,
  },
  operation: {
    label: 'Operation',
    emoji: '⚔️',
    color: '#ef4444',
    colorHex: 0xef4444,
  },
  job_listing: {
    label: 'Job Listing',
    emoji: '💼',
    color: '#8b5cf6',
    colorHex: 0x8b5cf6,
  },
};

// ---------------------------------------------------------------------------
// Canonical ActivityStatus config
// Keys match backend ActivityStatus enum values (lowercase)
// ---------------------------------------------------------------------------

export const ACTIVITY_STATUS_CONFIG: Record<string, ActivityStatusConfig> = {
  draft: {
    label: 'Draft',
    emoji: '📝',
    discordBadge: '⚪ Draft',
    color: '#8b949e',
    bgColor: 'rgba(139,148,158,0.15)',
    borderColor: 'rgba(139,148,158,0.4)',
  },
  open: {
    label: 'Open',
    emoji: '🟢',
    discordBadge: '🟢 Open',
    color: '#34d399',
    bgColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.4)',
  },
  planning: {
    label: 'Planning',
    emoji: '📋',
    discordBadge: '📋 Planning',
    color: '#60a5fa',
    bgColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.4)',
  },
  recruiting: {
    label: 'Recruiting',
    emoji: '📢',
    discordBadge: '📣 Recruiting',
    color: '#a78bfa',
    bgColor: 'rgba(139,92,246,0.15)',
    borderColor: 'rgba(139,92,246,0.4)',
  },
  ready: {
    label: 'Ready',
    emoji: '✅',
    discordBadge: '✅ Ready',
    color: '#34d399',
    bgColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.4)',
  },
  in_progress: {
    label: 'In Progress',
    emoji: '🔵',
    discordBadge: '🔵 In Progress',
    color: '#fbbf24',
    bgColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  completed: {
    label: 'Completed',
    emoji: '✔️',
    discordBadge: '🏁 Completed',
    color: '#9ca3af',
    bgColor: 'rgba(107,114,128,0.15)',
    borderColor: 'rgba(107,114,128,0.4)',
  },
  failed: {
    label: 'Failed',
    emoji: '❌',
    discordBadge: '🔴 Failed',
    color: '#f87171',
    bgColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  cancelled: {
    label: 'Cancelled',
    emoji: '🚫',
    discordBadge: '⛔ Cancelled',
    color: '#f87171',
    bgColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  expired: {
    label: 'Expired',
    emoji: '⏰',
    discordBadge: '⏰ Expired',
    color: '#9ca3af',
    bgColor: 'rgba(107,114,128,0.15)',
    borderColor: 'rgba(107,114,128,0.4)',
  },
};

// ---------------------------------------------------------------------------
// Safe fallbacks
// ---------------------------------------------------------------------------

const DEFAULT_TYPE_CONFIG: ActivityTypeConfig = {
  label: 'Activity',
  emoji: '📌',
  color: '#8b949e',
  colorHex: 0x8b949e,
};

const DEFAULT_STATUS_CONFIG: ActivityStatusConfig = {
  label: 'Unknown',
  emoji: '📌',
  discordBadge: 'Unknown',
  color: '#8b949e',
  bgColor: 'rgba(139,148,158,0.15)',
  borderColor: 'rgba(139,148,158,0.4)',
};

// ---------------------------------------------------------------------------
// Helper functions — normalize any casing
// ---------------------------------------------------------------------------

/**
 * Returns display config for an activity type value.
 * Accepts uppercase ('MISSION') or lowercase ('mission').
 */
export function getActivityTypeConfig(type?: string): ActivityTypeConfig {
  if (!type) return DEFAULT_TYPE_CONFIG;
  return ACTIVITY_TYPE_CONFIG[type.toLowerCase()] ?? DEFAULT_TYPE_CONFIG;
}

/**
 * Returns display config for an activity status value.
 * Accepts uppercase ('IN_PROGRESS') or lowercase ('in_progress').
 */
export function getActivityStatusConfig(status?: string): ActivityStatusConfig {
  if (!status) return ACTIVITY_STATUS_CONFIG.open ?? DEFAULT_STATUS_CONFIG;
  return ACTIVITY_STATUS_CONFIG[status.toLowerCase()] ?? DEFAULT_STATUS_CONFIG;
}

// ---------------------------------------------------------------------------
// Normalized card-level data interface
// All three surfaces (ActivityCard, PublicJobCard, event embed) map to this.
// ---------------------------------------------------------------------------

export interface ActivityCardData {
  id: string;
  title: string;
  /** ActivityType value — lowercase (mission, contract, bounty, event, lfg, operation, job_listing) */
  type: string;
  /** ActivityStatus value — lowercase (draft, open, planning, recruiting, ready, in_progress, completed, failed, cancelled, expired) */
  status: string;
  description?: string;
  visibility?: string;
  location?: string;
  tags?: string[];
  languages?: string[];
  organizationName?: string;
  organizationLogoUrl?: string;
  creatorName?: string;
  startDate?: string | Date;
  timezone?: string;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Expiry date — relevant for job listings */
  expiresAt?: string | Date;
  /** Creation or listing date */
  postedAt: string | Date;
  currentParticipants?: number;
  maxParticipants?: number;
  // Job-listing specific
  /** JobType value (crew, pilot, gunner, engineer, medic, miner, hauler, scout, security, leadership, support, other) */
  jobType?: string;
  /** OrgPrimaryFocus value */
  focus?: string;
  /** Human-readable pay string e.g. "50,000–200,000 aUEC/hr" */
  payDisplay?: string;
  experienceLevel?: number | string;
  /** 'job' | 'service' */
  listingCategory?: string;
  crewSpotsTotal?: number;
  crewSpotsFilled?: number;
  /** Per-ship crew breakdown with role slots (matches ShipCrewBreakdownEntry) */
  shipCrewBreakdown?: ShipCrewBreakdownCardEntry[];
  /** Required/preferred ships for the activity */
  requiredShips?: string[];
  /** Whether required ships are mandatory or preferred */
  shipRequirementType?: 'none' | 'required' | 'preferred';
}

/** Crew role slot within a ship — card-level subset */
export interface ShipCrewRoleSlot {
  role: string;
  total: number;
  filled: number;
  assignedUserName?: string | null;
}

/** Passenger slot for non-crew personnel */
export interface PassengerCardSlot {
  role: string;
  capacity: number;
  filled: number;
}

/** Per-ship crew breakdown for the unified card */
export interface ShipCrewBreakdownCardEntry {
  shipName: string;
  crewCapacity: number;
  roles: ShipCrewRoleSlot[];
  isLoaner?: boolean;
  contributedByUserName?: string | null;
  isTransported?: boolean;
  transportType?: 'hangar' | 'cargo';
  passengers?: PassengerCardSlot[];
}
