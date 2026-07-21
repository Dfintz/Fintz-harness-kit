import type { CASActivityTier } from '@sc-fleet-manager/shared-types';
import type { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { ActivityLevel, PublicOrgProfile } from '../../models/PublicOrgProfile';
import { logger } from '../../utils/logger';
import { domainEvents, type DomainEventMap } from '../shared/DomainEventBus';

const CAS_TIER_TO_ACTIVITY_LEVEL: Record<CASActivityTier, ActivityLevel> = {
  VERY_ACTIVE: ActivityLevel.VERY_HIGH,
  ACTIVE: ActivityLevel.HIGH,
  MODERATE: ActivityLevel.MODERATE,
  QUIET: ActivityLevel.LOW,
  DORMANT: ActivityLevel.INACTIVE,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCasTier(value: string): value is CASActivityTier {
  return value in CAS_TIER_TO_ACTIVITY_LEVEL;
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Map CAS tier values into public directory activity levels.
 */
export function mapCasTierToActivityLevel(tier: CASActivityTier): ActivityLevel {
  return CAS_TIER_TO_ACTIVITY_LEVEL[tier];
}

/**
 * CASActivityLevelBridge keeps PublicOrgProfile.activityLevel in sync with CAS tier updates.
 */
export class CASActivityLevelBridge {
  private readonly profileRepository: Repository<PublicOrgProfile>;
  private subscribed = false;

  private readonly casUpdatedListener = (
    payload: DomainEventMap['analytics:cas_updated']
  ): Promise<void> => this.onCasUpdated(payload);

  constructor(profileRepository?: Repository<PublicOrgProfile>) {
    this.profileRepository = profileRepository ?? AppDataSource.getRepository(PublicOrgProfile);
  }

  /**
   * Subscribe to CAS update events.
   * Idempotent: safe to call multiple times.
   */
  subscribeToEvents(): void {
    if (this.subscribed) {
      return;
    }

    domainEvents.on('analytics:cas_updated', this.casUpdatedListener);
    this.subscribed = true;

    logger.info('CASActivityLevelBridge: subscribed to analytics:cas_updated');
  }

  /**
   * Unsubscribe from CAS update events.
   */
  unsubscribeFromEvents(): void {
    if (!this.subscribed) {
      return;
    }

    domainEvents.off('analytics:cas_updated', this.casUpdatedListener);
    this.subscribed = false;
  }

  private async onCasUpdated(payload: DomainEventMap['analytics:cas_updated']): Promise<void> {
    const { organizationId, tier, previousTier, score, previousScore } = payload;

    if (!isUuid(organizationId)) {
      logger.warn('CASActivityLevelBridge: received non-UUID organizationId', { organizationId });
      return;
    }

    if (!isCasTier(tier) || !isCasTier(previousTier)) {
      logger.warn('CASActivityLevelBridge: received unknown CAS tier value', {
        organizationId,
        tier,
        previousTier,
      });
      return;
    }

    // The first emitted CAS event has previousScore/previousTier equal to current values.
    // We still process that event so the directory marker can be initialized from CAS.
    const isInitialSyncEvent = tier === previousTier && score === previousScore;
    const tierChanged = tier !== previousTier;

    if (!tierChanged && !isInitialSyncEvent) {
      return;
    }

    const mappedActivityLevel = mapCasTierToActivityLevel(tier);

    const existingProfile = await this.profileRepository
      .createQueryBuilder('publicOrgProfile')
      .select([
        'publicOrgProfile.id',
        'publicOrgProfile.organizationId',
        'publicOrgProfile.activityLevel',
      ])
      .where('publicOrgProfile.organizationId = :organizationId', { organizationId })
      .getOne();

    if (!existingProfile) {
      return;
    }

    if (existingProfile.activityLevel === mappedActivityLevel) {
      return;
    }

    await this.profileRepository
      .createQueryBuilder()
      .update(PublicOrgProfile)
      .set({ activityLevel: mappedActivityLevel })
      .where('organizationId = :organizationId', { organizationId })
      .execute();

    logger.info('CASActivityLevelBridge: synced PublicOrgProfile.activityLevel from CAS', {
      organizationId,
      previousActivityLevel: existingProfile.activityLevel,
      nextActivityLevel: mappedActivityLevel,
      tier,
      previousTier,
      score,
      previousScore,
    });
  }
}

let _casActivityLevelBridge: CASActivityLevelBridge | null = null;

/**
 * Lazy singleton accessor used during process startup.
 */
export function getCASActivityLevelBridge(): CASActivityLevelBridge {
  if (!_casActivityLevelBridge) {
    _casActivityLevelBridge = new CASActivityLevelBridge();
    _casActivityLevelBridge.subscribeToEvents();
  }

  return _casActivityLevelBridge;
}

