"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoScalingTriggerService = exports.AutoScalingTriggerService = exports.ScalingTriggerStatus = exports.ScalingMetricType = exports.ScalingDirection = void 0;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
var ScalingDirection;
(function (ScalingDirection) {
    ScalingDirection["UP"] = "up";
    ScalingDirection["DOWN"] = "down";
    ScalingDirection["NONE"] = "none";
})(ScalingDirection || (exports.ScalingDirection = ScalingDirection = {}));
var ScalingMetricType;
(function (ScalingMetricType) {
    ScalingMetricType["CPU"] = "cpu";
    ScalingMetricType["MEMORY"] = "memory";
    ScalingMetricType["REQUEST_RATE"] = "request_rate";
    ScalingMetricType["RESPONSE_TIME"] = "response_time";
    ScalingMetricType["ERROR_RATE"] = "error_rate";
    ScalingMetricType["QUEUE_LENGTH"] = "queue_length";
    ScalingMetricType["CONNECTION_COUNT"] = "connection_count";
    ScalingMetricType["CUSTOM"] = "custom";
})(ScalingMetricType || (exports.ScalingMetricType = ScalingMetricType = {}));
var ScalingTriggerStatus;
(function (ScalingTriggerStatus) {
    ScalingTriggerStatus["ACTIVE"] = "active";
    ScalingTriggerStatus["COOLING_DOWN"] = "cooling_down";
    ScalingTriggerStatus["DISABLED"] = "disabled";
})(ScalingTriggerStatus || (exports.ScalingTriggerStatus = ScalingTriggerStatus = {}));
class AutoScalingTriggerService extends events_1.EventEmitter {
    static instance;
    config;
    metricHistory = new Map();
    scalingEvents = [];
    lastScaleTime = null;
    evaluationInterval = null;
    instanceCountHistory = [];
    previousCpuUsage = process.cpuUsage();
    previousCpuTimestamp = Date.now();
    maxHistorySize = 1000;
    maxEventHistory = 100;
    constructor() {
        super();
        this.config = {
            enabled: true,
            minInstances: 1,
            maxInstances: 10,
            currentInstances: 1,
            cooldownPeriodMs: 5 * 60 * 1000,
            evaluationIntervalMs: 30 * 1000,
            thresholds: this.getDefaultThresholds(),
        };
        logger_1.logger.info('AutoScalingTriggerService initialized');
    }
    static getInstance() {
        if (!AutoScalingTriggerService.instance) {
            AutoScalingTriggerService.instance = new AutoScalingTriggerService();
        }
        return AutoScalingTriggerService.instance;
    }
    getDefaultThresholds() {
        return [
            {
                metricType: ScalingMetricType.CPU,
                scaleUpThreshold: 80,
                scaleDownThreshold: 20,
                evaluationPeriodMs: 60 * 1000,
                dataPointsRequired: 3,
                unit: 'percent',
            },
            {
                metricType: ScalingMetricType.MEMORY,
                scaleUpThreshold: 85,
                scaleDownThreshold: 30,
                evaluationPeriodMs: 60 * 1000,
                dataPointsRequired: 3,
                unit: 'percent',
            },
            {
                metricType: ScalingMetricType.RESPONSE_TIME,
                scaleUpThreshold: 1000,
                scaleDownThreshold: 200,
                evaluationPeriodMs: 60 * 1000,
                dataPointsRequired: 5,
                unit: 'ms',
            },
            {
                metricType: ScalingMetricType.ERROR_RATE,
                scaleUpThreshold: 5,
                scaleDownThreshold: 0.5,
                evaluationPeriodMs: 60 * 1000,
                dataPointsRequired: 3,
                unit: 'percent',
            },
            {
                metricType: ScalingMetricType.REQUEST_RATE,
                scaleUpThreshold: 1000,
                scaleDownThreshold: 100,
                evaluationPeriodMs: 60 * 1000,
                dataPointsRequired: 3,
                unit: 'requests/sec',
            },
        ];
    }
    recordMetric(type, value, unit) {
        const metricValue = {
            type,
            value,
            timestamp: new Date(),
            unit: unit || this.getUnitForMetric(type),
        };
        const history = this.metricHistory.get(type) || [];
        history.push(metricValue);
        const now = Date.now();
        const maxAge = Math.max(...this.config.thresholds.map(t => t.evaluationPeriodMs)) * 2;
        const filtered = history.filter(m => now - m.timestamp.getTime() < maxAge);
        if (filtered.length > this.maxHistorySize) {
            filtered.splice(0, filtered.length - this.maxHistorySize);
        }
        this.metricHistory.set(type, filtered);
    }
    getUnitForMetric(type) {
        const threshold = this.config.thresholds.find(t => t.metricType === type);
        return threshold?.unit || 'units';
    }
    evaluateScaling() {
        if (!this.config.enabled) {
            return null;
        }
        if (this.isInCooldown()) {
            return null;
        }
        for (const threshold of this.config.thresholds) {
            const recommendation = this.evaluateThreshold(threshold);
            if (recommendation && recommendation.direction !== ScalingDirection.NONE) {
                return recommendation;
            }
        }
        return null;
    }
    evaluateThreshold(threshold) {
        const history = this.metricHistory.get(threshold.metricType) || [];
        const now = Date.now();
        const recentValues = history.filter(m => now - m.timestamp.getTime() <= threshold.evaluationPeriodMs);
        if (recentValues.length < threshold.dataPointsRequired) {
            return null;
        }
        const avgValue = recentValues.reduce((sum, m) => sum + m.value, 0) / recentValues.length;
        if (avgValue >= threshold.scaleUpThreshold &&
            this.config.currentInstances < this.config.maxInstances) {
            const confidence = Math.min(100, Math.round(((avgValue - threshold.scaleUpThreshold) / threshold.scaleUpThreshold) * 100 + 50));
            return this.createRecommendation(ScalingDirection.UP, threshold.metricType, avgValue, threshold.scaleUpThreshold, confidence, `${threshold.metricType} (${avgValue.toFixed(1)}${threshold.unit}) exceeded scale-up threshold (${threshold.scaleUpThreshold}${threshold.unit})`);
        }
        if (avgValue <= threshold.scaleDownThreshold &&
            this.config.currentInstances > this.config.minInstances) {
            const confidence = Math.min(100, Math.round(((threshold.scaleDownThreshold - avgValue) / threshold.scaleDownThreshold) * 100 + 50));
            return this.createRecommendation(ScalingDirection.DOWN, threshold.metricType, avgValue, threshold.scaleDownThreshold, confidence, `${threshold.metricType} (${avgValue.toFixed(1)}${threshold.unit}) below scale-down threshold (${threshold.scaleDownThreshold}${threshold.unit})`);
        }
        return null;
    }
    createRecommendation(direction, metricType, currentValue, threshold, confidence, reason) {
        const suggestedInstances = direction === ScalingDirection.UP
            ? Math.min(this.config.currentInstances + 1, this.config.maxInstances)
            : Math.max(this.config.currentInstances - 1, this.config.minInstances);
        return {
            id: this.generateId(),
            direction,
            reason,
            metricType,
            currentValue,
            threshold,
            timestamp: new Date(),
            confidence,
            suggestedInstances,
            estimatedImpact: direction === ScalingDirection.UP
                ? 'Increased capacity to handle higher load'
                : 'Reduced costs by removing underutilized capacity',
        };
    }
    generateId() {
        return `scaling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    isInCooldown() {
        if (!this.lastScaleTime) {
            return false;
        }
        const elapsed = Date.now() - this.lastScaleTime.getTime();
        return elapsed < this.config.cooldownPeriodMs;
    }
    getCooldownRemaining() {
        if (!this.lastScaleTime) {
            return 0;
        }
        const elapsed = Date.now() - this.lastScaleTime.getTime();
        const remaining = this.config.cooldownPeriodMs - elapsed;
        return Math.max(0, Math.ceil(remaining / 1000));
    }
    recordScalingEvent(direction, reason, metricType, metricValue, threshold, instancesBefore, instancesAfter) {
        const event = {
            id: this.generateId(),
            direction,
            reason,
            triggeredAt: new Date(),
            metricType,
            metricValue,
            threshold,
            status: 'pending',
            instancesBefore,
            instancesAfter,
        };
        this.scalingEvents.push(event);
        if (this.scalingEvents.length > this.maxEventHistory) {
            this.scalingEvents = this.scalingEvents.slice(-this.maxEventHistory);
        }
        this.lastScaleTime = new Date();
        this.emit('scalingTriggered', event);
        logger_1.logger.info('Scaling event recorded', { event });
        return event;
    }
    updateEventStatus(eventId, status, instancesAfter, errorMessage) {
        const event = this.scalingEvents.find(e => e.id === eventId);
        if (!event) {
            return null;
        }
        event.status = status;
        if (status === 'executed') {
            event.executedAt = new Date();
            if (instancesAfter !== undefined) {
                event.instancesAfter = instancesAfter;
                this.config.currentInstances = instancesAfter;
                this.instanceCountHistory.push({
                    count: instancesAfter,
                    timestamp: new Date(),
                });
            }
        }
        if (errorMessage) {
            event.errorMessage = errorMessage;
        }
        this.emit('scalingCompleted', event);
        return event;
    }
    startAutoEvaluation() {
        if (this.evaluationInterval) {
            return;
        }
        this.previousCpuUsage = process.cpuUsage();
        this.previousCpuTimestamp = Date.now();
        this.evaluationInterval = setInterval(() => {
            try {
                this.collectSystemMetrics();
                const recommendation = this.evaluateScaling();
                if (recommendation) {
                    this.emit('scalingRecommendation', recommendation);
                    logger_1.logger.info('Scaling recommendation generated', { recommendation });
                }
            }
            catch (error) {
                logger_1.logger.error('Auto-evaluation error', { error });
            }
        }, this.config.evaluationIntervalMs);
        logger_1.logger.info('Auto-scaling evaluation started', {
            intervalMs: this.config.evaluationIntervalMs,
        });
    }
    stopAutoEvaluation() {
        if (this.evaluationInterval) {
            clearInterval(this.evaluationInterval);
            this.evaluationInterval = null;
            logger_1.logger.info('Auto-scaling evaluation stopped');
        }
    }
    collectSystemMetrics() {
        const memory = process.memoryUsage();
        const memoryPercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);
        this.recordMetric(ScalingMetricType.MEMORY, memoryPercent, 'percent');
        const now = Date.now();
        const cpuNow = process.cpuUsage(this.previousCpuUsage);
        const elapsedMs = now - this.previousCpuTimestamp;
        if (elapsedMs <= 0) {
            this.previousCpuUsage = process.cpuUsage();
            this.previousCpuTimestamp = now;
            return;
        }
        const elapsedUs = elapsedMs * 1000;
        const cpuPercent = Math.min(100, Math.round(((cpuNow.user + cpuNow.system) / elapsedUs) * 100));
        this.previousCpuUsage = process.cpuUsage();
        this.previousCpuTimestamp = now;
        this.recordMetric(ScalingMetricType.CPU, cpuPercent, 'percent');
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        if (updates.evaluationIntervalMs !== undefined && this.evaluationInterval) {
            this.stopAutoEvaluation();
            this.startAutoEvaluation();
        }
        logger_1.logger.info('Auto-scaling configuration updated', { config: this.config });
    }
    updateThreshold(metricType, updates) {
        const index = this.config.thresholds.findIndex(t => t.metricType === metricType);
        if (index >= 0) {
            this.config.thresholds[index] = { ...this.config.thresholds[index], ...updates };
            logger_1.logger.info('Scaling threshold updated', { metricType, updates });
        }
    }
    getStats() {
        const scaleUpEvents = this.scalingEvents.filter(e => e.direction === ScalingDirection.UP);
        const scaleDownEvents = this.scalingEvents.filter(e => e.direction === ScalingDirection.DOWN);
        const lastScaleUp = scaleUpEvents.length > 0 ? scaleUpEvents[scaleUpEvents.length - 1].triggeredAt : undefined;
        const lastScaleDown = scaleDownEvents.length > 0
            ? scaleDownEvents[scaleDownEvents.length - 1].triggeredAt
            : undefined;
        let averageInstanceCount = this.config.currentInstances;
        if (this.instanceCountHistory.length > 0) {
            averageInstanceCount =
                this.instanceCountHistory.reduce((sum, h) => sum + h.count, 0) /
                    this.instanceCountHistory.length;
        }
        let status = ScalingTriggerStatus.ACTIVE;
        if (!this.config.enabled) {
            status = ScalingTriggerStatus.DISABLED;
        }
        else if (this.isInCooldown()) {
            status = ScalingTriggerStatus.COOLING_DOWN;
        }
        return {
            totalScaleUpEvents: scaleUpEvents.length,
            totalScaleDownEvents: scaleDownEvents.length,
            lastScaleUpAt: lastScaleUp,
            lastScaleDownAt: lastScaleDown,
            currentInstances: this.config.currentInstances,
            minInstances: this.config.minInstances,
            maxInstances: this.config.maxInstances,
            averageInstanceCount: Math.round(averageInstanceCount * 100) / 100,
            cooldownRemainingSec: this.getCooldownRemaining(),
            status,
            recentEvents: this.scalingEvents.slice(-10),
        };
    }
    getMetricHistory(type, durationMs) {
        const history = this.metricHistory.get(type) || [];
        if (!durationMs) {
            return [...history];
        }
        const now = Date.now();
        return history.filter(m => now - m.timestamp.getTime() <= durationMs);
    }
    getAllMetrics() {
        return new Map(this.metricHistory);
    }
    getScalingEvents(limit) {
        const events = [...this.scalingEvents].reverse();
        return limit ? events.slice(0, limit) : events;
    }
    triggerManualScale(direction, reason) {
        if (!this.config.enabled) {
            return null;
        }
        if (this.isInCooldown()) {
            throw new Error('Cannot trigger scaling during cooldown period');
        }
        const currentInstances = this.config.currentInstances;
        let targetInstances;
        if (direction === ScalingDirection.UP) {
            if (currentInstances >= this.config.maxInstances) {
                throw new Error('Already at maximum instances');
            }
            targetInstances = currentInstances + 1;
        }
        else if (direction === ScalingDirection.DOWN) {
            if (currentInstances <= this.config.minInstances) {
                throw new Error('Already at minimum instances');
            }
            targetInstances = currentInstances - 1;
        }
        else {
            return null;
        }
        return this.recordScalingEvent(direction, `Manual trigger: ${reason}`, ScalingMetricType.CUSTOM, 0, 0, currentInstances, targetInstances);
    }
    clearMetrics() {
        this.metricHistory.clear();
        this.scalingEvents = [];
        this.instanceCountHistory = [];
        this.lastScaleTime = null;
    }
    setCurrentInstances(count) {
        this.config.currentInstances = count;
        this.instanceCountHistory.push({
            count,
            timestamp: new Date(),
        });
    }
}
exports.AutoScalingTriggerService = AutoScalingTriggerService;
exports.autoScalingTriggerService = AutoScalingTriggerService.getInstance();
//# sourceMappingURL=AutoScalingTriggerService.js.map