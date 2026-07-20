import { EventEmitter } from 'events';
export declare enum ScalingDirection {
    UP = "up",
    DOWN = "down",
    NONE = "none"
}
export declare enum ScalingMetricType {
    CPU = "cpu",
    MEMORY = "memory",
    REQUEST_RATE = "request_rate",
    RESPONSE_TIME = "response_time",
    ERROR_RATE = "error_rate",
    QUEUE_LENGTH = "queue_length",
    CONNECTION_COUNT = "connection_count",
    CUSTOM = "custom"
}
export declare enum ScalingTriggerStatus {
    ACTIVE = "active",
    COOLING_DOWN = "cooling_down",
    DISABLED = "disabled"
}
export interface MetricValue {
    type: ScalingMetricType;
    value: number;
    timestamp: Date;
    unit: string;
}
export interface ScalingThreshold {
    metricType: ScalingMetricType;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    evaluationPeriodMs: number;
    dataPointsRequired: number;
    unit: string;
}
export interface ScalingRecommendation {
    id: string;
    direction: ScalingDirection;
    reason: string;
    metricType: ScalingMetricType;
    currentValue: number;
    threshold: number;
    timestamp: Date;
    confidence: number;
    suggestedInstances?: number;
    estimatedImpact?: string;
}
export interface ScalingEvent {
    id: string;
    direction: ScalingDirection;
    reason: string;
    triggeredAt: Date;
    metricType: ScalingMetricType;
    metricValue: number;
    threshold: number;
    status: 'pending' | 'executed' | 'failed' | 'cancelled';
    executedAt?: Date;
    instancesBefore?: number;
    instancesAfter?: number;
    errorMessage?: string;
}
export interface AutoScalingConfig {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    currentInstances: number;
    cooldownPeriodMs: number;
    evaluationIntervalMs: number;
    thresholds: ScalingThreshold[];
}
export interface ScalingStats {
    totalScaleUpEvents: number;
    totalScaleDownEvents: number;
    lastScaleUpAt?: Date;
    lastScaleDownAt?: Date;
    currentInstances: number;
    minInstances: number;
    maxInstances: number;
    averageInstanceCount: number;
    cooldownRemainingSec: number;
    status: ScalingTriggerStatus;
    recentEvents: ScalingEvent[];
}
export declare class AutoScalingTriggerService extends EventEmitter {
    private static instance;
    private config;
    private metricHistory;
    private scalingEvents;
    private lastScaleTime;
    private evaluationInterval;
    private instanceCountHistory;
    private previousCpuUsage;
    private previousCpuTimestamp;
    private readonly maxHistorySize;
    private readonly maxEventHistory;
    private constructor();
    static getInstance(): AutoScalingTriggerService;
    private getDefaultThresholds;
    recordMetric(type: ScalingMetricType, value: number, unit?: string): void;
    private getUnitForMetric;
    evaluateScaling(): ScalingRecommendation | null;
    private evaluateThreshold;
    private createRecommendation;
    private generateId;
    isInCooldown(): boolean;
    getCooldownRemaining(): number;
    recordScalingEvent(direction: ScalingDirection, reason: string, metricType: ScalingMetricType, metricValue: number, threshold: number, instancesBefore?: number, instancesAfter?: number): ScalingEvent;
    updateEventStatus(eventId: string, status: ScalingEvent['status'], instancesAfter?: number, errorMessage?: string): ScalingEvent | null;
    startAutoEvaluation(): void;
    stopAutoEvaluation(): void;
    private collectSystemMetrics;
    getConfig(): AutoScalingConfig;
    updateConfig(updates: Partial<AutoScalingConfig>): void;
    updateThreshold(metricType: ScalingMetricType, updates: Partial<ScalingThreshold>): void;
    getStats(): ScalingStats;
    getMetricHistory(type: ScalingMetricType, durationMs?: number): MetricValue[];
    getAllMetrics(): Map<ScalingMetricType, MetricValue[]>;
    getScalingEvents(limit?: number): ScalingEvent[];
    triggerManualScale(direction: ScalingDirection, reason: string): ScalingEvent | null;
    clearMetrics(): void;
    setCurrentInstances(count: number): void;
}
export declare const autoScalingTriggerService: AutoScalingTriggerService;
//# sourceMappingURL=AutoScalingTriggerService.d.ts.map