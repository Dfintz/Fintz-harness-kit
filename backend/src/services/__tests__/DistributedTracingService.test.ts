import {
  DistributedTracingService,
  SpanStatus,
  SpanKind,
} from '../monitoring/DistributedTracingService';

// Mock logger
describe('DistributedTracingService', () => {
  let tracingService: DistributedTracingService;

  beforeEach(() => {
    // Get fresh instance for each test
    tracingService = DistributedTracingService.getInstance();
    tracingService.clearSpans();
  });

  afterEach(() => {
    tracingService.clearSpans();
  });

  describe('Trace ID Generation', () => {
    it('should generate a valid trace ID with 32 characters', () => {
      const traceId = tracingService.generateTraceId();
      expect(traceId).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(traceId)).toBe(true);
    });

    it('should generate unique trace IDs', () => {
      const traceIds = new Set<string>();
      for (let i = 0; i < 100; i++) {
        traceIds.add(tracingService.generateTraceId());
      }
      expect(traceIds.size).toBe(100);
    });
  });

  describe('Span ID Generation', () => {
    it('should generate a valid span ID with 16 characters', () => {
      const spanId = tracingService.generateSpanId();
      expect(spanId).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(spanId)).toBe(true);
    });

    it('should generate unique span IDs', () => {
      const spanIds = new Set<string>();
      for (let i = 0; i < 100; i++) {
        spanIds.add(tracingService.generateSpanId());
      }
      expect(spanIds.size).toBe(100);
    });
  });

  describe('Trace Context', () => {
    it('should create a new trace context without parent', () => {
      const context = tracingService.createTraceContext();

      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
      expect(context.parentSpanId).toBeUndefined();
      expect(typeof context.sampled).toBe('boolean');
    });

    it('should create a child context from parent', () => {
      const parentContext = tracingService.createTraceContext();
      const childContext = tracingService.createTraceContext(parentContext);

      expect(childContext.traceId).toBe(parentContext.traceId);
      expect(childContext.spanId).not.toBe(parentContext.spanId);
      expect(childContext.parentSpanId).toBe(parentContext.spanId);
    });

    it('should inherit sampling decision from parent', () => {
      const parentContext = tracingService.createTraceContext();
      parentContext.sampled = true;

      const childContext = tracingService.createTraceContext(parentContext);
      expect(childContext.sampled).toBe(true);
    });

    it('should propagate baggage from parent', () => {
      const parentContext = tracingService.createTraceContext();
      parentContext.baggage = { 'user-id': '123', 'org-id': '456' };

      const childContext = tracingService.createTraceContext(parentContext);
      expect(childContext.baggage).toEqual({ 'user-id': '123', 'org-id': '456' });
    });
  });

  describe('Span Operations', () => {
    it('should create and end a span', () => {
      const span = tracingService.startSpan('test-operation');

      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.operationName).toBe('test-operation');

      const completedSpan = span.end();

      expect(completedSpan.traceId).toBe(span.traceId);
      expect(completedSpan.spanId).toBe(span.spanId);
      expect(completedSpan.status).toBe(SpanStatus.OK);
      expect(completedSpan.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should set span attributes', () => {
      const span = tracingService.startSpan('test-operation');

      span.setAttribute('http.method', 'GET');
      span.setAttribute('http.status_code', 200);
      span.setAttribute('http.success', true);

      const completedSpan = span.end();

      expect(completedSpan.attributes['http.method']).toBe('GET');
      expect(completedSpan.attributes['http.status_code']).toBe(200);
      expect(completedSpan.attributes['http.success']).toBe(true);
    });

    it('should set span status', () => {
      const span = tracingService.startSpan('test-operation');

      span.setStatus(SpanStatus.ERROR, 'Something went wrong');

      const completedSpan = span.end();

      expect(completedSpan.status).toBe(SpanStatus.ERROR);
      expect(completedSpan.errorMessage).toBe('Something went wrong');
    });

    it('should add span events', () => {
      const span = tracingService.startSpan('test-operation');

      span.addEvent('event-1', { key: 'value' });
      span.addEvent('event-2');

      const completedSpan = span.end();

      expect(completedSpan.events).toHaveLength(2);
      expect(completedSpan.events[0].name).toBe('event-1');
      expect(completedSpan.events[0].attributes).toEqual({ key: 'value' });
      expect(completedSpan.events[1].name).toBe('event-2');
    });

    it('should create span with specified kind', () => {
      const span = tracingService.startSpan('http-request', {
        kind: SpanKind.SERVER,
      });

      const completedSpan = span.end();

      expect(completedSpan.kind).toBe(SpanKind.SERVER);
    });

    it('should create child span with parent context', () => {
      const parentSpan = tracingService.startSpan('parent-operation');
      const parentContext = {
        traceId: parentSpan.traceId,
        spanId: parentSpan.spanId,
        sampled: true,
      };

      const childSpan = tracingService.startSpan('child-operation', {
        parentContext,
      });

      expect(childSpan.traceId).toBe(parentSpan.traceId);
      expect(childSpan.parentSpanId).toBe(parentSpan.spanId);

      childSpan.end();
      parentSpan.end();
    });

    it('should track active spans', () => {
      expect(tracingService.getActiveSpanCount()).toBe(0);

      const span1 = tracingService.startSpan('operation-1');
      expect(tracingService.getActiveSpanCount()).toBe(1);

      const span2 = tracingService.startSpan('operation-2');
      expect(tracingService.getActiveSpanCount()).toBe(2);

      span1.end();
      expect(tracingService.getActiveSpanCount()).toBe(1);

      span2.end();
      expect(tracingService.getActiveSpanCount()).toBe(0);
    });
  });

  describe('Trace Retrieval', () => {
    it('should retrieve trace by ID', () => {
      const span = tracingService.startSpan('test-operation');
      const completedSpan = span.end();

      const trace = tracingService.getTrace(completedSpan.traceId);

      expect(trace).toHaveLength(1);
      expect(trace[0].spanId).toBe(completedSpan.spanId);
    });

    it('should get trace summary', () => {
      const span = tracingService.startSpan('root-operation');
      const completedSpan = span.end();

      const summary = tracingService.getTraceSummary(completedSpan.traceId);

      expect(summary).not.toBeNull();
      expect(summary!.traceId).toBe(completedSpan.traceId);
      expect(summary!.spanCount).toBe(1);
      expect(summary!.hasErrors).toBe(false);
    });

    it('should detect errors in trace summary', () => {
      const span = tracingService.startSpan('failing-operation');
      span.setStatus(SpanStatus.ERROR, 'Error occurred');
      const completedSpan = span.end();

      const summary = tracingService.getTraceSummary(completedSpan.traceId);

      expect(summary!.hasErrors).toBe(true);
    });

    it('should return null for non-existent trace', () => {
      const summary = tracingService.getTraceSummary('non-existent-trace-id');
      expect(summary).toBeNull();
    });
  });

  describe('Trace Search', () => {
    beforeEach(() => {
      // Create some test spans
      const span1 = tracingService.startSpan('GET /users', {
        kind: SpanKind.SERVER,
        attributes: { 'http.method': 'GET' },
      });
      span1.end();

      const span2 = tracingService.startSpan('POST /orders', {
        kind: SpanKind.SERVER,
        attributes: { 'http.method': 'POST' },
      });
      span2.setStatus(SpanStatus.ERROR);
      span2.end();

      const span3 = tracingService.startSpan('database-query', {
        kind: SpanKind.CLIENT,
      });
      span3.end();
    });

    it('should search traces by operation name', () => {
      const results = tracingService.searchTraces({
        operationName: 'users',
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should search traces by status', () => {
      const results = tracingService.searchTraces({
        status: SpanStatus.ERROR,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].hasErrors).toBe(true);
    });

    it('should search traces with error filter', () => {
      const resultsWithErrors = tracingService.searchTraces({
        hasErrors: true,
      });

      const resultsWithoutErrors = tracingService.searchTraces({
        hasErrors: false,
      });

      expect(resultsWithErrors.length).toBeGreaterThanOrEqual(1);
      expect(resultsWithoutErrors.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit search results', () => {
      const results = tracingService.searchTraces({
        limit: 1,
      });

      expect(results.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should return tracing statistics', () => {
      // Create some test spans
      const span1 = tracingService.startSpan('operation-1');
      span1.end();

      const span2 = tracingService.startSpan('operation-2');
      span2.setStatus(SpanStatus.ERROR);
      span2.end();

      const stats = tracingService.getStats();

      expect(stats.totalSpans).toBeGreaterThanOrEqual(2);
      expect(stats.spansByStatus[SpanStatus.OK]).toBeGreaterThanOrEqual(1);
      expect(stats.spansByStatus[SpanStatus.ERROR]).toBeGreaterThanOrEqual(1);
      expect(stats.topOperations.length).toBeGreaterThanOrEqual(1);
    });

    it('should track top operations', () => {
      // Create multiple spans for same operation
      for (let i = 0; i < 5; i++) {
        const span = tracingService.startSpan('popular-operation');
        span.end();
      }

      const span = tracingService.startSpan('rare-operation');
      span.end();

      const stats = tracingService.getStats();

      expect(stats.topOperations[0].name).toBe('popular-operation');
      expect(stats.topOperations[0].count).toBe(5);
    });
  });

  describe('Sampling Configuration', () => {
    it('should return sampling configuration', () => {
      const config = tracingService.getSamplingConfig();

      expect(config.enabled).toBeDefined();
      expect(config.rate).toBeDefined();
      expect(config.alwaysSampleErrors).toBeDefined();
    });

    it('should update sampling configuration', () => {
      tracingService.updateSamplingConfig({
        rate: 0.5,
        slowRequestThresholdMs: 2000,
      });

      const config = tracingService.getSamplingConfig();

      expect(config.rate).toBe(0.5);
      expect(config.slowRequestThresholdMs).toBe(2000);
    });
  });

  describe('Context Propagation', () => {
    it('should extract context from HTTP headers', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      };

      const context = tracingService.extractContextFromHeaders(headers);

      expect(context).not.toBeNull();
      expect(context!.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(context!.spanId).toBe('b7ad6b7169203331');
      expect(context!.sampled).toBe(true);
    });

    it('should return null for missing traceparent header', () => {
      const context = tracingService.extractContextFromHeaders({});
      expect(context).toBeNull();
    });

    it('should inject context into HTTP headers', () => {
      const context = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        sampled: true,
        baggage: { 'user-id': '123' },
      };

      const headers = tracingService.injectContextToHeaders(context);

      expect(headers['traceparent']).toBe(
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
      );
      expect(headers['baggage']).toBe('user-id=123');
    });

    it('should parse baggage from headers', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        baggage: 'user-id=123,org-id=456',
      };

      const context = tracingService.extractContextFromHeaders(headers);

      expect(context!.baggage).toEqual({
        'user-id': '123',
        'org-id': '456',
      });
    });
  });

  describe('Middleware', () => {
    it('should create middleware function', () => {
      const middleware = tracingService.createMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should trace HTTP requests', () => {
      // Reset sampling config to ensure deterministic behavior
      // (previous tests may have modified it)
      tracingService.updateSamplingConfig({
        enabled: true,
        rate: 1.0,
        alwaysSampleErrors: true,
        alwaysSampleSlowRequests: true,
        slowRequestThresholdMs: 1000,
      });

      const middleware = tracingService.createMiddleware();

      const req = {
        headers: {},
        method: 'GET',
        path: '/api/users',
      };

      let nextCalled = false;
      let finishCallback: (() => void) | null = null;

      const res = {
        statusCode: 200,
        on: (event: string, callback: () => void) => {
          if (event === 'finish') {
            finishCallback = callback;
          }
        },
      };

      middleware(
        req as unknown as Parameters<ReturnType<typeof tracingService.createMiddleware>>[0],
        res,
        () => {
          nextCalled = true;
        }
      );

      expect(nextCalled).toBe(true);
      expect(req.traceContext).toBeDefined();
      expect(req.span).toBeDefined();

      // Simulate response finish
      if (finishCallback) {
        finishCallback();
      }

      // Verify span was completed
      const trace = tracingService.getTrace(req.traceContext!.traceId);
      expect(trace.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit spanStarted event', done => {
      tracingService.once('spanStarted', data => {
        expect(data.operationName).toBe('test-operation');
        expect(data.traceId).toBeDefined();
        expect(data.spanId).toBeDefined();
        done();
      });

      tracingService.startSpan('test-operation');
    });

    it('should emit spanCompleted event', done => {
      tracingService.once('spanCompleted', span => {
        expect(span.operationName).toBe('completed-operation');
        expect(span.status).toBe(SpanStatus.OK);
        done();
      });

      const span = tracingService.startSpan('completed-operation');
      span.end();
    });
  });

  describe('Service Name', () => {
    it('should return service name', () => {
      const serviceName = tracingService.getServiceName();
      expect(serviceName).toBeDefined();
      expect(typeof serviceName).toBe('string');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

