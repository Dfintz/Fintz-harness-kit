/**
 * CASConfig — Default configuration + per-org override loading.
 */

import { type CASActivityTier, type CASConfig, DEFAULT_CAS_CONFIG } from '@sc-fleet-manager/shared-types';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';

/**
 * Load CAS configuration for an organization.
 * Falls back to defaults for any missing fields.
 */
export async function loadCASConfig(organizationId: string): Promise<CASConfig> {
  const org = await AppDataSource.getRepository(Organization).findOne({
    where: { id: organizationId },
    select: ['settings'],
  });

  const overrides = (org?.settings as Record<string, unknown>)?.casConfig as
    | Partial<CASConfig>
    | undefined;
  if (!overrides) {
    return { ...DEFAULT_CAS_CONFIG };
  }

  return {
    onlinePresenceTarget: overrides.onlinePresenceTarget ?? DEFAULT_CAS_CONFIG.onlinePresenceTarget,
    engagementTarget: overrides.engagementTarget ?? DEFAULT_CAS_CONFIG.engagementTarget,
    consistencyTarget: overrides.consistencyTarget ?? DEFAULT_CAS_CONFIG.consistencyTarget,
    voiceTarget: overrides.voiceTarget ?? DEFAULT_CAS_CONFIG.voiceTarget,
    siteActivityTarget: overrides.siteActivityTarget ?? DEFAULT_CAS_CONFIG.siteActivityTarget,
    weights: {
      onlinePresence:
        overrides.weights?.onlinePresence ?? DEFAULT_CAS_CONFIG.weights.onlinePresence,
      engagement: overrides.weights?.engagement ?? DEFAULT_CAS_CONFIG.weights.engagement,
      consistency: overrides.weights?.consistency ?? DEFAULT_CAS_CONFIG.weights.consistency,
      voice: overrides.weights?.voice ?? DEFAULT_CAS_CONFIG.weights.voice,
      site: overrides.weights?.site ?? DEFAULT_CAS_CONFIG.weights.site,
    },
    heatmapLogScale: overrides.heatmapLogScale ?? DEFAULT_CAS_CONFIG.heatmapLogScale,
  };
}

/**
 * Map CAS score to activity tier.
 * @param score The numerical CAS score [0, 100]
 * @returns A typed CAS activity tier string
 */
export function scoreToCasTier(score: number): CASActivityTier {
  if (score >= 85) {
    return 'VERY_ACTIVE';
  }
  if (score >= 65) {
    return 'ACTIVE';
  }
  if (score >= 45) {
    return 'MODERATE';
  }
  if (score >= 20) {
    return 'QUIET';
  }
  return 'DORMANT';
}

