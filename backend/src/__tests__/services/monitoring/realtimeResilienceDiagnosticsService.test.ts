jest.mock('../../../config/applicationInsights', () => ({
  trackEvent: jest.fn(),
  trackMetric: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { realtimeResilienceDiagnosticsService } from '../../../services/monitoring/RealtimeResilienceDiagnosticsService';

describe('RealtimeResilienceDiagnosticsService', () => {
  beforeEach(() => {
    realtimeResilienceDiagnosticsService.resetForTests();
  });

  it('tracks IPC request, response, and failure counters', () => {
    realtimeResilienceDiagnosticsService.recordIpcRequest('guild:member_lookup', 0);
    realtimeResilienceDiagnosticsService.recordIpcResponse('guild:member_lookup', true, 14);

    realtimeResilienceDiagnosticsService.recordIpcRequest('guild:member_lookup', 1);
    realtimeResilienceDiagnosticsService.recordIpcResponse(
      'guild:member_lookup',
      false,
      45,
      'handler_failed'
    );

    realtimeResilienceDiagnosticsService.recordIpcTimeout('guild:member_lookup', 10000);
    realtimeResilienceDiagnosticsService.recordIpcPublishFailure(
      'guild:member_lookup',
      'socket_closed'
    );
    realtimeResilienceDiagnosticsService.recordIpcOverloadRejection(
      'guild:member_lookup',
      256,
      128
    );
    realtimeResilienceDiagnosticsService.recordIpcPublishRetryAttempt('guild:member_lookup');
    realtimeResilienceDiagnosticsService.recordIpcPublishRetryAttempt('guild:member_lookup');
    realtimeResilienceDiagnosticsService.recordIpcPublishRetryAttempt('guild:other_action');
    realtimeResilienceDiagnosticsService.recordIpcUnavailable('guild:member_lookup');
    realtimeResilienceDiagnosticsService.recordIpcCommandHandled();
    realtimeResilienceDiagnosticsService.recordIpcCommandNoHandler('guild:not_handled');
    realtimeResilienceDiagnosticsService.recordIpcNonDefinitiveResponse('guild:member_lookup');
    realtimeResilienceDiagnosticsService.recordIpcFallbackResolution('guild:member_lookup');
    realtimeResilienceDiagnosticsService.recordIpcResponseSourceShard(2);
    realtimeResilienceDiagnosticsService.recordIpcResponseSourceShard(2);
    realtimeResilienceDiagnosticsService.recordIpcResponseSourceShard(1);

    const diagnostics = realtimeResilienceDiagnosticsService.getDiagnostics();

    expect(diagnostics.ipc.requestsTotal).toBe(2);
    expect(diagnostics.ipc.successesTotal).toBe(1);
    expect(diagnostics.ipc.failuresTotal).toBe(4);
    expect(diagnostics.ipc.timeoutsTotal).toBe(1);
    expect(diagnostics.ipc.unavailableTotal).toBe(1);
    expect(diagnostics.ipc.publishFailuresTotal).toBe(1);
    expect(diagnostics.ipc.overloadRejectionsTotal).toBe(1);
    expect(diagnostics.ipc.publishRetryAttemptsTotal).toBe(3);
    expect(diagnostics.ipc.commandsHandledTotal).toBe(1);
    expect(diagnostics.ipc.commandsNoHandlerTotal).toBe(1);
    expect(diagnostics.ipc.nonDefinitiveResponsesTotal).toBe(1);
    expect(diagnostics.ipc.notHandledRatePercent).toBe(50);
    expect(diagnostics.ipc.fallbackResolutionsTotal).toBe(1);
    expect(diagnostics.ipc.responseSourceShards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'shard:2', count: 2 }),
        expect.objectContaining({ action: 'shard:1', count: 1 }),
      ])
    );
    expect(diagnostics.ipc.fallbackRateByAction[0]).toMatchObject({
      action: 'guild:member_lookup',
      requests: 2,
      fallbackResolutions: 1,
      fallbackRatePercent: 50,
    });
    expect(diagnostics.ipc.recentErrors.length).toBeGreaterThan(0);
    expect(diagnostics.ipc.topRequestActions[0]).toMatchObject({
      action: 'guild:member_lookup',
      count: 2,
    });
    expect(diagnostics.ipc.topOverloadedActions[0]).toMatchObject({
      action: 'guild:member_lookup',
      count: 1,
    });
    expect(diagnostics.ipc.topPublishRetryActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'guild:member_lookup', count: 2 }),
        expect.objectContaining({ action: 'guild:other_action', count: 1 }),
      ])
    );
  });

  it('tracks WebSocket lifecycle, adapter, and coalescing diagnostics', () => {
    realtimeResilienceDiagnosticsService.recordWebSocketInitialized();
    realtimeResilienceDiagnosticsService.recordWebSocketConnection();
    realtimeResilienceDiagnosticsService.recordWebSocketConnection();
    realtimeResilienceDiagnosticsService.recordWebSocketDisconnection('transport close');
    realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure(
      'missing_or_invalid_token'
    );
    realtimeResilienceDiagnosticsService.recordWebSocketSocketError();
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt('org');
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAccepted('org');
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt('fleet');
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionRejected(
      'invalid_room_format',
      'fleet'
    );
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt('activity');
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAccepted('activity');
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt('trading');
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionRejected(
      'organization_room_mismatch',
      'trading'
    );
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt('tunnel');
    realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAccepted('tunnel');
    realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachAttempt();
    realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttached(
      'redis',
      'adapter_attached',
      12
    );

    realtimeResilienceDiagnosticsService.recordWebSocketCoalesceFlush('fleet:updated', 3, false);
    realtimeResilienceDiagnosticsService.recordWebSocketCoalesceFlush('fleet:updated', 5, true);
    realtimeResilienceDiagnosticsService.recordWebSocketCoalesceDrop(
      'fleet:updated',
      'socket_not_initialized',
      2
    );

    const diagnostics = realtimeResilienceDiagnosticsService.getDiagnostics();

    expect(diagnostics.websocket.initializationsTotal).toBe(1);
    expect(diagnostics.websocket.lifecycle.connectionsTotal).toBe(2);
    expect(diagnostics.websocket.lifecycle.disconnectionsTotal).toBe(1);
    expect(diagnostics.websocket.lifecycle.authenticationFailuresTotal).toBe(1);
    expect(diagnostics.websocket.lifecycle.socketErrorsTotal).toBe(1);
    expect(diagnostics.websocket.lifecycle.topDisconnectReasons[0]).toMatchObject({
      action: 'transport close',
      count: 1,
    });
    expect(diagnostics.websocket.lifecycle.topAuthenticationFailureReasons[0]).toMatchObject({
      action: 'missing_or_invalid_token',
      count: 1,
    });
    expect(diagnostics.websocket.roomSubscriptions.attemptsTotal).toBe(5);
    expect(diagnostics.websocket.roomSubscriptions.acceptedTotal).toBe(3);
    expect(diagnostics.websocket.roomSubscriptions.rejectedTotal).toBe(2);
    expect(diagnostics.websocket.roomSubscriptions.rejectionRatePercent).toBe(40);
    expect(diagnostics.websocket.roomSubscriptions.topRejectionReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'invalid_room_format', count: 1 }),
        expect.objectContaining({ action: 'organization_room_mismatch', count: 1 }),
      ])
    );
    expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.org).toMatchObject({
      attemptsTotal: 1,
      acceptedTotal: 1,
      rejectedTotal: 0,
      acceptanceRatePercent: 100,
      rejectionRatePercent: 0,
    });
    expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.fleet).toMatchObject({
      attemptsTotal: 1,
      acceptedTotal: 0,
      rejectedTotal: 1,
      acceptanceRatePercent: 0,
      rejectionRatePercent: 100,
    });
    expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.activity).toMatchObject({
      attemptsTotal: 1,
      acceptedTotal: 1,
      rejectedTotal: 0,
    });
    expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.trading).toMatchObject({
      attemptsTotal: 1,
      acceptedTotal: 0,
      rejectedTotal: 1,
    });
    expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.tunnel).toMatchObject({
      attemptsTotal: 1,
      acceptedTotal: 1,
      rejectedTotal: 0,
    });
    expect(diagnostics.websocket.adapter.mode).toBe('redis');
    expect(diagnostics.websocket.adapter.attachAttemptsTotal).toBe(1);
    expect(diagnostics.websocket.adapter.attachSuccessesTotal).toBe(1);
    expect(diagnostics.websocket.adapter.attachFailuresTotal).toBe(0);
    expect(diagnostics.websocket.coalescing.flushesTotal).toBe(2);
    expect(diagnostics.websocket.coalescing.immediateFlushesTotal).toBe(1);
    expect(diagnostics.websocket.coalescing.itemsFlushedTotal).toBe(8);
    expect(diagnostics.websocket.coalescing.maxBatchSize).toBe(5);
    expect(diagnostics.websocket.coalescing.droppedEventsTotal).toBe(2);
    expect(diagnostics.websocket.coalescing.topFlushedEvents[0]).toMatchObject({
      action: 'fleet:updated',
      count: 2,
    });
  });

  describe('getIpcHealthSnapshot (ARCH-05)', () => {
    const svc = realtimeResilienceDiagnosticsService;

    /** Drive N successful requests + M failed requests through the counters. */
    function driveRequests(successes: number, failures: number): void {
      for (let i = 0; i < successes; i++) {
        svc.recordIpcRequest('guild:member_lookup', 0);
        svc.recordIpcResponse('guild:member_lookup', true, 10);
      }
      for (let i = 0; i < failures; i++) {
        svc.recordIpcRequest('guild:member_lookup', 0);
        svc.recordIpcResponse('guild:member_lookup', false, 10, 'handler_failed');
      }
    }

    it('reports healthy when idle (no traffic)', () => {
      const health = svc.getIpcHealthSnapshot();
      expect(health.status).toBe('healthy');
      expect(health.reasons).toEqual([]);
      expect(health.signals.requestsTotal).toBe(0);
      expect(health.signals.successRatePercent).toBe(100);
      expect(health.signals.pendingLimit).toBeNull();
      expect(health.signals.pendingSaturationPercent).toBeNull();
    });

    it('stays healthy on a small failing sample (below the sample floor)', () => {
      // 5 failures only — under IPC_HEALTH_MIN_SAMPLE (20), so no failure verdict.
      driveRequests(0, 5);
      expect(svc.getIpcHealthSnapshot().status).toBe('healthy');
    });

    it('reports degraded when the aggregate success rate is below 90%', () => {
      driveRequests(17, 3); // 20 reqs, 85% success
      const health = svc.getIpcHealthSnapshot();
      expect(health.status).toBe('degraded');
      expect(health.reasons).toContain('elevated_failure_rate');
      expect(health.signals.successRatePercent).toBe(85);
    });

    it('reports unhealthy when the aggregate success rate collapses below 50%', () => {
      driveRequests(8, 12); // 20 reqs, 40% success
      const health = svc.getIpcHealthSnapshot();
      expect(health.status).toBe('unhealthy');
      expect(health.reasons).toContain('low_success_rate');
    });

    it('reports degraded on an elevated non-definitive/fallback rate', () => {
      driveRequests(20, 0); // all succeed → not a failure-rate problem
      for (let i = 0; i < 6; i++) {
        svc.recordIpcNonDefinitiveResponse('guild:member_lookup'); // 6/20 = 30% > 25%
      }
      const health = svc.getIpcHealthSnapshot();
      expect(health.status).toBe('degraded');
      expect(health.reasons).toContain('elevated_not_handled_rate');
    });

    it('reports degraded when pending depth nears the observed limit', () => {
      // Capture the limit via an overload rejection, then set live pending to 60% of it.
      svc.recordIpcOverloadRejection('guild:member_lookup', 100, 100);
      svc.updateIpcPendingDepth(60);
      const health = svc.getIpcHealthSnapshot();
      expect(health.status).toBe('degraded');
      expect(health.reasons).toContain('high_pending_depth');
      expect(health.signals.pendingLimit).toBe(100);
      expect(health.signals.pendingSaturationPercent).toBe(60);
    });

    it('reports unhealthy when the pending queue is saturated at the limit', () => {
      svc.recordIpcOverloadRejection('guild:member_lookup', 100, 100);
      svc.updateIpcPendingDepth(100);
      const health = svc.getIpcHealthSnapshot();
      expect(health.status).toBe('unhealthy');
      expect(health.reasons).toContain('pending_queue_saturated');
    });

    it('surfaces the health verdict inside getDiagnostics().ipc.health', () => {
      driveRequests(20, 0);
      const diagnostics = svc.getDiagnostics();
      expect(diagnostics.ipc.health.status).toBe('healthy');
      expect(diagnostics.ipc.health.signals.requestsTotal).toBe(20);
    });
  });
});
