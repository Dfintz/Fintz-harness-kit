/**
 * Distributed Tracing Service
 * 
 * Provides comprehensive request tracing across services for debugging,
 * performance analysis, and observability.
 * 
 * Features:
 * - Trace ID generation and propagation
 * - Span creation and management
 * - Context propagation across services
 * - Trace correlation for debugging
 * - Performance timing and metrics
 * - Trace sampling for production use
 * - Export to external tracing systems
 */

import { EventEmitter } from 'events';

import { logger } from '../../utils/logger';

/**
 * Span status indicating the outcome of the operation
 */
export enum SpanStatus {
    OK = 'ok',
    ERROR = 'error',
    TIMEOUT = 'timeout',
    CANCELLED = 'cancelled'
}

/**
 * Span kind indicating the type of operation
 */
export enum SpanKind {
    INTERNAL = 'internal',
    SERVER = 'server',
    CLIENT = 'client',
    PRODUCER = 'producer',
    CONSUMER = 'consumer'
}

/**
 * Trace context for propagation
 */
export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    sampled: boolean;
    baggage?: Record<string, string>;
}

/**
 * Span attributes for additional context
 */
export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}

/**
 * Span event for recording events within a span
 */
export interface SpanEvent {
    name: string;
    timestamp: Date;
    attributes?: SpanAttributes;
}

/**
 * Completed span for recording and export
 */
export interface CompletedSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    kind: SpanKind;
    startTime: Date;
    endTime: Date;
    durationMs: number;
    status: SpanStatus;
    errorMessage?: string;
    attributes: SpanAttributes;
    events: SpanEvent[];
    serviceName: string;
}

/**
 * Active span for in-progress operations
 */
export interface ActiveSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    kind: SpanKind;
    startTime: Date;
    attributes: SpanAttributes;
    events: SpanEvent[];
    
    // Methods for span manipulation
    setStatus(status: SpanStatus, errorMessage?: string): void;
    setAttribute(key: string, value: string | number | boolean): void;
    addEvent(name: string, attributes?: SpanAttributes): void;
    end(): CompletedSpan;
}

/**
 * Trace summary for quick overview
 */
export interface TraceSummary {
    traceId: string;
    rootSpan?: CompletedSpan;
    spanCount: number;
    totalDurationMs: number;
    hasErrors: boolean;
    services: string[];
    startTime: Date;
    endTime?: Date;
}

/**
 * Trace filter for querying traces
 */
export interface TraceFilter {
    traceId?: string;
    operationName?: string;
    serviceName?: string;
    status?: SpanStatus;
    minDurationMs?: number;
    maxDurationMs?: number;
    startTimeAfter?: Date;
    startTimeBefore?: Date;
    hasErrors?: boolean;
    limit?: number;
}

/**
 * Tracing statistics
 */
export interface TracingStats {
    totalTraces: number;
    totalSpans: number;
    activeSpans: number;
    averageDurationMs: number;
    errorRate: number;
    samplingRate: number;
    spansByStatus: Record<SpanStatus, number>;
    spansByKind: Record<SpanKind, number>;
    topOperations: Array<{ name: string; count: number; avgDurationMs: number }>;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
    enabled: boolean;
    rate: number; // 0-1, percentage of traces to sample
    alwaysSampleErrors: boolean;
    alwaysSampleSlowRequests: boolean;
    slowRequestThresholdMs: number;
}

/**
 * Distributed Tracing Service
 * 
 * Provides comprehensive request tracing across services for debugging,
 * performance analysis, and observability.
 */
export class DistributedTracingService extends EventEmitter {
    private static instance: DistributedTracingService;
    
    private activeSpans: Map<string, ActiveSpan> = new Map();
    /** Circular buffer for completed spans (fixed memory, no leak) */
    private completedBuffer: (CompletedSpan | null)[];
    private bufferHead: number = 0;
    private bufferCount: number = 0;
    private readonly maxCompletedSpans = 5000;
    private readonly serviceName: string;
    private samplingConfig: SamplingConfig;

    private constructor(serviceName: string = 'sc-fleet-manager') {
        super();
        this.serviceName = serviceName;
        this.completedBuffer = new Array(this.maxCompletedSpans).fill(null);
        this.samplingConfig = {
            enabled: true,
            rate: 1.0, // Sample all traces by default
            alwaysSampleErrors: true,
            alwaysSampleSlowRequests: true,
            slowRequestThresholdMs: 1000
        };
        
        logger.info('DistributedTracingService initialized', { serviceName });
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(serviceName?: string): DistributedTracingService {
        if (!DistributedTracingService.instance) {
            DistributedTracingService.instance = new DistributedTracingService(serviceName);
        }
        return DistributedTracingService.instance;
    }
    
    /**
     * Generate a unique trace ID
     */
    public generateTraceId(): string {
        return this.generateId(32);
    }
    
    /**
     * Generate a unique span ID
     */
    public generateSpanId(): string {
        return this.generateId(16);
    }
    
    /**
     * Generate random hex ID
     */
    private generateId(length: number): string {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }
    
    /**
     * Create a new trace context
     */
    public createTraceContext(parentContext?: TraceContext): TraceContext {
        const sampled = this.shouldSample();
        
        if (parentContext) {
            return {
                traceId: parentContext.traceId,
                spanId: this.generateSpanId(),
                parentSpanId: parentContext.spanId,
                sampled: parentContext.sampled, // Inherit sampling decision
                baggage: { ...parentContext.baggage }
            };
        }
        
        return {
            traceId: this.generateTraceId(),
            spanId: this.generateSpanId(),
            sampled,
            baggage: {}
        };
    }
    
    /**
     * Determine if trace should be sampled
     */
    private shouldSample(): boolean {
        if (!this.samplingConfig.enabled) {
            return true;
        }
        return Math.random() < this.samplingConfig.rate;
    }
    
    /**
     * Start a new span
     */
    public startSpan(
        operationName: string,
        options: {
            kind?: SpanKind;
            parentContext?: TraceContext;
            attributes?: SpanAttributes;
        } = {}
    ): ActiveSpan {
        const context = this.createTraceContext(options.parentContext);
        const startTime = new Date();
        
        let spanStatus: SpanStatus = SpanStatus.OK;
        let errorMessage: string | undefined;
        const attributes: SpanAttributes = { ...options.attributes };
        const events: SpanEvent[] = [];
        
        const span: ActiveSpan = {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            operationName,
            kind: options.kind || SpanKind.INTERNAL,
            startTime,
            attributes,
            events,
            
            setStatus: (status: SpanStatus, message?: string) => {
                spanStatus = status;
                errorMessage = message;
            },
            
            setAttribute: (key: string, value: string | number | boolean) => {
                attributes[key] = value;
            },
            
            addEvent: (name: string, eventAttributes?: SpanAttributes) => {
                events.push({
                    name,
                    timestamp: new Date(),
                    attributes: eventAttributes
                });
            },
            
            end: (): CompletedSpan => {
                const endTime = new Date();
                const durationMs = endTime.getTime() - startTime.getTime();
                
                const completedSpan: CompletedSpan = {
                    traceId: context.traceId,
                    spanId: context.spanId,
                    parentSpanId: context.parentSpanId,
                    operationName,
                    kind: options.kind || SpanKind.INTERNAL,
                    startTime,
                    endTime,
                    durationMs,
                    status: spanStatus,
                    errorMessage,
                    attributes,
                    events,
                    serviceName: this.serviceName
                };
                
                // Remove from active spans
                this.activeSpans.delete(context.spanId);
                
                // Determine if we should store this span
                const shouldStore = this.shouldStoreSpan(completedSpan);
                if (shouldStore) {
                    this.storeCompletedSpan(completedSpan);
                }
                
                // Emit span completion event
                this.emit('spanCompleted', completedSpan);
                
                return completedSpan;
            }
        };
        
        this.activeSpans.set(context.spanId, span);
        
        // Emit span start event
        this.emit('spanStarted', { traceId: context.traceId, spanId: context.spanId, operationName });
        
        return span;
    }
    
    /**
     * Determine if span should be stored based on sampling config
     */
    private shouldStoreSpan(span: CompletedSpan): boolean {
        if (!this.samplingConfig.enabled) {
            return true;
        }
        
        // Always store errors if configured
        if (this.samplingConfig.alwaysSampleErrors && span.status === SpanStatus.ERROR) {
            return true;
        }
        
        // Always store slow requests if configured
        if (this.samplingConfig.alwaysSampleSlowRequests && 
            span.durationMs > this.samplingConfig.slowRequestThresholdMs) {
            return true;
        }
        
        // Use sampling decision from trace creation
        return Math.random() < this.samplingConfig.rate;
    }
    
    /**
     * Store completed span in circular buffer
     */
    private storeCompletedSpan(span: CompletedSpan): void {
        this.completedBuffer[this.bufferHead] = span;
        this.bufferHead = (this.bufferHead + 1) % this.maxCompletedSpans;
        if (this.bufferCount < this.maxCompletedSpans) {
            this.bufferCount++;
        }
    }

    /**
     * Get all completed spans from circular buffer
     */
    private getCompletedSpans(): CompletedSpan[] {
        const spans: CompletedSpan[] = [];
        for (let i = 0; i < this.bufferCount; i++) {
            const idx = (this.bufferHead - 1 - i + this.maxCompletedSpans) % this.maxCompletedSpans;
            const span = this.completedBuffer[idx];
            if (span) {
                spans.push(span);
            }
        }
        return spans;
    }

    /**
     * Get trace by ID
     */
    public getTrace(traceId: string): CompletedSpan[] {
        return this.getCompletedSpans().filter(span => span.traceId === traceId);
    }
    
    /**
     * Get trace summary
     */
    public getTraceSummary(traceId: string): TraceSummary | null {
        const spans = this.getTrace(traceId);
        if (spans.length === 0) {
            return null;
        }
        
        const rootSpan = spans.find(s => !s.parentSpanId);
        const sortedSpans = spans.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        const startTime = sortedSpans[0].startTime;
        const endSpans = spans.filter(s => s.endTime).sort((a, b) => b.endTime.getTime() - a.endTime.getTime());
        const endTime = endSpans.length > 0 ? endSpans[0].endTime : undefined;
        
        const services = Array.from(new Set(spans.map(s => s.serviceName)));
        const hasErrors = spans.some(s => s.status === SpanStatus.ERROR);
        
        return {
            traceId,
            rootSpan,
            spanCount: spans.length,
            totalDurationMs: endTime ? endTime.getTime() - startTime.getTime() : 0,
            hasErrors,
            services,
            startTime,
            endTime
        };
    }
    
    /**
     * Search traces with filters
     */
    public searchTraces(filter: TraceFilter): TraceSummary[] {
        let spans = this.getCompletedSpans();
        
        // Apply filters
        if (filter.traceId) {
            spans = spans.filter(s => s.traceId === filter.traceId);
        }
        
        if (filter.operationName) {
            // @ts-expect-error - Strict mode compatibility
            spans = spans.filter(s => s.operationName.includes(filter.operationName));
        }
        
        if (filter.serviceName) {
            spans = spans.filter(s => s.serviceName === filter.serviceName);
        }
        
        if (filter.status) {
            spans = spans.filter(s => s.status === filter.status);
        }
        
        if (filter.minDurationMs !== undefined) {
            // @ts-expect-error - Strict mode compatibility
            spans = spans.filter(s => s.durationMs >= filter.minDurationMs);
        }
        
        if (filter.maxDurationMs !== undefined) {
            // @ts-expect-error - Strict mode compatibility
            spans = spans.filter(s => s.durationMs <= filter.maxDurationMs);
        }
        
        if (filter.startTimeAfter) {
            // @ts-expect-error - Strict mode compatibility
            spans = spans.filter(s => s.startTime >= filter.startTimeAfter);
        }
        
        if (filter.startTimeBefore) {
            // @ts-expect-error - Strict mode compatibility
            spans = spans.filter(s => s.startTime <= filter.startTimeBefore);
        }
        
        if (filter.hasErrors !== undefined) {
            if (filter.hasErrors) {
                spans = spans.filter(s => s.status === SpanStatus.ERROR);
            } else {
                spans = spans.filter(s => s.status !== SpanStatus.ERROR);
            }
        }
        
        // Get unique trace IDs and create summaries
        const traceIds = Array.from(new Set(spans.map(s => s.traceId)));
        const summaries = traceIds
            .map(id => this.getTraceSummary(id))
            .filter((s): s is TraceSummary => s !== null);
        
        // Apply limit
        const limit = filter.limit || 100;
        return summaries.slice(0, limit);
    }
    
    /**
     * Get tracing statistics
     */
    public getStats(): TracingStats {
        const spans = this.getCompletedSpans();
        const totalSpans = spans.length;
        const uniqueTraces = new Set(spans.map(s => s.traceId)).size;
        const activeSpans = this.activeSpans.size;
        
        const totalDuration = spans.reduce((sum, s) => sum + s.durationMs, 0);
        const averageDurationMs = totalSpans > 0 ? Math.round(totalDuration / totalSpans) : 0;
        
        const errorCount = spans.filter(s => s.status === SpanStatus.ERROR).length;
        const errorRate = totalSpans > 0 ? Math.round((errorCount / totalSpans) * 100) : 0;
        
        // Count by status
        const spansByStatus: Record<SpanStatus, number> = {
            [SpanStatus.OK]: 0,
            [SpanStatus.ERROR]: 0,
            [SpanStatus.TIMEOUT]: 0,
            [SpanStatus.CANCELLED]: 0
        };
        
        for (const span of spans) {
            spansByStatus[span.status]++;
        }
        
        // Count by kind
        const spansByKind: Record<SpanKind, number> = {
            [SpanKind.INTERNAL]: 0,
            [SpanKind.SERVER]: 0,
            [SpanKind.CLIENT]: 0,
            [SpanKind.PRODUCER]: 0,
            [SpanKind.CONSUMER]: 0
        };
        
        for (const span of spans) {
            spansByKind[span.kind]++;
        }
        
        // Top operations
        const operationStats = new Map<string, { count: number; totalDuration: number }>();
        for (const span of spans) {
            const existing = operationStats.get(span.operationName) || { count: 0, totalDuration: 0 };
            existing.count++;
            existing.totalDuration += span.durationMs;
            operationStats.set(span.operationName, existing);
        }
        
        const topOperations = Array.from(operationStats.entries())
            .map(([name, stats]) => ({
                name,
                count: stats.count,
                avgDurationMs: Math.round(stats.totalDuration / stats.count)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        return {
            totalTraces: uniqueTraces,
            totalSpans,
            activeSpans,
            averageDurationMs,
            errorRate,
            samplingRate: this.samplingConfig.rate * 100,
            spansByStatus,
            spansByKind,
            topOperations
        };
    }
    
    /**
     * Update sampling configuration
     */
    public updateSamplingConfig(config: Partial<SamplingConfig>): void {
        this.samplingConfig = { ...this.samplingConfig, ...config };
        logger.info('Tracing sampling configuration updated', { config: this.samplingConfig });
    }
    
    /**
     * Get current sampling configuration
     */
    public getSamplingConfig(): SamplingConfig {
        return { ...this.samplingConfig };
    }
    
    /**
     * Parse trace context from HTTP headers
     */
    public extractContextFromHeaders(headers: Record<string, string | string[] | undefined>): TraceContext | null {
        const traceParent = headers['traceparent'] as string | undefined;
        if (!traceParent) {
            return null;
        }
        
        // Parse W3C Trace Context format: version-traceId-spanId-flags
        const parts = traceParent.split('-');
        if (parts.length !== 4) {
            return null;
        }
        
        const [_version, traceId, spanId, flags] = parts;
        const sampled = (parseInt(flags, 16) & 0x01) === 1;
        
        // Extract baggage if present
        const baggageHeader = headers['baggage'] as string | undefined;
        const baggage: Record<string, string> = {};
        
        if (baggageHeader) {
            const items = baggageHeader.split(',');
            for (const item of items) {
                const [key, value] = item.trim().split('=');
                if (key && value) {
                    baggage[key] = decodeURIComponent(value);
                }
            }
        }
        
        return {
            traceId,
            spanId,
            sampled,
            baggage
        };
    }
    
    /**
     * Inject trace context into HTTP headers
     */
    public injectContextToHeaders(context: TraceContext): Record<string, string> {
        const flags = context.sampled ? '01' : '00';
        const traceParent = `00-${context.traceId}-${context.spanId}-${flags}`;
        
        const headers: Record<string, string> = {
            'traceparent': traceParent
        };
        
        // Add baggage if present
        if (context.baggage && Object.keys(context.baggage).length > 0) {
            const baggageItems = Object.entries(context.baggage)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join(',');
            headers['baggage'] = baggageItems;
        }
        
        return headers;
    }
    
    /**
     * Create middleware for Express request tracing
     */
    public createMiddleware() {
        return (req: { headers: Record<string, string | string[] | undefined>; method: string; path: string; traceContext?: TraceContext; span?: ActiveSpan }, 
                res: { on: (event: string, callback: () => void) => void; statusCode: number }, 
                next: () => void) => {
            // Extract or create trace context
            const parentContext = this.extractContextFromHeaders(req.headers);
            const span = this.startSpan(`${req.method} ${req.path}`, {
                kind: SpanKind.SERVER,
                parentContext: parentContext || undefined,
                attributes: {
                    'http.method': req.method,
                    'http.url': req.path,
                    'http.route': req.path
                }
            });
            
            // Attach to request for downstream use
            req.traceContext = {
                traceId: span.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                sampled: true
            };
            req.span = span;
            
            // End span when response finishes
            res.on('finish', () => {
                span.setAttribute('http.status_code', res.statusCode);
                if (res.statusCode >= 400) {
                    span.setStatus(SpanStatus.ERROR, `HTTP ${res.statusCode}`);
                }
                span.end();
            });
            
            next();
        };
    }
    
    /**
     * Clear all stored spans (for testing)
     */
    public clearSpans(): void {
        this.activeSpans.clear();
        this.completedBuffer = new Array(this.maxCompletedSpans).fill(null);
        this.bufferHead = 0;
        this.bufferCount = 0;
    }
    
    /**
     * Get active span count
     */
    public getActiveSpanCount(): number {
        return this.activeSpans.size;
    }
    
    /**
     * Get service name
     */
    public getServiceName(): string {
        return this.serviceName;
    }
}

// Export singleton instance
export const distributedTracingService = DistributedTracingService.getInstance();


