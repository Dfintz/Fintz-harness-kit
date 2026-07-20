type AdapterMode = 'unknown' | 'in-memory' | 'redis';
type WebSocketRoomScope = 'org' | 'fleet' | 'activity' | 'trading' | 'tunnel';
interface DiagnosticsErrorSample {
    readonly timestamp: string;
    readonly action: string;
    readonly error: string;
}
interface ActionCount {
    readonly action: string;
    readonly count: number;
}
interface IpcFallbackRateBreakdown {
    readonly action: string;
    readonly requests: number;
    readonly fallbackResolutions: number;
    readonly fallbackRatePercent: number;
}
interface WebSocketRoomSubscriptionScopeBreakdown {
    readonly attemptsTotal: number;
    readonly acceptedTotal: number;
    readonly rejectedTotal: number;
    readonly acceptanceRatePercent: number;
    readonly rejectionRatePercent: number;
}
export type IpcHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export interface IpcHealthSnapshot {
    readonly status: IpcHealthStatus;
    readonly reasons: readonly string[];
    readonly signals: {
        readonly requestsTotal: number;
        readonly successRatePercent: number;
        readonly notHandledRatePercent: number;
        readonly pendingCurrent: number;
        readonly pendingHighWatermark: number;
        readonly pendingLimit: number | null;
        readonly pendingSaturationPercent: number | null;
        readonly timeoutsTotal: number;
        readonly unavailableTotal: number;
        readonly overloadRejectionsTotal: number;
        readonly publishFailuresTotal: number;
    };
}
export declare class RealtimeResilienceDiagnosticsService {
    private readonly startedAtMs;
    private ipcRequestsTotal;
    private ipcSuccessesTotal;
    private ipcFailuresTotal;
    private ipcTimeoutsTotal;
    private ipcUnavailableTotal;
    private ipcPublishFailuresTotal;
    private ipcOverloadRejectionsTotal;
    private ipcPublishRetryAttemptsTotal;
    private ipcPendingCurrent;
    private ipcPendingHighWatermark;
    private ipcPendingLimitObserved;
    private ipcCommandsHandledTotal;
    private ipcCommandsNoHandlerTotal;
    private ipcNonDefinitiveResponsesTotal;
    private ipcFallbackResolutionsTotal;
    private readonly ipcLatencySamples;
    private readonly ipcErrors;
    private readonly ipcRequestCountsByAction;
    private readonly ipcNoHandlerCountsByAction;
    private readonly ipcFallbackResolutionsByAction;
    private readonly ipcOverloadCountsByAction;
    private readonly ipcPublishRetryAttemptsByAction;
    private readonly ipcResponsesByShard;
    private websocketInitializationsTotal;
    private websocketConnectionsTotal;
    private websocketDisconnectionsTotal;
    private websocketAuthenticationFailuresTotal;
    private websocketSocketErrorsTotal;
    private websocketAdapterMode;
    private websocketAdapterReason;
    private websocketAdapterModeUpdatedAt;
    private websocketAdapterAttachAttemptsTotal;
    private websocketAdapterAttachSuccessesTotal;
    private websocketAdapterAttachFailuresTotal;
    private websocketAdapterLastAttachLatencyMs;
    private websocketCoalesceFlushesTotal;
    private websocketCoalesceImmediateFlushesTotal;
    private websocketCoalesceItemsFlushedTotal;
    private websocketCoalesceMaxBatchSize;
    private websocketCoalesceDroppedEventsTotal;
    private readonly websocketCoalesceFlushesByEvent;
    private readonly websocketCoalesceDropsByReason;
    private readonly websocketDisconnectReasons;
    private readonly websocketAuthFailureReasons;
    private websocketRoomSubscriptionAttemptsTotal;
    private websocketRoomSubscriptionAcceptedTotal;
    private websocketRoomSubscriptionRejectedTotal;
    private readonly websocketRoomSubscriptionRejectionReasons;
    private readonly websocketRoomSubscriptionAttemptsByScope;
    private readonly websocketRoomSubscriptionAcceptedByScope;
    private readonly websocketRoomSubscriptionRejectedByScope;
    recordIpcRequest(action: string, pendingDepth: number): void;
    updateIpcPendingDepth(depth: number): void;
    recordIpcResponse(action: string, success: boolean, latencyMs: number, errorMessage?: string): void;
    recordIpcTimeout(action: string, timeoutMs: number): void;
    recordIpcUnavailable(action: string): void;
    recordIpcPublishFailure(action: string, errorMessage: string): void;
    recordIpcOverloadRejection(action: string, pendingDepth: number, limit: number): void;
    recordIpcPublishRetryAttempt(action: string): void;
    recordIpcCommandHandled(): void;
    recordIpcCommandNoHandler(action: string): void;
    recordIpcNonDefinitiveResponse(action: string): void;
    recordIpcFallbackResolution(action: string): void;
    recordIpcResponseSourceShard(shardId: number): void;
    recordWebSocketInitialized(): void;
    recordWebSocketConnection(): void;
    recordWebSocketDisconnection(reason: string): void;
    recordWebSocketAuthenticationFailure(reason: string): void;
    recordWebSocketSocketError(): void;
    recordWebSocketRoomSubscriptionAttempt(scope?: WebSocketRoomScope): void;
    recordWebSocketRoomSubscriptionAccepted(scope: WebSocketRoomScope): void;
    recordWebSocketRoomSubscriptionRejected(reason: string, scope?: WebSocketRoomScope): void;
    recordWebSocketAdapterAttachAttempt(): void;
    recordWebSocketAdapterAttached(mode: AdapterMode, reason: string, latencyMs?: number): void;
    recordWebSocketAdapterAttachFailure(reason: string): void;
    recordWebSocketCoalesceFlush(event: string, batchSize: number, immediate: boolean): void;
    recordWebSocketCoalesceDrop(event: string, reason: string, count?: number): void;
    getIpcHealthSnapshot(): IpcHealthSnapshot;
    getDiagnostics(): {
        timestamp: string;
        uptimeMs: number;
        ipc: {
            health: IpcHealthSnapshot;
            requestsTotal: number;
            successesTotal: number;
            failuresTotal: number;
            timeoutsTotal: number;
            unavailableTotal: number;
            publishFailuresTotal: number;
            overloadRejectionsTotal: number;
            publishRetryAttemptsTotal: number;
            successRatePercent: number;
            pendingCurrent: number;
            pendingHighWatermark: number;
            commandsHandledTotal: number;
            commandsNoHandlerTotal: number;
            nonDefinitiveResponsesTotal: number;
            notHandledRatePercent: number;
            fallbackResolutionsTotal: number;
            fallbackRateByAction: IpcFallbackRateBreakdown[];
            responseSourceShards: ActionCount[];
            averageLatencyMs: number;
            p95LatencyMs: number;
            topRequestActions: ActionCount[];
            topNoHandlerActions: ActionCount[];
            topOverloadedActions: ActionCount[];
            topPublishRetryActions: ActionCount[];
            recentErrors: readonly DiagnosticsErrorSample[];
        };
        websocket: {
            initializationsTotal: number;
            lifecycle: {
                connectionsTotal: number;
                disconnectionsTotal: number;
                authenticationFailuresTotal: number;
                socketErrorsTotal: number;
                topDisconnectReasons: ActionCount[];
                topAuthenticationFailureReasons: ActionCount[];
            };
            roomSubscriptions: {
                attemptsTotal: number;
                acceptedTotal: number;
                rejectedTotal: number;
                rejectionRatePercent: number;
                topRejectionReasons: ActionCount[];
                scopeBreakdown: Record<WebSocketRoomScope, WebSocketRoomSubscriptionScopeBreakdown>;
            };
            adapter: {
                mode: AdapterMode;
                reason: string;
                modeUpdatedAt: string;
                attachAttemptsTotal: number;
                attachSuccessesTotal: number;
                attachFailuresTotal: number;
                lastAttachLatencyMs: number | null;
            };
            coalescing: {
                flushesTotal: number;
                immediateFlushesTotal: number;
                itemsFlushedTotal: number;
                maxBatchSize: number;
                averageBatchSize: number;
                droppedEventsTotal: number;
                topFlushedEvents: ActionCount[];
                topDropReasons: ActionCount[];
            };
        };
    };
    resetForTests(): void;
    private setWebSocketAdapterMode;
    private pushIpcError;
}
export declare const realtimeResilienceDiagnosticsService: RealtimeResilienceDiagnosticsService;
export {};
//# sourceMappingURL=RealtimeResilienceDiagnosticsService.d.ts.map