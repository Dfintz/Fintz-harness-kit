import { RsiCitizenOrg } from '../../models/RsiCitizenOrg';
export type RsiAffiliationAccountStatus = 'active' | 'deleted' | 'banned' | 'unavailable';
export interface RsiAffiliationAccountState {
    status: RsiAffiliationAccountStatus;
    updatedAt: string;
    message?: string;
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
export declare class RsiIntelAffiliationRefreshService {
    private readonly citizenOrgRepository;
    private readonly queue;
    private readonly queuedHandles;
    private readonly inFlightHandles;
    private readonly recentRefreshAttempts;
    private readonly recentAccountStatuses;
    private processing;
    constructor();
    loadCachedAffiliations(handles: string[], staleAfterHours?: number): Promise<RsiAffiliationCacheResult>;
    enqueueRefresh(handles: string[], options?: {
        organizationId?: string;
        maxQueued?: number;
    }): RsiAffiliationQueueResult;
    refreshHandlesBatch(handles: string[], options?: {
        maxHandles?: number;
        maxRuntimeMs?: number;
        delayMs?: number;
        organizationId?: string;
    }): Promise<RsiAffiliationBatchRefreshResult>;
    private buildBatchResult;
    private updateBatchCountersAndCheckEarlyStop;
    private canAttemptRefresh;
    private markRefreshAttempt;
    private processQueue;
    private refreshHandle;
    private crawlMembershipsWithRateLimitRetry;
    private resolveAccountState;
    private evaluateHandleAffiliationCache;
    private classifyAccountStatus;
    private isCrawlerControlPathUnavailable;
    private isRateLimitControlPathUnavailable;
    private computeRateLimitRetryDelayMs;
    private wait;
    private replaceAffiliations;
    private deleteAffiliationsByHandle;
    private setAccountStatus;
    private toErrorMessage;
    private isAccountStatusExpired;
    private pruneAccountStatuses;
    private pruneAttemptHistory;
}
export declare const rsiIntelAffiliationRefreshService: RsiIntelAffiliationRefreshService;
//# sourceMappingURL=RsiIntelAffiliationRefreshService.d.ts.map