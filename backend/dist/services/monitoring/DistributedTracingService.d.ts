import { EventEmitter } from 'events';
export declare enum SpanStatus {
    OK = "ok",
    ERROR = "error",
    TIMEOUT = "timeout",
    CANCELLED = "cancelled"
}
export declare enum SpanKind {
    INTERNAL = "internal",
    SERVER = "server",
    CLIENT = "client",
    PRODUCER = "producer",
    CONSUMER = "consumer"
}
export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    sampled: boolean;
    baggage?: Record<string, string>;
}
export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}
export interface SpanEvent {
    name: string;
    timestamp: Date;
    attributes?: SpanAttributes;
}
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
export interface ActiveSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    kind: SpanKind;
    startTime: Date;
    attributes: SpanAttributes;
    events: SpanEvent[];
    setStatus(status: SpanStatus, errorMessage?: string): void;
    setAttribute(key: string, value: string | number | boolean): void;
    addEvent(name: string, attributes?: SpanAttributes): void;
    end(): CompletedSpan;
}
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
export interface TracingStats {
    totalTraces: number;
    totalSpans: number;
    activeSpans: number;
    averageDurationMs: number;
    errorRate: number;
    samplingRate: number;
    spansByStatus: Record<SpanStatus, number>;
    spansByKind: Record<SpanKind, number>;
    topOperations: Array<{
        name: string;
        count: number;
        avgDurationMs: number;
    }>;
}
export interface SamplingConfig {
    enabled: boolean;
    rate: number;
    alwaysSampleErrors: boolean;
    alwaysSampleSlowRequests: boolean;
    slowRequestThresholdMs: number;
}
export declare class DistributedTracingService extends EventEmitter {
    private static instance;
    private activeSpans;
    private completedBuffer;
    private bufferHead;
    private bufferCount;
    private readonly maxCompletedSpans;
    private readonly serviceName;
    private samplingConfig;
    private constructor();
    static getInstance(serviceName?: string): DistributedTracingService;
    generateTraceId(): string;
    generateSpanId(): string;
    private generateId;
    createTraceContext(parentContext?: TraceContext): TraceContext;
    private shouldSample;
    startSpan(operationName: string, options?: {
        kind?: SpanKind;
        parentContext?: TraceContext;
        attributes?: SpanAttributes;
    }): ActiveSpan;
    private shouldStoreSpan;
    private storeCompletedSpan;
    private getCompletedSpans;
    getTrace(traceId: string): CompletedSpan[];
    getTraceSummary(traceId: string): TraceSummary | null;
    searchTraces(filter: TraceFilter): TraceSummary[];
    getStats(): TracingStats;
    updateSamplingConfig(config: Partial<SamplingConfig>): void;
    getSamplingConfig(): SamplingConfig;
    extractContextFromHeaders(headers: Record<string, string | string[] | undefined>): TraceContext | null;
    injectContextToHeaders(context: TraceContext): Record<string, string>;
    createMiddleware(): (req: {
        headers: Record<string, string | string[] | undefined>;
        method: string;
        path: string;
        traceContext?: TraceContext;
        span?: ActiveSpan;
    }, res: {
        on: (event: string, callback: () => void) => void;
        statusCode: number;
    }, next: () => void) => void;
    clearSpans(): void;
    getActiveSpanCount(): number;
    getServiceName(): string;
}
export declare const distributedTracingService: DistributedTracingService;
//# sourceMappingURL=DistributedTracingService.d.ts.map