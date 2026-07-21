/**
 * CAS (Composite Activity Score) — Shared Types
 *
 * Org-level activity health metric computed from 5 data sources:
 * Discord presence, engagement, consistency, voice, and site activity.
 */

/** Activity tier based on CAS score */
export type CASActivityTier = 'VERY_ACTIVE' | 'ACTIVE' | 'MODERATE' | 'QUIET' | 'DORMANT';

/** Per-component breakdown of CAS score */
export interface CASBreakdown {
  onlinePresence: number;
  engagement: number;
  consistency: number;
  voiceActivity: number;
  siteActivity: number;
}

/** Current CAS score result */
export interface CASScoreResult {
  organizationId: string;
  score: number;
  tier: CASActivityTier;
  breakdown: CASBreakdown;
  memberCount: number;
  computedAt: string;
}

/** Historical CAS data point */
export interface CASHistoryPoint {
  score: number;
  tier: CASActivityTier;
  computedAt: string;
}

/** CAS ranking entry */
export interface CASRankingEntry {
  organizationId: string;
  organizationName: string;
  score: number;
  tier: CASActivityTier;
  memberCount: number;
}

/** A single cell in the 7x24 activity heatmap */
export interface CASHeatmapCell {
  dayOfWeek: number;
  hour: number;
  intensity: number;
  rawPerCapita: number;
  avgPresence: number;
  avgSiteActive: number;
}

/** Full heatmap response */
export interface CASHeatmapResponse {
  organizationId: string;
  memberCount: number;
  cells: CASHeatmapCell[];
  logScale: boolean;
  days: number;
  maxRawPerCapita: number;
  generatedAt: string;
}

/** CAS configuration (per-org customizable) */
export interface CASConfig {
  onlinePresenceTarget: number;
  engagementTarget: number;
  consistencyTarget: number;
  voiceTarget: number;
  siteActivityTarget: number;
  weights: {
    onlinePresence: number;
    engagement: number;
    consistency: number;
    voice: number;
    site: number;
  };
  heatmapLogScale: boolean;
}

/** Default CAS configuration */
export const DEFAULT_CAS_CONFIG: CASConfig = {
  onlinePresenceTarget: 0.2,
  engagementTarget: 2.0,
  consistencyTarget: 0.15,
  voiceTarget: 30,
  siteActivityTarget: 0.1,
  weights: {
    onlinePresence: 0.3,
    engagement: 0.2,
    consistency: 0.25,
    voice: 0.15,
    site: 0.1,
  },
  heatmapLogScale: true,
};

/** Domain event payload for CAS score updates */
export interface CASEventPayload {
  organizationId: string;
  score: number;
  previousScore: number;
  tier: CASActivityTier;
  previousTier: CASActivityTier;
  breakdown: CASBreakdown;
  computedAt: string;
}
