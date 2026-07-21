/**
 * Voice Time Tracking Job — Background poller for Mumble voice minutes.
 *
 * Polls the CVP bridge every 5 minutes and credits voice minutes to
 * MemberEngagement records. Feeds into CAS computation (Voice Activity 15%).
 *
 * Runs in the worker container alongside other background jobs.
 */

import type { VoiceServerConfig } from '@sc-fleet-manager/shared-types';

import { trackMetric } from '../config/applicationInsights';
import { AppDataSource } from '../config/database';
import { Federation } from '../models/Federation';
import { Organization } from '../models/Organization';
import { mapWithConcurrency } from '../utils/asyncConcurrency';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';

const JOB_NAME = 'voice-time-tracking';
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CREDIT_MINUTES_PER_POLL = 5;
const PLATFORM_GUILD_ID = 'platform';
const DEFAULT_ORG_CONCURRENCY = 8;
const MAX_ORG_CONCURRENCY = 20;
const FALLBACK_UPSERT_CONCURRENCY = 5;

let timer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

interface CVPUser {
  displayName: string;
  channelId: number;
  isMuted: boolean;
  isDeafened: boolean;
  onlineSince: string;
  sessionMinutes?: number;
  platformUserId?: string;
}

interface CVPResponse {
  channels: Array<{ id: number; name: string; parentId: number | null; userCount: number }>;
  users: CVPUser[];
  error?: string;
}

function resolveOrgConcurrency(): number {
  const rawValue = process.env.VOICE_TRACKING_ORG_CONCURRENCY;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_ORG_CONCURRENCY;
  }

  return Math.min(parsed, MAX_ORG_CONCURRENCY);
}

function buildVoiceCredits(users: readonly CVPUser[], minutesPerUser: number): Map<string, number> {
  const credits = new Map<string, number>();

  for (const user of users) {
    if (!user.platformUserId) {
      continue;
    }

    const existingMinutes = credits.get(user.platformUserId) ?? 0;
    credits.set(user.platformUserId, existingMinutes + minutesPerUser);
  }

  return credits;
}

function sumCreditedMinutes(credits: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const minutes of credits.values()) {
    total += minutes;
  }
  return total;
}

async function executeVoiceMinutesUpsert(
  userIds: readonly string[],
  minutes: readonly number[],
  date: string
): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  await AppDataSource.query(
    `INSERT INTO member_engagements ("guildId", "userId", "date", "voiceMinutes", "messageCount")
     SELECT $1::text, users.user_id, $2::date, users.voice_minutes, 0
     FROM UNNEST($3::text[], $4::int[]) AS users(user_id, voice_minutes)
     ON CONFLICT ("guildId", "userId", "date")
     DO UPDATE SET
       "voiceMinutes" = member_engagements."voiceMinutes" + EXCLUDED."voiceMinutes",
       "updatedAt" = NOW()`,
    [PLATFORM_GUILD_ID, date, userIds, minutes]
  );
}

async function upsertVoiceMinutesBatch(
  credits: ReadonlyMap<string, number>,
  date: string
): Promise<void> {
  if (credits.size === 0) {
    return;
  }

  const userIds = Array.from(credits.keys());
  const minutes = userIds.map(userId => credits.get(userId) ?? 0);

  try {
    await executeVoiceMinutesUpsert(userIds, minutes, date);
    return;
  } catch (error) {
    logger.warn(`[${JOB_NAME}] Batch upsert failed, falling back to per-user upserts`, {
      records: credits.size,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const entries = Array.from(credits.entries());
  await mapWithConcurrency(entries, FALLBACK_UPSERT_CONCURRENCY, async ([userId, minutesToAdd]) => {
    try {
      await executeVoiceMinutesUpsert([userId], [minutesToAdd], date);
    } catch (error) {
      logger.debug('Voice minutes credit failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Poll CVP bridges for all orgs with contributeToCAS enabled
 * and credit voice minutes to MemberEngagement.
 */
export async function runVoiceTimeTracking(): Promise<void> {
  if (isRunning) {
    logger.debug(`[${JOB_NAME}] Skipping — previous run still in progress`);
    return;
  }

  isRunning = true;

  try {
    const orgRepo = AppDataSource.getRepository(Organization);

    // Find orgs with voice servers that contribute to CAS
    const orgs = await orgRepo
      .createQueryBuilder('org')
      .select(['org.id', 'org.settings'])
      .where(`org.settings->'voiceServer'->>'contributeToCAS' = 'true'`)
      .andWhere(`org.settings->'voiceServer'->>'enabled' = 'true'`)
      .getMany();

    let totalMinutesTracked = 0;

    if (orgs.length > 0) {
      const orgConcurrency = resolveOrgConcurrency();
      logger.debug(
        `[${JOB_NAME}] Tracking voice time for ${orgs.length} organizations (concurrency=${orgConcurrency})`
      );

      const orgResults = await mapWithConcurrency(orgs, orgConcurrency, async org => {
        const config = org.settings?.voiceServer;
        if (!config?.iceHost) {
          return 0;
        }

        try {
          return await trackOrgVoiceMinutes(config);
        } catch (error) {
          logger.warn(`[${JOB_NAME}] Failed to track voice for org ${org.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          return 0;
        }
      });

      totalMinutesTracked = orgResults.reduce((total, minutes) => total + minutes, 0);
    }

    // Track federation-owned voice servers from CVP bridge Redis cache.
    // Each server pushes to its own per-server key (`voice:channels:fed:<id>`).
    // Legacy single-server deployments without an explicit scope still write to
    // `voice:channels:platform`, which we read for the configured platform fed.
    try {
      const fedMinutes = await trackFederationVoiceMinutes();
      totalMinutesTracked += fedMinutes;
    } catch (error) {
      logger.warn(`[${JOB_NAME}] Failed to track federation voice minutes`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (totalMinutesTracked > 0) {
      trackMetric('voice.tracking.minutes_credited', totalMinutesTracked);
      logger.info(`[${JOB_NAME}] Credited ${totalMinutesTracked} voice minutes`);
    }
  } catch (error) {
    logger.error(`[${JOB_NAME}] Job failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Track voice minutes for a single org by polling its CVP bridge.
 */
async function trackOrgVoiceMinutes(config: VoiceServerConfig): Promise<number> {
  const cvpPort = config.icePort ?? 8443;
  const cvpUrl = `https://${config.iceHost}:${cvpPort}/channels`;

  const response = await fetch(cvpUrl, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    return 0;
  }

  const data = (await response.json()) as CVPResponse;
  if (data.error || !data.users) {
    return 0;
  }

  const voiceCredits = buildVoiceCredits(data.users, CREDIT_MINUTES_PER_POLL);
  if (voiceCredits.size === 0) {
    return 0;
  }

  const today = new Date().toISOString().split('T')[0];
  await upsertVoiceMinutesBatch(voiceCredits, today);
  return sumCreditedMinutes(voiceCredits);
}

function getFederationScopes(federationId: string, platformFedId: string | undefined): string[] {
  const scopes = [`fed:${federationId}`];
  if (federationId === platformFedId) {
    scopes.push('platform');
  }
  return scopes;
}

async function getScopeVoiceCredits(scope: string): Promise<Map<string, number>> {
  const channelData = await cache.get<CVPResponse>(`voice:channels:${scope}`);
  if (!channelData?.users) {
    return new Map<string, number>();
  }

  return buildVoiceCredits(channelData.users, CREDIT_MINUTES_PER_POLL);
}

/**
 * Track Mumble voice minutes for every federation-owned voice server by
 * reading its per-server Redis bucket populated by the CVP bridge.
 *
 * The legacy platform Mumble bridge wrote to `voice:channels:platform`; that
 * scope is still read for the federation identified by
 * `PLATFORM_MUMBLE_FEDERATION_ID` so existing bridges keep working until they
 * migrate to passing an explicit `?scope=fed:<id>` query param.
 */
async function trackFederationVoiceMinutes(): Promise<number> {
  const fedRepo = AppDataSource.getRepository(Federation);
  const fedsWithVoice = await fedRepo
    .createQueryBuilder('fed')
    .select(['fed.id', 'fed.settings'])
    .where(`fed.settings->'voiceServer'->>'enabled' = 'true'`)
    .getMany();

  const platformFedId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
  const seenScopes = new Set<string>();
  const aggregatedCredits = new Map<string, number>();

  for (const fed of fedsWithVoice) {
    // Read both the per-server scope and the legacy `platform` scope (when
    // this fed is the configured platform fed) so we don't miss credit
    // during the bridge migration window.
    const scopes = getFederationScopes(fed.id, platformFedId);

    for (const scope of scopes) {
      if (seenScopes.has(scope)) {
        continue;
      }
      seenScopes.add(scope);

      const scopeCredits = await getScopeVoiceCredits(scope);
      for (const [userId, minutes] of scopeCredits.entries()) {
        aggregatedCredits.set(userId, (aggregatedCredits.get(userId) ?? 0) + minutes);
      }
    }
  }

  if (aggregatedCredits.size === 0) {
    return 0;
  }

  const today = new Date().toISOString().split('T')[0];
  await upsertVoiceMinutesBatch(aggregatedCredits, today);
  return sumCreditedMinutes(aggregatedCredits);
}

/**
 * Start the voice time tracking job.
 */
export function startVoiceTimeTrackingJob(): { cleanup: () => void } {
  logger.info(`[${JOB_NAME}] Starting (interval: ${INTERVAL_MS / 1000}s)`);

  // Run immediately on startup, then on interval
  void runVoiceTimeTracking();
  timer = setInterval(() => void runVoiceTimeTracking(), INTERVAL_MS);

  return {
    cleanup: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      logger.info(`[${JOB_NAME}] Stopped`);
    },
  };
}
