import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { RsiCitizenOrg } from '../../models/RsiCitizenOrg';
import { logger } from '../../utils/logger';
import { rsiCrawlerService } from '../external/RsiCrawlerService';

const DEFAULT_STALE_HOURS = 12;
const DEFAULT_RETRY_WINDOW_MINUTES = 30;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_QUEUE_PER_REQUEST = 100;
const ACCOUNT_STATUS_TTL_HOURS = 24;
const RATE_LIMIT_RETRY_MIN_DELAY_MS = 250;
const RATE_LIMIT_RETRY_MAX_DELAY_MS = 900;

export type RsiAffiliationAccountStatus = 'active' | 'deleted' | 'banned' | 'unavailable';

export interface RsiAffiliationAccountState {
  status: RsiAffiliationAccountStatus;
  updatedAt: string;
  message?: string;
}

interface RefreshQueueItem {
  handle: string;
  organizationId?: string;
}

export interface RsiAffiliationCacheResult {
  affiliationsByHandle: Map<string, RsiCitizenOrg[]>;
  accountStatusByHandle: Map<string, RsiAffiliationAccountState>;
  staleHandles: string[];
  handlesWithAffiliations: number;
  affiliationCount: number;
  redactedAffiliationMentions: number;
}

export interface RsiAffiliationQueueResult {
  queued: number;
  skipped: number;
  queueDepth: number;
}

export interface RsiAffiliationHandleRefreshResult {
  handle: string;
  status: RsiAffiliationAccountStatus;
  affiliations: number;
  message?: string;
}

export interface RsiAffiliationBatchRefreshResult {
  attempted: number;
  processed: number;
  unavailable: number;
  deleted: number;
  banned: number;
  durationMs: number;
}

interface BatchCounters {
  processed: number;
  unavailable: number;
  deleted: number;
  banned: number;
}

export class RsiIntelAffiliationRefreshService {
  private readonly citizenOrgRepository: Repository<RsiCitizenOrg>;
  private readonly queue: RefreshQueueItem[] = [];
  private readonly queuedHandles = new Set<string>();
  private readonly inFlightHandles = new Set<string>();
  private readonly recentRefreshAttempts = new Map<string, number>();
  private readonly recentAccountStatuses = new Map<string, RsiAffiliationAccountState>();
  private processing = false;

  constructor() {
    this.citizenOrgRepository = AppDataSource.getRepository(RsiCitizenOrg);
  }

  public async loadCachedAffiliations(
    handles: string[],
    staleAfterHours: number = DEFAULT_STALE_HOURS
  ): Promise<RsiAffiliationCacheResult> {
    this.pruneAccountStatuses();

    const normalizedByLower = new Map<string, string>();
    for (const handle of handles) {
      const trimmed = handle.trim();
      if (!trimmed) {
        continue;
      }
      const lower = trimmed.toLowerCase();
      if (!normalizedByLower.has(lower)) {
        normalizedByLower.set(lower, trimmed);
      }
    }

    if (normalizedByLower.size === 0) {
      return {
        affiliationsByHandle: new Map<string, RsiCitizenOrg[]>(),
        accountStatusByHandle: new Map<string, RsiAffiliationAccountState>(),
        staleHandles: [],
        handlesWithAffiliations: 0,
        affiliationCount: 0,
        redactedAffiliationMentions: 0,
      };
    }

    const handleLowers = Array.from(normalizedByLower.keys());
    const rows = await this.citizenOrgRepository
      .createQueryBuilder('citizenOrg')
      .where('LOWER(citizenOrg.citizenHandle) IN (:...handleLowers)', {
        handleLowers,
      })
      .orderBy('citizenOrg.lastFetchedAt', 'DESC')
      .getMany();

    const affiliationsByHandle = new Map<string, RsiCitizenOrg[]>();
    for (const row of rows) {
      const handleLower = row.citizenHandle.toLowerCase();
      if (!affiliationsByHandle.has(handleLower)) {
        affiliationsByHandle.set(handleLower, []);
      }
      affiliationsByHandle.get(handleLower)?.push(row);
    }

    const staleHandles: string[] = [];
    const accountStatusByHandle = new Map<string, RsiAffiliationAccountState>();
    let handlesWithAffiliations = 0;
    let affiliationCount = 0;
    let redactedAffiliationMentions = 0;

    const staleWindowMs = staleAfterHours * 60 * 60 * 1000;

    for (const [handleLower, canonicalHandle] of normalizedByLower.entries()) {
      const evaluation = this.evaluateHandleAffiliationCache(
        handleLower,
        affiliationsByHandle,
        staleWindowMs
      );

      accountStatusByHandle.set(handleLower, evaluation.accountState);
      affiliationsByHandle.set(handleLower, evaluation.affiliations);

      if (evaluation.hasAffiliations) {
        handlesWithAffiliations += 1;
      }

      affiliationCount += evaluation.affiliationCount;
      redactedAffiliationMentions += evaluation.redactedAffiliationMentions;

      if (
        evaluation.isStale &&
        this.canAttemptRefresh(handleLower) &&
        evaluation.accountState.status !== 'deleted' &&
        evaluation.accountState.status !== 'banned'
      ) {
        staleHandles.push(canonicalHandle);
      }
    }

    return {
      affiliationsByHandle,
      accountStatusByHandle,
      staleHandles,
      handlesWithAffiliations,
      affiliationCount,
      redactedAffiliationMentions,
    };
  }

  public enqueueRefresh(
    handles: string[],
    options?: {
      organizationId?: string;
      maxQueued?: number;
    }
  ): RsiAffiliationQueueResult {
    const maxQueued = Math.max(1, options?.maxQueued ?? DEFAULT_MAX_QUEUE_PER_REQUEST);
    const uniqueHandles = new Map<string, string>();

    for (const handle of handles) {
      const trimmed = handle.trim();
      if (!trimmed) {
        continue;
      }
      const lower = trimmed.toLowerCase();
      if (!uniqueHandles.has(lower)) {
        uniqueHandles.set(lower, trimmed);
      }
    }

    let queued = 0;
    let skipped = 0;

    for (const [handleLower, handle] of uniqueHandles.entries()) {
      if (queued >= maxQueued) {
        skipped += 1;
        continue;
      }

      if (!this.canAttemptRefresh(handleLower)) {
        skipped += 1;
        continue;
      }

      if (this.queuedHandles.has(handleLower) || this.inFlightHandles.has(handleLower)) {
        skipped += 1;
        continue;
      }

      this.queue.push({
        handle,
        organizationId: options?.organizationId,
      });
      this.queuedHandles.add(handleLower);
      this.markRefreshAttempt(handleLower);
      queued += 1;
    }

    if (queued > 0) {
      void this.processQueue();
    }

    return {
      queued,
      skipped,
      queueDepth: this.queue.length,
    };
  }

  public async refreshHandlesBatch(
    handles: string[],
    options?: {
      maxHandles?: number;
      maxRuntimeMs?: number;
      delayMs?: number;
      organizationId?: string;
    }
  ): Promise<RsiAffiliationBatchRefreshResult> {
    const maxHandles = Math.max(1, options?.maxHandles ?? DEFAULT_BATCH_SIZE);
    const maxRuntimeMs = Math.max(5_000, options?.maxRuntimeMs ?? 10 * 60 * 1000);
    const delayMs = Math.max(0, options?.delayMs ?? 500);

    const dedupedHandles = new Map<string, string>();
    for (const rawHandle of handles) {
      const trimmedHandle = rawHandle.trim();
      if (!trimmedHandle) {
        continue;
      }

      const handleLower = trimmedHandle.toLowerCase();
      if (!dedupedHandles.has(handleLower)) {
        dedupedHandles.set(handleLower, trimmedHandle);
      }
    }

    const normalized = Array.from(dedupedHandles.values()).slice(0, maxHandles);

    const startedAt = Date.now();
    const counters: BatchCounters = {
      processed: 0,
      unavailable: 0,
      deleted: 0,
      banned: 0,
    };

    const circuitStatus = rsiCrawlerService.getCircuitStatus();
    if (circuitStatus.state === 'open') {
      logger.info(
        'Skipping RSI affiliation batch refresh because crawler circuit breaker is open',
        {
          failures: circuitStatus.failures,
        }
      );

      return this.buildBatchResult(normalized.length, counters, startedAt);
    }

    for (const handle of normalized) {
      if (Date.now() - startedAt > maxRuntimeMs) {
        break;
      }

      const result = await this.refreshHandle({
        handle,
        organizationId: options?.organizationId,
      });

      const shouldStop = this.updateBatchCountersAndCheckEarlyStop(handle, result, counters);
      if (shouldStop) {
        break;
      }

      if (delayMs > 0 && counters.processed < normalized.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return this.buildBatchResult(normalized.length, counters, startedAt);
  }

  private buildBatchResult(
    attempted: number,
    counters: BatchCounters,
    startedAt: number
  ): RsiAffiliationBatchRefreshResult {
    return {
      attempted,
      processed: counters.processed,
      unavailable: counters.unavailable,
      deleted: counters.deleted,
      banned: counters.banned,
      durationMs: Date.now() - startedAt,
    };
  }

  private updateBatchCountersAndCheckEarlyStop(
    handle: string,
    result: RsiAffiliationHandleRefreshResult,
    counters: BatchCounters
  ): boolean {
    counters.processed += 1;

    if (result.status === 'unavailable') {
      counters.unavailable += 1;
      if (this.isCrawlerControlPathUnavailable(result.message)) {
        logger.info(
          'Stopping RSI affiliation batch refresh early due to crawler control-path unavailability',
          {
            handle,
            message: result.message,
          }
        );
        return true;
      }
      return false;
    }

    if (result.status === 'deleted') {
      counters.deleted += 1;
      return false;
    }

    if (result.status === 'banned') {
      counters.banned += 1;
    }

    return false;
  }

  private canAttemptRefresh(handleLower: string): boolean {
    const lastAttempt = this.recentRefreshAttempts.get(handleLower);
    if (!lastAttempt) {
      return true;
    }

    const retryWindowMs = DEFAULT_RETRY_WINDOW_MINUTES * 60 * 1000;
    return Date.now() - lastAttempt > retryWindowMs;
  }

  private markRefreshAttempt(handleLower: string): void {
    this.recentRefreshAttempts.set(handleLower, Date.now());
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, DEFAULT_BATCH_SIZE);

        for (const item of batch) {
          const handleLower = item.handle.toLowerCase();
          this.queuedHandles.delete(handleLower);
          this.inFlightHandles.add(handleLower);
        }

        for (const item of batch) {
          try {
            await this.refreshHandle(item);
          } finally {
            this.inFlightHandles.delete(item.handle.toLowerCase());
          }
        }

        this.pruneAttemptHistory();
      }
    } finally {
      this.processing = false;
    }
  }

  private async refreshHandle(item: RefreshQueueItem): Promise<RsiAffiliationHandleRefreshResult> {
    const handleLower = item.handle.toLowerCase();

    try {
      const affiliations = await this.crawlMembershipsWithRateLimitRetry(item);
      const normalizedAffiliations = affiliations
        .map(affiliation => ({
          sid: affiliation.sid.trim().toUpperCase(),
          name: affiliation.name,
          rank: affiliation.rank,
          stars: affiliation.stars,
          isMain: affiliation.isMain,
        }))
        .filter(affiliation => Boolean(affiliation.sid));

      await this.replaceAffiliations(handleLower, normalizedAffiliations);

      this.setAccountStatus(handleLower, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      });

      logger.debug('RSI affiliation background refresh completed', {
        handle: item.handle,
        organizationId: item.organizationId,
        affiliations: normalizedAffiliations.length,
      });

      return {
        handle: item.handle,
        status: 'active',
        affiliations: normalizedAffiliations.length,
      };
    } catch (error: unknown) {
      const status = this.classifyAccountStatus(error);
      const message = this.toErrorMessage(error);

      if (status === 'deleted' || status === 'banned') {
        await this.deleteAffiliationsByHandle(handleLower);
      }

      this.setAccountStatus(handleLower, {
        status,
        updatedAt: new Date().toISOString(),
        message,
      });

      logger.warn('RSI affiliation background refresh failed', {
        handle: item.handle,
        organizationId: item.organizationId,
        status,
        error: message,
      });

      return {
        handle: item.handle,
        status,
        affiliations: 0,
        message,
      };
    }
  }

  private async crawlMembershipsWithRateLimitRetry(
    item: RefreshQueueItem
  ): Promise<Awaited<ReturnType<typeof rsiCrawlerService.crawlUserMemberships>>> {
    try {
      return await rsiCrawlerService.crawlUserMemberships(item.handle);
    } catch (error: unknown) {
      const message = this.toErrorMessage(error);
      if (!this.isRateLimitControlPathUnavailable(message)) {
        throw error;
      }

      const delayMs = this.computeRateLimitRetryDelayMs();
      logger.info(
        'RSI affiliation refresh hit rate-limit control path; retrying once with jitter',
        {
          handle: item.handle,
          organizationId: item.organizationId,
          delayMs,
          error: message,
        }
      );

      await this.wait(delayMs);
      return rsiCrawlerService.crawlUserMemberships(item.handle);
    }
  }

  private resolveAccountState(handleLower: string): RsiAffiliationAccountState {
    const cached = this.recentAccountStatuses.get(handleLower);
    if (cached && !this.isAccountStatusExpired(cached)) {
      return cached;
    }

    return {
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
  }

  private evaluateHandleAffiliationCache(
    handleLower: string,
    affiliationsByHandle: Map<string, RsiCitizenOrg[]>,
    staleWindowMs: number
  ): {
    accountState: RsiAffiliationAccountState;
    affiliations: RsiCitizenOrg[];
    hasAffiliations: boolean;
    affiliationCount: number;
    redactedAffiliationMentions: number;
    isStale: boolean;
  } {
    const rawAffiliations = affiliationsByHandle.get(handleLower) ?? [];
    const accountState = this.resolveAccountState(handleLower);
    const affiliations = accountState.status === 'active' ? rawAffiliations : [];

    const newestFetchedAt = affiliations.reduce<Date | undefined>((latest, affiliation) => {
      if (!latest || affiliation.lastFetchedAt > latest) {
        return affiliation.lastFetchedAt;
      }
      return latest;
    }, undefined);

    return {
      accountState,
      affiliations,
      hasAffiliations: affiliations.length > 0,
      affiliationCount: affiliations.length,
      redactedAffiliationMentions: affiliations.filter(
        row => row.organizationSid.trim().toUpperCase() === 'REDACTED'
      ).length,
      isStale: !newestFetchedAt || Date.now() - newestFetchedAt.getTime() > staleWindowMs,
    };
  }

  private classifyAccountStatus(error: unknown): RsiAffiliationAccountStatus {
    const message = this.toErrorMessage(error).toLowerCase();

    if (
      message.includes('404') ||
      message.includes('410') ||
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('deleted')
    ) {
      return 'deleted';
    }

    if (
      message.includes('403') ||
      message.includes('451') ||
      message.includes('forbidden') ||
      message.includes('banned') ||
      message.includes('suspended') ||
      message.includes('restricted')
    ) {
      return 'banned';
    }

    return 'unavailable';
  }

  private isCrawlerControlPathUnavailable(message?: string): boolean {
    if (!message) {
      return false;
    }

    const lowered = message.toLowerCase();
    return lowered.includes('circuit breaker') || lowered.includes('rate limit');
  }

  private isRateLimitControlPathUnavailable(message?: string): boolean {
    if (!message) {
      return false;
    }

    const lowered = message.toLowerCase();
    return (
      lowered.includes('rate limit') ||
      lowered.includes('too many requests') ||
      lowered.includes('status code 429') ||
      lowered.includes(' 429')
    );
  }

  private computeRateLimitRetryDelayMs(): number {
    if (RATE_LIMIT_RETRY_MAX_DELAY_MS <= RATE_LIMIT_RETRY_MIN_DELAY_MS) {
      return RATE_LIMIT_RETRY_MIN_DELAY_MS;
    }

    return (
      RATE_LIMIT_RETRY_MIN_DELAY_MS +
      Math.floor(
        Math.random() * (RATE_LIMIT_RETRY_MAX_DELAY_MS - RATE_LIMIT_RETRY_MIN_DELAY_MS + 1)
      )
    );
  }

  private async wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  private async replaceAffiliations(
    handleLower: string,
    affiliations: Array<{
      sid: string;
      name: string;
      rank?: string;
      stars: number;
      isMain: boolean;
    }>
  ): Promise<void> {
    const deduped = new Map<string, (typeof affiliations)[number]>();
    for (const affiliation of affiliations) {
      if (!deduped.has(affiliation.sid)) {
        deduped.set(affiliation.sid, affiliation);
      }
    }

    await this.deleteAffiliationsByHandle(handleLower);

    if (deduped.size === 0) {
      return;
    }

    const now = new Date();
    const rows = Array.from(deduped.values()).map(affiliation =>
      this.citizenOrgRepository.create({
        citizenHandle: handleLower,
        organizationSid: affiliation.sid,
        organizationName: affiliation.name,
        rank: affiliation.rank,
        stars: affiliation.stars,
        isMain: affiliation.isMain,
        isAffiliate: !affiliation.isMain,
        lastFetchedAt: now,
      })
    );

    await this.citizenOrgRepository.save(rows);
  }

  private async deleteAffiliationsByHandle(handleLower: string): Promise<void> {
    await this.citizenOrgRepository
      .createQueryBuilder()
      .delete()
      .from(RsiCitizenOrg)
      .where('LOWER(citizenHandle) = :handleLower', { handleLower })
      .execute();
  }

  private setAccountStatus(handleLower: string, state: RsiAffiliationAccountState): void {
    this.recentAccountStatuses.set(handleLower, state);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const potentialMessage = record.message;
      if (typeof potentialMessage === 'string' && potentialMessage.trim()) {
        return potentialMessage;
      }
    }

    return 'Unknown error';
  }

  private isAccountStatusExpired(state: RsiAffiliationAccountState): boolean {
    const updatedAtMs = Date.parse(state.updatedAt);
    if (!Number.isFinite(updatedAtMs)) {
      return true;
    }

    return Date.now() - updatedAtMs > ACCOUNT_STATUS_TTL_HOURS * 60 * 60 * 1000;
  }

  private pruneAccountStatuses(): void {
    for (const [handleLower, state] of this.recentAccountStatuses.entries()) {
      if (this.isAccountStatusExpired(state)) {
        this.recentAccountStatuses.delete(handleLower);
      }
    }
  }

  private pruneAttemptHistory(): void {
    if (this.recentRefreshAttempts.size <= 2000) {
      return;
    }

    const retryWindowMs = DEFAULT_RETRY_WINDOW_MINUTES * 60 * 1000;
    const cutoff = Date.now() - retryWindowMs * 4;

    for (const [handleLower, timestamp] of this.recentRefreshAttempts.entries()) {
      if (
        timestamp < cutoff &&
        !this.queuedHandles.has(handleLower) &&
        !this.inFlightHandles.has(handleLower)
      ) {
        this.recentRefreshAttempts.delete(handleLower);
      }
    }
  }
}

export const rsiIntelAffiliationRefreshService = new RsiIntelAffiliationRefreshService();

