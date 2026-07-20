"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeResilienceDiagnosticsService = exports.RealtimeResilienceDiagnosticsService = void 0;
const applicationInsights_1 = require("../../config/applicationInsights");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const IPC_LATENCY_SAMPLE_LIMIT = 512;
const IPC_ERROR_SAMPLE_LIMIT = 32;
const IPC_HEALTH_MIN_SAMPLE = 20;
const IPC_HEALTH_UNHEALTHY_SUCCESS_RATE = 50;
const IPC_HEALTH_DEGRADED_SUCCESS_RATE = 90;
const IPC_HEALTH_DEGRADED_NOT_HANDLED_RATE = 25;
const IPC_HEALTH_DEGRADED_PENDING_SATURATION = 50;
function evaluateIpcUnhealthyReasons(s) {
    const reasons = [];
    if (s.pendingLimit !== null && s.pendingCurrent >= s.pendingLimit) {
        reasons.push('pending_queue_saturated');
    }
    if (s.hasSample && s.successRatePercent < IPC_HEALTH_UNHEALTHY_SUCCESS_RATE) {
        reasons.push('low_success_rate');
    }
    return reasons;
}
function evaluateIpcDegradedReasons(s) {
    const reasons = [];
    if (s.hasSample && s.successRatePercent < IPC_HEALTH_DEGRADED_SUCCESS_RATE) {
        reasons.push('elevated_failure_rate');
    }
    if (s.hasSample && s.notHandledRatePercent > IPC_HEALTH_DEGRADED_NOT_HANDLED_RATE) {
        reasons.push('elevated_not_handled_rate');
    }
    if (s.pendingSaturationPercent !== null &&
        s.pendingSaturationPercent >= IPC_HEALTH_DEGRADED_PENDING_SATURATION) {
        reasons.push('high_pending_depth');
    }
    return reasons;
}
const WEBSOCKET_ROOM_SCOPES = [
    'org',
    'fleet',
    'activity',
    'trading',
    'tunnel',
];
function truncateErrorMessage(message) {
    const trimmed = message.trim();
    return trimmed.length <= 180 ? trimmed : `${trimmed.slice(0, 177)}...`;
}
function sanitizeDiagnosticsErrorMessage(errorMessage) {
    const sanitized = (0, redis_1.sanitizeRedisErrorForLogging)({ message: errorMessage });
    const sanitizedMessage = sanitized.message;
    if (typeof sanitizedMessage === 'string') {
        return truncateErrorMessage(sanitizedMessage);
    }
    return truncateErrorMessage(errorMessage);
}
function toPercentile(samples, percentile) {
    if (samples.length === 0) {
        return 0;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
    const safeIndex = Math.min(Math.max(rank, 0), sorted.length - 1);
    return sorted[safeIndex];
}
function incrementMap(map, key, value = 1) {
    map.set(key, (map.get(key) ?? 0) + value);
}
function mapToSortedArray(map, limit) {
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([action, count]) => ({ action, count }));
}
function toIpcFallbackRateBreakdown(requestCountsByAction, fallbackResolutionsByAction, limit) {
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
function toWebSocketRoomScopeBreakdown(attemptsByScope, acceptedByScope, rejectedByScope) {
    return WEBSOCKET_ROOM_SCOPES.reduce((breakdown, scope) => {
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
    }, {});
}
class RealtimeResilienceDiagnosticsService {
    startedAtMs = Date.now();
    ipcRequestsTotal = 0;
    ipcSuccessesTotal = 0;
    ipcFailuresTotal = 0;
    ipcTimeoutsTotal = 0;
    ipcUnavailableTotal = 0;
    ipcPublishFailuresTotal = 0;
    ipcOverloadRejectionsTotal = 0;
    ipcPublishRetryAttemptsTotal = 0;
    ipcPendingCurrent = 0;
    ipcPendingHighWatermark = 0;
    ipcPendingLimitObserved = 0;
    ipcCommandsHandledTotal = 0;
    ipcCommandsNoHandlerTotal = 0;
    ipcNonDefinitiveResponsesTotal = 0;
    ipcFallbackResolutionsTotal = 0;
    ipcLatencySamples = [];
    ipcErrors = [];
    ipcRequestCountsByAction = new Map();
    ipcNoHandlerCountsByAction = new Map();
    ipcFallbackResolutionsByAction = new Map();
    ipcOverloadCountsByAction = new Map();
    ipcPublishRetryAttemptsByAction = new Map();
    ipcResponsesByShard = new Map();
    websocketInitializationsTotal = 0;
    websocketConnectionsTotal = 0;
    websocketDisconnectionsTotal = 0;
    websocketAuthenticationFailuresTotal = 0;
    websocketSocketErrorsTotal = 0;
    websocketAdapterMode = 'unknown';
    websocketAdapterReason = 'not_initialized';
    websocketAdapterModeUpdatedAt = new Date().toISOString();
    websocketAdapterAttachAttemptsTotal = 0;
    websocketAdapterAttachSuccessesTotal = 0;
    websocketAdapterAttachFailuresTotal = 0;
    websocketAdapterLastAttachLatencyMs = null;
    websocketCoalesceFlushesTotal = 0;
    websocketCoalesceImmediateFlushesTotal = 0;
    websocketCoalesceItemsFlushedTotal = 0;
    websocketCoalesceMaxBatchSize = 0;
    websocketCoalesceDroppedEventsTotal = 0;
    websocketCoalesceFlushesByEvent = new Map();
    websocketCoalesceDropsByReason = new Map();
    websocketDisconnectReasons = new Map();
    websocketAuthFailureReasons = new Map();
    websocketRoomSubscriptionAttemptsTotal = 0;
    websocketRoomSubscriptionAcceptedTotal = 0;
    websocketRoomSubscriptionRejectedTotal = 0;
    websocketRoomSubscriptionRejectionReasons = new Map();
    websocketRoomSubscriptionAttemptsByScope = new Map();
    websocketRoomSubscriptionAcceptedByScope = new Map();
    websocketRoomSubscriptionRejectedByScope = new Map();
    recordIpcRequest(action, pendingDepth) {
        this.ipcRequestsTotal += 1;
        this.updateIpcPendingDepth(pendingDepth);
        incrementMap(this.ipcRequestCountsByAction, action);
    }
    updateIpcPendingDepth(depth) {
        this.ipcPendingCurrent = Math.max(depth, 0);
        this.ipcPendingHighWatermark = Math.max(this.ipcPendingHighWatermark, this.ipcPendingCurrent);
        (0, applicationInsights_1.trackMetric)('realtime.ipc.pending_depth', this.ipcPendingCurrent);
    }
    recordIpcResponse(action, success, latencyMs, errorMessage) {
        if (success) {
            this.ipcSuccessesTotal += 1;
        }
        else {
            this.ipcFailuresTotal += 1;
            this.pushIpcError(action, errorMessage ?? 'unknown_response_failure');
        }
        this.ipcLatencySamples.push(Math.max(latencyMs, 0));
        if (this.ipcLatencySamples.length > IPC_LATENCY_SAMPLE_LIMIT) {
            this.ipcLatencySamples.shift();
        }
        (0, applicationInsights_1.trackMetric)('realtime.ipc.response_latency_ms', Math.max(latencyMs, 0));
    }
    recordIpcTimeout(action, timeoutMs) {
        this.ipcTimeoutsTotal += 1;
        this.ipcFailuresTotal += 1;
        this.pushIpcError(action, `timeout_${timeoutMs}ms`);
        (0, applicationInsights_1.trackMetric)('realtime.ipc.timeouts_total', this.ipcTimeoutsTotal);
        (0, applicationInsights_1.trackEvent)('realtime.ipc.timeout', {
            action,
            timeoutMs: String(timeoutMs),
        });
    }
    recordIpcUnavailable(action) {
        this.ipcUnavailableTotal += 1;
        this.pushIpcError(action, 'ipc_unavailable');
        (0, applicationInsights_1.trackMetric)('realtime.ipc.unavailable_total', this.ipcUnavailableTotal);
    }
    recordIpcPublishFailure(action, errorMessage) {
        this.ipcPublishFailuresTotal += 1;
        this.ipcFailuresTotal += 1;
        this.pushIpcError(action, `publish_failure:${errorMessage}`);
        (0, applicationInsights_1.trackEvent)('realtime.ipc.publish_failure', {
            action,
            error: truncateErrorMessage(errorMessage),
        });
    }
    recordIpcOverloadRejection(action, pendingDepth, limit) {
        this.ipcOverloadRejectionsTotal += 1;
        this.ipcFailuresTotal += 1;
        incrementMap(this.ipcOverloadCountsByAction, action);
        if (limit > 0) {
            this.ipcPendingLimitObserved = Math.max(this.ipcPendingLimitObserved, limit);
        }
        this.pushIpcError(action, `overload_rejected:${pendingDepth}/${limit}`);
        (0, applicationInsights_1.trackEvent)('realtime.ipc.overload_rejection', {
            action,
            pendingDepth: String(Math.max(pendingDepth, 0)),
            limit: String(Math.max(limit, 0)),
            rejectionsTotal: String(this.ipcOverloadRejectionsTotal),
        });
    }
    recordIpcPublishRetryAttempt(action) {
        this.ipcPublishRetryAttemptsTotal += 1;
        incrementMap(this.ipcPublishRetryAttemptsByAction, action);
        (0, applicationInsights_1.trackMetric)('realtime.ipc.publish_retries_total', this.ipcPublishRetryAttemptsTotal);
    }
    recordIpcCommandHandled() {
        this.ipcCommandsHandledTotal += 1;
    }
    recordIpcCommandNoHandler(action) {
        this.ipcCommandsNoHandlerTotal += 1;
        incrementMap(this.ipcNoHandlerCountsByAction, action);
    }
    recordIpcNonDefinitiveResponse(action) {
        this.ipcNonDefinitiveResponsesTotal += 1;
        incrementMap(this.ipcNoHandlerCountsByAction, action);
    }
    recordIpcFallbackResolution(action) {
        this.ipcFallbackResolutionsTotal += 1;
        incrementMap(this.ipcFallbackResolutionsByAction, action);
        (0, applicationInsights_1.trackEvent)('realtime.ipc.fallback_resolution', {
            action,
            resolutionsTotal: String(this.ipcFallbackResolutionsTotal),
        });
    }
    recordIpcResponseSourceShard(shardId) {
        const normalizedShardId = Number.isInteger(shardId) ? shardId : Math.trunc(shardId);
        incrementMap(this.ipcResponsesByShard, `shard:${normalizedShardId}`);
    }
    recordWebSocketInitialized() {
        this.websocketInitializationsTotal += 1;
    }
    recordWebSocketConnection() {
        this.websocketConnectionsTotal += 1;
    }
    recordWebSocketDisconnection(reason) {
        this.websocketDisconnectionsTotal += 1;
        incrementMap(this.websocketDisconnectReasons, reason);
    }
    recordWebSocketAuthenticationFailure(reason) {
        this.websocketAuthenticationFailuresTotal += 1;
        incrementMap(this.websocketAuthFailureReasons, reason);
        (0, applicationInsights_1.trackEvent)('realtime.websocket.authentication_failure', {
            reason,
            failuresTotal: String(this.websocketAuthenticationFailuresTotal),
        });
    }
    recordWebSocketSocketError() {
        this.websocketSocketErrorsTotal += 1;
    }
    recordWebSocketRoomSubscriptionAttempt(scope) {
        this.websocketRoomSubscriptionAttemptsTotal += 1;
        if (scope) {
            incrementMap(this.websocketRoomSubscriptionAttemptsByScope, scope);
        }
    }
    recordWebSocketRoomSubscriptionAccepted(scope) {
        this.websocketRoomSubscriptionAcceptedTotal += 1;
        incrementMap(this.websocketRoomSubscriptionAcceptedByScope, scope);
    }
    recordWebSocketRoomSubscriptionRejected(reason, scope) {
        this.websocketRoomSubscriptionRejectedTotal += 1;
        incrementMap(this.websocketRoomSubscriptionRejectionReasons, reason);
        if (scope) {
            incrementMap(this.websocketRoomSubscriptionRejectedByScope, scope);
        }
        (0, applicationInsights_1.trackEvent)('realtime.websocket.room_subscription_rejected', {
            reason,
            rejectionsTotal: String(this.websocketRoomSubscriptionRejectedTotal),
        });
    }
    recordWebSocketAdapterAttachAttempt() {
        this.websocketAdapterAttachAttemptsTotal += 1;
    }
    recordWebSocketAdapterAttached(mode, reason, latencyMs) {
        this.websocketAdapterAttachSuccessesTotal += 1;
        this.websocketAdapterLastAttachLatencyMs =
            typeof latencyMs === 'number'
                ? Math.max(latencyMs, 0)
                : this.websocketAdapterLastAttachLatencyMs;
        this.setWebSocketAdapterMode(mode, reason);
        if (typeof latencyMs === 'number') {
            (0, applicationInsights_1.trackMetric)('realtime.websocket.adapter_attach_latency_ms', Math.max(latencyMs, 0));
        }
    }
    recordWebSocketAdapterAttachFailure(reason) {
        this.websocketAdapterAttachFailuresTotal += 1;
        this.setWebSocketAdapterMode('in-memory', reason);
        (0, applicationInsights_1.trackEvent)('realtime.websocket.adapter_attach_failure', {
            reason,
            failuresTotal: String(this.websocketAdapterAttachFailuresTotal),
        });
    }
    recordWebSocketCoalesceFlush(event, batchSize, immediate) {
        const safeBatchSize = Math.max(batchSize, 0);
        this.websocketCoalesceFlushesTotal += 1;
        this.websocketCoalesceItemsFlushedTotal += safeBatchSize;
        this.websocketCoalesceMaxBatchSize = Math.max(this.websocketCoalesceMaxBatchSize, safeBatchSize);
        incrementMap(this.websocketCoalesceFlushesByEvent, event);
        if (immediate) {
            this.websocketCoalesceImmediateFlushesTotal += 1;
        }
        (0, applicationInsights_1.trackMetric)('realtime.websocket.coalesce_flush_batch_size', safeBatchSize);
    }
    recordWebSocketCoalesceDrop(event, reason, count = 1) {
        const safeCount = Math.max(count, 1);
        this.websocketCoalesceDroppedEventsTotal += safeCount;
        incrementMap(this.websocketCoalesceDropsByReason, `${event}:${reason}`, safeCount);
        (0, applicationInsights_1.trackEvent)('realtime.websocket.coalesce_drop', {
            event,
            reason,
            count: String(safeCount),
        });
    }
    getIpcHealthSnapshot() {
        const requestsTotal = this.ipcRequestsTotal;
        const successRatePercent = requestsTotal === 0 ? 100 : (this.ipcSuccessesTotal / requestsTotal) * 100;
        const notHandledRatePercent = requestsTotal === 0 ? 0 : (this.ipcNonDefinitiveResponsesTotal / requestsTotal) * 100;
        const pendingLimit = this.ipcPendingLimitObserved > 0 ? this.ipcPendingLimitObserved : null;
        const pendingSaturationPercent = pendingLimit === null ? null : (this.ipcPendingCurrent / pendingLimit) * 100;
        const computed = {
            hasSample: requestsTotal >= IPC_HEALTH_MIN_SAMPLE,
            successRatePercent,
            notHandledRatePercent,
            pendingCurrent: this.ipcPendingCurrent,
            pendingLimit,
            pendingSaturationPercent,
        };
        const unhealthyReasons = evaluateIpcUnhealthyReasons(computed);
        const degradedReasons = unhealthyReasons.length > 0 ? [] : evaluateIpcDegradedReasons(computed);
        let status = 'healthy';
        if (unhealthyReasons.length > 0) {
            status = 'unhealthy';
        }
        else if (degradedReasons.length > 0) {
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
                pendingSaturationPercent: pendingSaturationPercent === null ? null : Number(pendingSaturationPercent.toFixed(2)),
                timeoutsTotal: this.ipcTimeoutsTotal,
                unavailableTotal: this.ipcUnavailableTotal,
                overloadRejectionsTotal: this.ipcOverloadRejectionsTotal,
                publishFailuresTotal: this.ipcPublishFailuresTotal,
            },
        };
    }
    getDiagnostics() {
        const latencyCount = this.ipcLatencySamples.length;
        const averageLatencyMs = latencyCount === 0
            ? 0
            : this.ipcLatencySamples.reduce((sum, value) => sum + value, 0) / latencyCount;
        const successRatePercent = this.ipcRequestsTotal === 0 ? 0 : (this.ipcSuccessesTotal / this.ipcRequestsTotal) * 100;
        const notHandledRatePercent = this.ipcRequestsTotal === 0
            ? 0
            : (this.ipcNonDefinitiveResponsesTotal / this.ipcRequestsTotal) * 100;
        const averageBatchSize = this.websocketCoalesceFlushesTotal === 0
            ? 0
            : this.websocketCoalesceItemsFlushedTotal / this.websocketCoalesceFlushesTotal;
        const roomSubscriptionRejectionRatePercent = this.websocketRoomSubscriptionAttemptsTotal === 0
            ? 0
            : (this.websocketRoomSubscriptionRejectedTotal /
                this.websocketRoomSubscriptionAttemptsTotal) *
                100;
        const roomSubscriptionScopeBreakdown = toWebSocketRoomScopeBreakdown(this.websocketRoomSubscriptionAttemptsByScope, this.websocketRoomSubscriptionAcceptedByScope, this.websocketRoomSubscriptionRejectedByScope);
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
                fallbackRateByAction: toIpcFallbackRateBreakdown(this.ipcRequestCountsByAction, this.ipcFallbackResolutionsByAction, 10),
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
    resetForTests() {
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
    setWebSocketAdapterMode(mode, reason) {
        const hasChanged = this.websocketAdapterMode !== mode || this.websocketAdapterReason !== reason;
        this.websocketAdapterMode = mode;
        this.websocketAdapterReason = reason;
        this.websocketAdapterModeUpdatedAt = new Date().toISOString();
        if (hasChanged) {
            logger_1.logger.info('Realtime diagnostics: WebSocket adapter mode changed', {
                mode,
                reason,
            });
            (0, applicationInsights_1.trackEvent)('realtime.websocket.adapter_mode_changed', {
                mode,
                reason,
            });
        }
    }
    pushIpcError(action, error) {
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
exports.RealtimeResilienceDiagnosticsService = RealtimeResilienceDiagnosticsService;
exports.realtimeResilienceDiagnosticsService = new RealtimeResilienceDiagnosticsService();
//# sourceMappingURL=RealtimeResilienceDiagnosticsService.js.map