import { trackEvent, trackMetric } from '../../config/applicationInsights';
import { logger } from '../../utils/logger';
import { sanitizeRedisErrorForLogging } from '../../utils/redis';

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

/** Coarse IPC health verdict for operator dashboards and probe signals (ARCH-05). */
export type IpcHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Point-in-time IPC health classification derived from the resilience counters.
 *
 * `status` is a coarse verdict operators (and a probe endpoint) can act on;
 * `reasons` lists the machine-readable signals that drove a non-healthy verdict;
 * `signals` exposes the underlying numbers for transparency.
 *
 * Note: success/not-handled rates are aggregates since process start (smoothed),
 * while `pendingCurrent` is live — so backpressure is reflected immediately while
 * failure-rate verdicts require sustained badness (intentionally coarse).
 */
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

const IPC_LATENCY_SAMPLE_LIMIT = 512;
const IPC_ERROR_SAMPLE_LIMIT = 32;

/**
 * IPC health classification thresholds (ARCH-05). Kept as named constants so the
 * verdict is explainable and tunable in one place.
 */
/** Minimum requests before failure-rate verdicts apply (avoids tiny-sample false alarms). */
const IPC_HEALTH_MIN_SAMPLE = 20;
/** Aggregate success rate below this (with sample) → unhealthy. */
const IPC_HEALTH_UNHEALTHY_SUCCESS_RATE = 50;
/** Aggregate success rate below this (with sample) → degraded. */
const IPC_HEALTH_DEGRADED_SUCCESS_RATE = 90;
/** Non-definitive/fallback response rate above this (with sample) → degraded. */
const IPC_HEALTH_DEGRADED_NOT_HANDLED_RATE = 25;
/** Pending-queue saturation (current/limit) at/above this percent → degraded. */
const IPC_HEALTH_DEGRADED_PENDING_SATURATION = 50;

/** Computed IPC signals fed to the health classifiers. */
interface IpcHealthComputedSignals {
  readonly hasSample: boolean;
  readonly successRatePercent: number;
  readonly notHandledRatePercent: number;
  readonly pendingCurrent: number;
  readonly pendingLimit: number | null;
  readonly pendingSaturationPercent: number | null;
}

/** Reasons that make IPC `unhealthy` (queue saturated now / success rate collapsed). */
function evaluateIpcUnhealthyReasons(s: IpcHealthComputedSignals): string[] {
  const reasons: string[] = [];
  if (s.pendingLimit !== null && s.pendingCurrent >= s.pendingLimit) {
    reasons.push('pending_queue_saturated');
  }
  if (s.hasSample && s.successRatePercent < IPC_HEALTH_UNHEALTHY_SUCCESS_RATE) {
    reasons.push('low_success_rate');
  }
  return reasons;
}

/** Reasons that make IPC `degraded` (elevated failures/fallbacks or backpressure). */
function evaluateIpcDegradedReasons(s: IpcHealthComputedSignals): string[] {
  const reasons: string[] = [];
  if (s.hasSample && s.successRatePercent < IPC_HEALTH_DEGRADED_SUCCESS_RATE) {
    reasons.push('elevated_failure_rate');
  }
  if (s.hasSample && s.notHandledRatePercent > IPC_HEALTH_DEGRADED_NOT_HANDLED_RATE) {
    reasons.push('elevated_not_handled_rate');
  }
  if (
    s.pendingSaturationPercent !== null &&
    s.pendingSaturationPercent >= IPC_HEALTH_DEGRADED_PENDING_SATURATION
  ) {
    reasons.push('high_pending_depth');
  }
  return reasons;
}

const WEBSOCKET_ROOM_SCOPES: readonly WebSocketRoomScope[] = [
  'org',
  'fleet',
  'activity',
  'trading',
  'tunnel',
];

function truncateErrorMessage(message: string): string {
  const trimmed = message.trim();
  return trimmed.length <= 180 ? trimmed : `${trimmed.slice(0, 177)}...`;
}

function sanitizeDiagnosticsErrorMessage(errorMessage: string): string {
  const sanitized = sanitizeRedisErrorForLogging({ message: errorMessage });
  const sanitizedMessage = sanitized.message;

  if (typeof sanitizedMessage === 'string') {
    return truncateErrorMessage(sanitizedMessage);
  }

  return truncateErrorMessage(errorMessage);
}

function toPercentile(samples: readonly number[], percentile: number): number {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
  const safeIndex = Math.min(Math.max(rank, 0), sorted.length - 1);

  return sorted[safeIndex];
}

function incrementMap<TKey extends string>(
  map: Map<TKey, number>,
  key: TKey,
  value: number = 1
): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function mapToSortedArray(map: ReadonlyMap<string, number>, limit: number): ActionCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([action, count]) => ({ action, count }));
}

function toIpcFallbackRateBreakdown(
  requestCountsByAction: ReadonlyMap<string, number>,
  fallbackResolutionsByAction: ReadonlyMap<string, number>,
  limit: number
): IpcFallbackRateBreakdown[] {
  return [...fallbackResolutionsByAction.entries()]
    .map(([action, fallbackResolutions]) => {
      const requests = requestCountsByAction.get(action) ?? 0;
      const fallbackRatePercent = requests === 0 ? 0 : (fallbackResolutions / requests) * 100;

      return {
        action,
        requests,
        fallbackResolutions,
        fallbackRatePercent,
      };
    })
    .sort((a, b) => {
      if (b.fallbackResolutions !== a.fallbackResolutions) {
        return b.fallbackResolutions - a.fallbackResolutions;
      }

      return b.fallbackRatePercent - a.fallbackRatePercent;
    })
    .slice(0, limit)
    .map(item => ({
      ...item,
      fallbackRatePercent: Number(item.fallbackRatePercent.toFixed(2)),
    }));
}

function toWebSocketRoomScopeBreakdown(
  attemptsByScope: ReadonlyMap<WebSocketRoomScope, number>,
  acceptedByScope: ReadonlyMap<WebSocketRoomScope, number>,
  rejectedByScope: ReadonlyMap<WebSocketRoomScope, number>
): Record<WebSocketRoomScope, WebSocketRoomSubscriptionScopeBreakdown> {
  return WEBSOCKET_ROOM_SCOPES.reduce(
    (breakdown, scope) => {
      const attemptsTotal = attemptsByScope.get(scope) ?? 0;
      const acceptedTotal = acceptedByScope.get(scope) ?? 0;
      const rejectedTotal = rejectedByScope.get(scope) ?? 0;

      const acceptanceRatePercent = attemptsTotal === 0 ? 0 : (acceptedTotal / attemptsTotal) * 100;
      const rejectionRatePercent = attemptsTotal === 0 ? 0 : (rejectedTotal / attemptsTotal) * 100;

      breakdown[scope] = {
        attemptsTotal,
        acceptedTotal,
        rejectedTotal,
        acceptanceRatePercent: Number(acceptanceRatePercent.toFixed(2)),
        rejectionRatePercent: Number(rejectionRatePercent.toFixed(2)),
      };

      return breakdown;
    },
    {} as Record<WebSocketRoomScope, WebSocketRoomSubscriptionScopeBreakdown>
  );
}

/**
 * Realtime resilience diagnostics for IPC and WebSocket paths.
 *
 * Keeps a low-overhead in-memory snapshot so operators can baseline behavior
 * before semantic changes, and optionally emits a small subset of metrics/events
 * to Application Insights when configured.
 */
export class RealtimeResilienceDiagnosticsService {
  private readonly startedAtMs: number = Date.now();

  private ipcRequestsTotal = 0;
  private ipcSuccessesTotal = 0;
  private ipcFailuresTotal = 0;
  private ipcTimeoutsTotal = 0;
  private ipcUnavailableTotal = 0;
  private ipcPublishFailuresTotal = 0;
  private ipcOverloadRejectionsTotal = 0;
  private ipcPublishRetryAttemptsTotal = 0;
  private ipcPendingCurrent = 0;
  private ipcPendingHighWatermark = 0;
  private ipcPendingLimitObserved = 0;
  private ipcCommandsHandledTotal = 0;
  private ipcCommandsNoHandlerTotal = 0;
  private ipcNonDefinitiveResponsesTotal = 0;
  private ipcFallbackResolutionsTotal = 0;

  private readonly ipcLatencySamples: number[] = [];
  private readonly ipcErrors: DiagnosticsErrorSample[] = [];
  private readonly ipcRequestCountsByAction = new Map<string, number>();
  private readonly ipcNoHandlerCountsByAction = new Map<string, number>();
  private readonly ipcFallbackResolutionsByAction = new Map<string, number>();
  private readonly ipcOverloadCountsByAction = new Map<string, number>();
  private readonly ipcPublishRetryAttemptsByAction = new Map<string, number>();
  private readonly ipcResponsesByShard = new Map<string, number>();

  private websocketInitializationsTotal = 0;
  private websocketConnectionsTotal = 0;
  private websocketDisconnectionsTotal = 0;
  private websocketAuthenticationFailuresTotal = 0;
  private websocketSocketErrorsTotal = 0;
  private websocketAdapterMode: AdapterMode = 'unknown';
  private websocketAdapterReason = 'not_initialized';
  private websocketAdapterModeUpdatedAt = new Date().toISOString();
  private websocketAdapterAttachAttemptsTotal = 0;
  private websocketAdapterAttachSuccessesTotal = 0;
  private websocketAdapterAttachFailuresTotal = 0;
  private websocketAdapterLastAttachLatencyMs: number | null = null;

  private websocketCoalesceFlushesTotal = 0;
  private websocketCoalesceImmediateFlushesTotal = 0;
  private websocketCoalesceItemsFlushedTotal = 0;
  private websocketCoalesceMaxBatchSize = 0;
  private websocketCoalesceDroppedEventsTotal = 0;
  private readonly websocketCoalesceFlushesByEvent = new Map<string, number>();
  private readonly websocketCoalesceDropsByReason = new Map<string, number>();
  private readonly websocketDisconnectReasons = new Map<string, number>();
  private readonly websocketAuthFailureReasons = new Map<string, number>();
  private websocketRoomSubscriptionAttemptsTotal = 0;
  private websocketRoomSubscriptionAcceptedTotal = 0;
  private websocketRoomSubscriptionRejectedTotal = 0;
  private readonly websocketRoomSubscriptionRejectionReasons = new Map<string, number>();
  private readonly websocketRoomSubscriptionAttemptsByScope = new Map<WebSocketRoomScope, number>();
  private readonly websocketRoomSubscriptionAcceptedByScope = new Map<WebSocketRoomScope, number>();
  private readonly websocketRoomSubscriptionRejectedByScope = new Map<WebSocketRoomScope, number>();

  public recordIpcRequest(action: string, pendingDepth: number): void {
    this.ipcRequestsTotal += 1;
    this.updateIpcPendingDepth(pendingDepth);
    incrementMap(this.ipcRequestCountsByAction, action);
  }

  public updateIpcPendingDepth(depth: number): void {
    this.ipcPendingCurrent = Math.max(depth, 0);
    this.ipcPendingHighWatermark = Math.max(this.ipcPendingHighWatermark, this.ipcPendingCurrent);
    trackMetric('realtime.ipc.pending_depth', this.ipcPendingCurrent);
  }

  public recordIpcResponse(
    action: string,
    success: boolean,
    latencyMs: number,
    errorMessage?: string
  ): void {
    if (success) {
      this.ipcSuccessesTotal += 1;
    } else {
      this.ipcFailuresTotal += 1;
      this.pushIpcError(action, errorMessage ?? 'unknown_response_failure');
    }

    this.ipcLatencySamples.push(Math.max(latencyMs, 0));
    if (this.ipcLatencySamples.length > IPC_LATENCY_SAMPLE_LIMIT) {
      this.ipcLatencySamples.shift();
    }

    trackMetric('realtime.ipc.response_latency_ms', Math.max(latencyMs, 0));
  }

  public recordIpcTimeout(action: string, timeoutMs: number): void {
    this.ipcTimeoutsTotal += 1;
    this.ipcFailuresTotal += 1;
    this.pushIpcError(action, `timeout_${timeoutMs}ms`);

    trackMetric('realtime.ipc.timeouts_total', this.ipcTimeoutsTotal);
    trackEvent('realtime.ipc.timeout', {
      action,
      timeoutMs: String(timeoutMs),
    });
  }

  public recordIpcUnavailable(action: string): void {
    this.ipcUnavailableTotal += 1;
    this.pushIpcError(action, 'ipc_unavailable');

    trackMetric('realtime.ipc.unavailable_total', this.ipcUnavailableTotal);
  }

  public recordIpcPublishFailure(action: string, errorMessage: string): void {
    this.ipcPublishFailuresTotal += 1;
    this.ipcFailuresTotal += 1;
    this.pushIpcError(action, `publish_failure:${errorMessage}`);

    trackEvent('realtime.ipc.publish_failure', {
      action,
      error: truncateErrorMessage(errorMessage),
    });
  }

  public recordIpcOverloadRejection(action: string, pendingDepth: number, limit: number): void {
    this.ipcOverloadRejectionsTotal += 1;
    this.ipcFailuresTotal += 1;
    incrementMap(this.ipcOverloadCountsByAction, action);
    if (limit > 0) {
      this.ipcPendingLimitObserved = Math.max(this.ipcPendingLimitObserved, limit);
    }
    this.pushIpcError(action, `overload_rejected:${pendingDepth}/${limit}`);

    trackEvent('realtime.ipc.overload_rejection', {
      action,
      pendingDepth: String(Math.max(pendingDepth, 0)),
      limit: String(Math.max(limit, 0)),
      rejectionsTotal: String(this.ipcOverloadRejectionsTotal),
    });
  }

  public recordIpcPublishRetryAttempt(action: string): void {
    this.ipcPublishRetryAttemptsTotal += 1;
    incrementMap(this.ipcPublishRetryAttemptsByAction, action);

    trackMetric('realtime.ipc.publish_retries_total', this.ipcPublishRetryAttemptsTotal);
  }

  public recordIpcCommandHandled(): void {
    this.ipcCommandsHandledTotal += 1;
  }

  public recordIpcCommandNoHandler(action: string): void {
    this.ipcCommandsNoHandlerTotal += 1;
    incrementMap(this.ipcNoHandlerCountsByAction, action);
  }

  public recordIpcNonDefinitiveResponse(action: string): void {
    this.ipcNonDefinitiveResponsesTotal += 1;
    incrementMap(this.ipcNoHandlerCountsByAction, action);
  }

  public recordIpcFallbackResolution(action: string): void {
    this.ipcFallbackResolutionsTotal += 1;
    incrementMap(this.ipcFallbackResolutionsByAction, action);

    trackEvent('realtime.ipc.fallback_resolution', {
      action,
      resolutionsTotal: String(this.ipcFallbackResolutionsTotal),
    });
  }

  public recordIpcResponseSourceShard(shardId: number): void {
    const normalizedShardId = Number.isInteger(shardId) ? shardId : Math.trunc(shardId);
    incrementMap(this.ipcResponsesByShard, `shard:${normalizedShardId}`);
  }

  public recordWebSocketInitialized(): void {
    this.websocketInitializationsTotal += 1;
  }

  public recordWebSocketConnection(): void {
    this.websocketConnectionsTotal += 1;
  }

  public recordWebSocketDisconnection(reason: string): void {
    this.websocketDisconnectionsTotal += 1;
    incrementMap(this.websocketDisconnectReasons, reason);
  }

  public recordWebSocketAuthenticationFailure(reason: string): void {
    this.websocketAuthenticationFailuresTotal += 1;
    incrementMap(this.websocketAuthFailureReasons, reason);

    trackEvent('realtime.websocket.authentication_failure', {
      reason,
      failuresTotal: String(this.websocketAuthenticationFailuresTotal),
    });
  }

  public recordWebSocketSocketError(): void {
    this.websocketSocketErrorsTotal += 1;
  }

  public recordWebSocketRoomSubscriptionAttempt(scope?: WebSocketRoomScope): void {
    this.websocketRoomSubscriptionAttemptsTotal += 1;

    if (scope) {
      incrementMap(this.websocketRoomSubscriptionAttemptsByScope, scope);
    }
  }

  public recordWebSocketRoomSubscriptionAccepted(scope: WebSocketRoomScope): void {
    this.websocketRoomSubscriptionAcceptedTotal += 1;
    incrementMap(this.websocketRoomSubscriptionAcceptedByScope, scope);
  }

  public recordWebSocketRoomSubscriptionRejected(reason: string, scope?: WebSocketRoomScope): void {
    this.websocketRoomSubscriptionRejectedTotal += 1;
    incrementMap(this.websocketRoomSubscriptionRejectionReasons, reason);

    if (scope) {
      incrementMap(this.websocketRoomSubscriptionRejectedByScope, scope);
    }

    trackEvent('realtime.websocket.room_subscription_rejected', {
      reason,
      rejectionsTotal: String(this.websocketRoomSubscriptionRejectedTotal),
    });
  }

  public recordWebSocketAdapterAttachAttempt(): void {
    this.websocketAdapterAttachAttemptsTotal += 1;
  }

  public recordWebSocketAdapterAttached(
    mode: AdapterMode,
    reason: string,
    latencyMs?: number
  ): void {
    this.websocketAdapterAttachSuccessesTotal += 1;
    this.websocketAdapterLastAttachLatencyMs =
      typeof latencyMs === 'number'
        ? Math.max(latencyMs, 0)
        : this.websocketAdapterLastAttachLatencyMs;

    this.setWebSocketAdapterMode(mode, reason);

    if (typeof latencyMs === 'number') {
      trackMetric('realtime.websocket.adapter_attach_latency_ms', Math.max(latencyMs, 0));
    }
  }

  public recordWebSocketAdapterAttachFailure(reason: string): void {
    this.websocketAdapterAttachFailuresTotal += 1;
    this.setWebSocketAdapterMode('in-memory', reason);

    trackEvent('realtime.websocket.adapter_attach_failure', {
      reason,
      failuresTotal: String(this.websocketAdapterAttachFailuresTotal),
    });
  }

  public recordWebSocketCoalesceFlush(event: string, batchSize: number, immediate: boolean): void {
    const safeBatchSize = Math.max(batchSize, 0);

    this.websocketCoalesceFlushesTotal += 1;
    this.websocketCoalesceItemsFlushedTotal += safeBatchSize;
    this.websocketCoalesceMaxBatchSize = Math.max(
      this.websocketCoalesceMaxBatchSize,
      safeBatchSize
    );
    incrementMap(this.websocketCoalesceFlushesByEvent, event);

    if (immediate) {
      this.websocketCoalesceImmediateFlushesTotal += 1;
    }

    trackMetric('realtime.websocket.coalesce_flush_batch_size', safeBatchSize);
  }

  public recordWebSocketCoalesceDrop(event: string, reason: string, count: number = 1): void {
    const safeCount = Math.max(count, 1);

    this.websocketCoalesceDroppedEventsTotal += safeCount;
    incrementMap(this.websocketCoalesceDropsByReason, `${event}:${reason}`, safeCount);

    trackEvent('realtime.websocket.coalesce_drop', {
      event,
      reason,
      count: String(safeCount),
    });
  }

  /**
   * Classify current IPC health into a coarse verdict for operator dashboards
   * and a probe endpoint (ARCH-05). Pure read over the existing counters.
   *
   * Verdict order (first match wins):
   * - `unhealthy` — the pending queue is saturated (requests being rejected now),
   *   or, with a meaningful sample, the aggregate success rate has collapsed.
   * - `degraded` — elevated failure rate, high non-definitive/fallback rate, or
   *   pending-queue backpressure building toward the limit.
   * - `healthy` — otherwise (including the idle, zero-traffic case).
   */
  public getIpcHealthSnapshot(): IpcHealthSnapshot {
    const requestsTotal = this.ipcRequestsTotal;
    const successRatePercent =
      requestsTotal === 0 ? 100 : (this.ipcSuccessesTotal / requestsTotal) * 100;
    const notHandledRatePercent =
      requestsTotal === 0 ? 0 : (this.ipcNonDefinitiveResponsesTotal / requestsTotal) * 100;
    const pendingLimit = this.ipcPendingLimitObserved > 0 ? this.ipcPendingLimitObserved : null;
    const pendingSaturationPercent =
      pendingLimit === null ? null : (this.ipcPendingCurrent / pendingLimit) * 100;

    const computed: IpcHealthComputedSignals = {
      hasSample: requestsTotal >= IPC_HEALTH_MIN_SAMPLE,
      successRatePercent,
      notHandledRatePercent,
      pendingCurrent: this.ipcPendingCurrent,
      pendingLimit,
      pendingSaturationPercent,
    };

    const unhealthyReasons = evaluateIpcUnhealthyReasons(computed);
    const degradedReasons = unhealthyReasons.length > 0 ? [] : evaluateIpcDegradedReasons(computed);

    let status: IpcHealthStatus = 'healthy';
    if (unhealthyReasons.length > 0) {
      status = 'unhealthy';
    } else if (degradedReasons.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      reasons: [...unhealthyReasons, ...degradedReasons],
      signals: {
        requestsTotal,
        successRatePercent: Number(successRatePercent.toFixed(2)),
        notHandledRatePercent: Number(notHandledRatePercent.toFixed(2)),
        pendingCurrent: this.ipcPendingCurrent,
        pendingHighWatermark: this.ipcPendingHighWatermark,
        pendingLimit,
        pendingSaturationPercent:
          pendingSaturationPercent === null ? null : Number(pendingSaturationPercent.toFixed(2)),
        timeoutsTotal: this.ipcTimeoutsTotal,
        unavailableTotal: this.ipcUnavailableTotal,
        overloadRejectionsTotal: this.ipcOverloadRejectionsTotal,
        publishFailuresTotal: this.ipcPublishFailuresTotal,
      },
    };
  }

  public getDiagnostics(): {
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
  } {
    const latencyCount = this.ipcLatencySamples.length;
    const averageLatencyMs =
      latencyCount === 0
        ? 0
        : this.ipcLatencySamples.reduce((sum, value) => sum + value, 0) / latencyCount;

    const successRatePercent =
      this.ipcRequestsTotal === 0 ? 0 : (this.ipcSuccessesTotal / this.ipcRequestsTotal) * 100;

    const notHandledRatePercent =
      this.ipcRequestsTotal === 0
        ? 0
        : (this.ipcNonDefinitiveResponsesTotal / this.ipcRequestsTotal) * 100;

    const averageBatchSize =
      this.websocketCoalesceFlushesTotal === 0
        ? 0
        : this.websocketCoalesceItemsFlushedTotal / this.websocketCoalesceFlushesTotal;

    const roomSubscriptionRejectionRatePercent =
      this.websocketRoomSubscriptionAttemptsTotal === 0
        ? 0
        : (this.websocketRoomSubscriptionRejectedTotal /
            this.websocketRoomSubscriptionAttemptsTotal) *
          100;

    const roomSubscriptionScopeBreakdown = toWebSocketRoomScopeBreakdown(
      this.websocketRoomSubscriptionAttemptsByScope,
      this.websocketRoomSubscriptionAcceptedByScope,
      this.websocketRoomSubscriptionRejectedByScope
    );

    return {
      timestamp: new Date().toISOString(),
      uptimeMs: Date.now() - this.startedAtMs,
      ipc: {
        health: this.getIpcHealthSnapshot(),
        requestsTotal: this.ipcRequestsTotal,
        successesTotal: this.ipcSuccessesTotal,
        failuresTotal: this.ipcFailuresTotal,
        timeoutsTotal: this.ipcTimeoutsTotal,
        unavailableTotal: this.ipcUnavailableTotal,
        publishFailuresTotal: this.ipcPublishFailuresTotal,
        overloadRejectionsTotal: this.ipcOverloadRejectionsTotal,
        publishRetryAttemptsTotal: this.ipcPublishRetryAttemptsTotal,
        successRatePercent: Number(successRatePercent.toFixed(2)),
        pendingCurrent: this.ipcPendingCurrent,
        pendingHighWatermark: this.ipcPendingHighWatermark,
        commandsHandledTotal: this.ipcCommandsHandledTotal,
        commandsNoHandlerTotal: this.ipcCommandsNoHandlerTotal,
        nonDefinitiveResponsesTotal: this.ipcNonDefinitiveResponsesTotal,
        notHandledRatePercent: Number(notHandledRatePercent.toFixed(2)),
        fallbackResolutionsTotal: this.ipcFallbackResolutionsTotal,
        fallbackRateByAction: toIpcFallbackRateBreakdown(
          this.ipcRequestCountsByAction,
          this.ipcFallbackResolutionsByAction,
          10
        ),
        responseSourceShards: mapToSortedArray(this.ipcResponsesByShard, 10),
        averageLatencyMs: Number(averageLatencyMs.toFixed(2)),
        p95LatencyMs: Number(toPercentile(this.ipcLatencySamples, 95).toFixed(2)),
        topRequestActions: mapToSortedArray(this.ipcRequestCountsByAction, 10),
        topNoHandlerActions: mapToSortedArray(this.ipcNoHandlerCountsByAction, 10),
        topOverloadedActions: mapToSortedArray(this.ipcOverloadCountsByAction, 10),
        topPublishRetryActions: mapToSortedArray(this.ipcPublishRetryAttemptsByAction, 10),
        recentErrors: [...this.ipcErrors],
      },
      websocket: {
        initializationsTotal: this.websocketInitializationsTotal,
        lifecycle: {
          connectionsTotal: this.websocketConnectionsTotal,
          disconnectionsTotal: this.websocketDisconnectionsTotal,
          authenticationFailuresTotal: this.websocketAuthenticationFailuresTotal,
          socketErrorsTotal: this.websocketSocketErrorsTotal,
          topDisconnectReasons: mapToSortedArray(this.websocketDisconnectReasons, 10),
          topAuthenticationFailureReasons: mapToSortedArray(this.websocketAuthFailureReasons, 10),
        },
        roomSubscriptions: {
          attemptsTotal: this.websocketRoomSubscriptionAttemptsTotal,
          acceptedTotal: this.websocketRoomSubscriptionAcceptedTotal,
          rejectedTotal: this.websocketRoomSubscriptionRejectedTotal,
          rejectionRatePercent: Number(roomSubscriptionRejectionRatePercent.toFixed(2)),
          topRejectionReasons: mapToSortedArray(this.websocketRoomSubscriptionRejectionReasons, 10),
          scopeBreakdown: roomSubscriptionScopeBreakdown,
        },
        adapter: {
          mode: this.websocketAdapterMode,
          reason: this.websocketAdapterReason,
          modeUpdatedAt: this.websocketAdapterModeUpdatedAt,
          attachAttemptsTotal: this.websocketAdapterAttachAttemptsTotal,
          attachSuccessesTotal: this.websocketAdapterAttachSuccessesTotal,
          attachFailuresTotal: this.websocketAdapterAttachFailuresTotal,
          lastAttachLatencyMs: this.websocketAdapterLastAttachLatencyMs,
        },
        coalescing: {
          flushesTotal: this.websocketCoalesceFlushesTotal,
          immediateFlushesTotal: this.websocketCoalesceImmediateFlushesTotal,
          itemsFlushedTotal: this.websocketCoalesceItemsFlushedTotal,
          maxBatchSize: this.websocketCoalesceMaxBatchSize,
          averageBatchSize: Number(averageBatchSize.toFixed(2)),
          droppedEventsTotal: this.websocketCoalesceDroppedEventsTotal,
          topFlushedEvents: mapToSortedArray(this.websocketCoalesceFlushesByEvent, 10),
          topDropReasons: mapToSortedArray(this.websocketCoalesceDropsByReason, 10),
        },
      },
    };
  }

  public resetForTests(): void {
    this.ipcRequestsTotal = 0;
    this.ipcSuccessesTotal = 0;
    this.ipcFailuresTotal = 0;
    this.ipcTimeoutsTotal = 0;
    this.ipcUnavailableTotal = 0;
    this.ipcPublishFailuresTotal = 0;
    this.ipcOverloadRejectionsTotal = 0;
    this.ipcPublishRetryAttemptsTotal = 0;
    this.ipcPendingCurrent = 0;
    this.ipcPendingHighWatermark = 0;
    this.ipcPendingLimitObserved = 0;
    this.ipcCommandsHandledTotal = 0;
    this.ipcCommandsNoHandlerTotal = 0;
    this.ipcNonDefinitiveResponsesTotal = 0;
    this.ipcFallbackResolutionsTotal = 0;

    this.ipcLatencySamples.length = 0;
    this.ipcErrors.length = 0;
    this.ipcRequestCountsByAction.clear();
    this.ipcNoHandlerCountsByAction.clear();
    this.ipcFallbackResolutionsByAction.clear();
    this.ipcOverloadCountsByAction.clear();
    this.ipcPublishRetryAttemptsByAction.clear();
    this.ipcResponsesByShard.clear();

    this.websocketInitializationsTotal = 0;
    this.websocketConnectionsTotal = 0;
    this.websocketDisconnectionsTotal = 0;
    this.websocketAuthenticationFailuresTotal = 0;
    this.websocketSocketErrorsTotal = 0;
    this.websocketAdapterMode = 'unknown';
    this.websocketAdapterReason = 'not_initialized';
    this.websocketAdapterModeUpdatedAt = new Date().toISOString();
    this.websocketAdapterAttachAttemptsTotal = 0;
    this.websocketAdapterAttachSuccessesTotal = 0;
    this.websocketAdapterAttachFailuresTotal = 0;
    this.websocketAdapterLastAttachLatencyMs = null;

    this.websocketCoalesceFlushesTotal = 0;
    this.websocketCoalesceImmediateFlushesTotal = 0;
    this.websocketCoalesceItemsFlushedTotal = 0;
    this.websocketCoalesceMaxBatchSize = 0;
    this.websocketCoalesceDroppedEventsTotal = 0;
    this.websocketCoalesceFlushesByEvent.clear();
    this.websocketCoalesceDropsByReason.clear();
    this.websocketDisconnectReasons.clear();
    this.websocketAuthFailureReasons.clear();
    this.websocketRoomSubscriptionAttemptsTotal = 0;
    this.websocketRoomSubscriptionAcceptedTotal = 0;
    this.websocketRoomSubscriptionRejectedTotal = 0;
    this.websocketRoomSubscriptionRejectionReasons.clear();
    this.websocketRoomSubscriptionAttemptsByScope.clear();
    this.websocketRoomSubscriptionAcceptedByScope.clear();
    this.websocketRoomSubscriptionRejectedByScope.clear();
  }

  private setWebSocketAdapterMode(mode: AdapterMode, reason: string): void {
    const hasChanged = this.websocketAdapterMode !== mode || this.websocketAdapterReason !== reason;

    this.websocketAdapterMode = mode;
    this.websocketAdapterReason = reason;
    this.websocketAdapterModeUpdatedAt = new Date().toISOString();

    if (hasChanged) {
      logger.info('Realtime diagnostics: WebSocket adapter mode changed', {
        mode,
        reason,
      });

      trackEvent('realtime.websocket.adapter_mode_changed', {
        mode,
        reason,
      });
    }
  }

  private pushIpcError(action: string, error: string): void {
    const sanitizedError = sanitizeDiagnosticsErrorMessage(error);

    this.ipcErrors.push({
      timestamp: new Date().toISOString(),
      action,
      error: sanitizedError,
    });

    if (this.ipcErrors.length > IPC_ERROR_SAMPLE_LIMIT) {
      this.ipcErrors.shift();
    }
  }
}

export const realtimeResilienceDiagnosticsService = new RealtimeResilienceDiagnosticsService();

