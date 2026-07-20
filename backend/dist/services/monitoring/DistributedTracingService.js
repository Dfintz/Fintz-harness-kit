"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributedTracingService = exports.DistributedTracingService = exports.SpanKind = exports.SpanStatus = void 0;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
var SpanStatus;
(function (SpanStatus) {
    SpanStatus["OK"] = "ok";
    SpanStatus["ERROR"] = "error";
    SpanStatus["TIMEOUT"] = "timeout";
    SpanStatus["CANCELLED"] = "cancelled";
})(SpanStatus || (exports.SpanStatus = SpanStatus = {}));
var SpanKind;
(function (SpanKind) {
    SpanKind["INTERNAL"] = "internal";
    SpanKind["SERVER"] = "server";
    SpanKind["CLIENT"] = "client";
    SpanKind["PRODUCER"] = "producer";
    SpanKind["CONSUMER"] = "consumer";
})(SpanKind || (exports.SpanKind = SpanKind = {}));
class DistributedTracingService extends events_1.EventEmitter {
    static instance;
    activeSpans = new Map();
    completedBuffer;
    bufferHead = 0;
    bufferCount = 0;
    maxCompletedSpans = 5000;
    serviceName;
    samplingConfig;
    constructor(serviceName = 'sc-fleet-manager') {
        super();
        this.serviceName = serviceName;
        this.completedBuffer = new Array(this.maxCompletedSpans).fill(null);
        this.samplingConfig = {
            enabled: true,
            rate: 1.0,
            alwaysSampleErrors: true,
            alwaysSampleSlowRequests: true,
            slowRequestThresholdMs: 1000
        };
        logger_1.logger.info('DistributedTracingService initialized', { serviceName });
    }
    static getInstance(serviceName) {
        if (!DistributedTracingService.instance) {
            DistributedTracingService.instance = new DistributedTracingService(serviceName);
        }
        return DistributedTracingService.instance;
    }
    generateTraceId() {
        return this.generateId(32);
    }
    generateSpanId() {
        return this.generateId(16);
    }
    generateId(length) {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }
    createTraceContext(parentContext) {
        const sampled = this.shouldSample();
        if (parentContext) {
            return {
                traceId: parentContext.traceId,
                spanId: this.generateSpanId(),
                parentSpanId: parentContext.spanId,
                sampled: parentContext.sampled,
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
    shouldSample() {
        if (!this.samplingConfig.enabled) {
            return true;
        }
        return Math.random() < this.samplingConfig.rate;
    }
    startSpan(operationName, options = {}) {
        const context = this.createTraceContext(options.parentContext);
        const startTime = new Date();
        let spanStatus = SpanStatus.OK;
        let errorMessage;
        const attributes = { ...options.attributes };
        const events = [];
        const span = {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            operationName,
            kind: options.kind || SpanKind.INTERNAL,
            startTime,
            attributes,
            events,
            setStatus: (status, message) => {
                spanStatus = status;
                errorMessage = message;
            },
            setAttribute: (key, value) => {
                attributes[key] = value;
            },
            addEvent: (name, eventAttributes) => {
                events.push({
                    name,
                    timestamp: new Date(),
                    attributes: eventAttributes
                });
            },
            end: () => {
                const endTime = new Date();
                const durationMs = endTime.getTime() - startTime.getTime();
                const completedSpan = {
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
                this.activeSpans.delete(context.spanId);
                const shouldStore = this.shouldStoreSpan(completedSpan);
                if (shouldStore) {
                    this.storeCompletedSpan(completedSpan);
                }
                this.emit('spanCompleted', completedSpan);
                return completedSpan;
            }
        };
        this.activeSpans.set(context.spanId, span);
        this.emit('spanStarted', { traceId: context.traceId, spanId: context.spanId, operationName });
        return span;
    }
    shouldStoreSpan(span) {
        if (!this.samplingConfig.enabled) {
            return true;
        }
        if (this.samplingConfig.alwaysSampleErrors && span.status === SpanStatus.ERROR) {
            return true;
        }
        if (this.samplingConfig.alwaysSampleSlowRequests &&
            span.durationMs > this.samplingConfig.slowRequestThresholdMs) {
            return true;
        }
        return Math.random() < this.samplingConfig.rate;
    }
    storeCompletedSpan(span) {
        this.completedBuffer[this.bufferHead] = span;
        this.bufferHead = (this.bufferHead + 1) % this.maxCompletedSpans;
        if (this.bufferCount < this.maxCompletedSpans) {
            this.bufferCount++;
        }
    }
    getCompletedSpans() {
        const spans = [];
        for (let i = 0; i < this.bufferCount; i++) {
            const idx = (this.bufferHead - 1 - i + this.maxCompletedSpans) % this.maxCompletedSpans;
            const span = this.completedBuffer[idx];
            if (span) {
                spans.push(span);
            }
        }
        return spans;
    }
    getTrace(traceId) {
        return this.getCompletedSpans().filter(span => span.traceId === traceId);
    }
    getTraceSummary(traceId) {
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
    searchTraces(filter) {
        let spans = this.getCompletedSpans();
        if (filter.traceId) {
            spans = spans.filter(s => s.traceId === filter.traceId);
        }
        if (filter.operationName) {
            spans = spans.filter(s => s.operationName.includes(filter.operationName));
        }
        if (filter.serviceName) {
            spans = spans.filter(s => s.serviceName === filter.serviceName);
        }
        if (filter.status) {
            spans = spans.filter(s => s.status === filter.status);
        }
        if (filter.minDurationMs !== undefined) {
            spans = spans.filter(s => s.durationMs >= filter.minDurationMs);
        }
        if (filter.maxDurationMs !== undefined) {
            spans = spans.filter(s => s.durationMs <= filter.maxDurationMs);
        }
        if (filter.startTimeAfter) {
            spans = spans.filter(s => s.startTime >= filter.startTimeAfter);
        }
        if (filter.startTimeBefore) {
            spans = spans.filter(s => s.startTime <= filter.startTimeBefore);
        }
        if (filter.hasErrors !== undefined) {
            if (filter.hasErrors) {
                spans = spans.filter(s => s.status === SpanStatus.ERROR);
            }
            else {
                spans = spans.filter(s => s.status !== SpanStatus.ERROR);
            }
        }
        const traceIds = Array.from(new Set(spans.map(s => s.traceId)));
        const summaries = traceIds
            .map(id => this.getTraceSummary(id))
            .filter((s) => s !== null);
        const limit = filter.limit || 100;
        return summaries.slice(0, limit);
    }
    getStats() {
        const spans = this.getCompletedSpans();
        const totalSpans = spans.length;
        const uniqueTraces = new Set(spans.map(s => s.traceId)).size;
        const activeSpans = this.activeSpans.size;
        const totalDuration = spans.reduce((sum, s) => sum + s.durationMs, 0);
        const averageDurationMs = totalSpans > 0 ? Math.round(totalDuration / totalSpans) : 0;
        const errorCount = spans.filter(s => s.status === SpanStatus.ERROR).length;
        const errorRate = totalSpans > 0 ? Math.round((errorCount / totalSpans) * 100) : 0;
        const spansByStatus = {
            [SpanStatus.OK]: 0,
            [SpanStatus.ERROR]: 0,
            [SpanStatus.TIMEOUT]: 0,
            [SpanStatus.CANCELLED]: 0
        };
        for (const span of spans) {
            spansByStatus[span.status]++;
        }
        const spansByKind = {
            [SpanKind.INTERNAL]: 0,
            [SpanKind.SERVER]: 0,
            [SpanKind.CLIENT]: 0,
            [SpanKind.PRODUCER]: 0,
            [SpanKind.CONSUMER]: 0
        };
        for (const span of spans) {
            spansByKind[span.kind]++;
        }
        const operationStats = new Map();
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
    updateSamplingConfig(config) {
        this.samplingConfig = { ...this.samplingConfig, ...config };
        logger_1.logger.info('Tracing sampling configuration updated', { config: this.samplingConfig });
    }
    getSamplingConfig() {
        return { ...this.samplingConfig };
    }
    extractContextFromHeaders(headers) {
        const traceParent = headers['traceparent'];
        if (!traceParent) {
            return null;
        }
        const parts = traceParent.split('-');
        if (parts.length !== 4) {
            return null;
        }
        const [_version, traceId, spanId, flags] = parts;
        const sampled = (parseInt(flags, 16) & 0x01) === 1;
        const baggageHeader = headers['baggage'];
        const baggage = {};
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
    injectContextToHeaders(context) {
        const flags = context.sampled ? '01' : '00';
        const traceParent = `00-${context.traceId}-${context.spanId}-${flags}`;
        const headers = {
            'traceparent': traceParent
        };
        if (context.baggage && Object.keys(context.baggage).length > 0) {
            const baggageItems = Object.entries(context.baggage)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join(',');
            headers['baggage'] = baggageItems;
        }
        return headers;
    }
    createMiddleware() {
        return (req, res, next) => {
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
            req.traceContext = {
                traceId: span.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                sampled: true
            };
            req.span = span;
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
    clearSpans() {
        this.activeSpans.clear();
        this.completedBuffer = new Array(this.maxCompletedSpans).fill(null);
        this.bufferHead = 0;
        this.bufferCount = 0;
    }
    getActiveSpanCount() {
        return this.activeSpans.size;
    }
    getServiceName() {
        return this.serviceName;
    }
}
exports.DistributedTracingService = DistributedTracingService;
exports.distributedTracingService = DistributedTracingService.getInstance();
//# sourceMappingURL=DistributedTracingService.js.map