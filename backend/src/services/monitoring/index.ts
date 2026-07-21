/**
 * Monitoring Domain Services
 * Health checks, metrics, performance monitoring, integration status tracking,
 * distributed tracing, and auto-scaling triggers
 */

export {
  PerformanceHealthStatus,
  performanceMonitoringService,
  PerformanceMonitoringService,
} from './PerformanceMonitoringService';
export type { PerformanceReport, PerformanceThresholds } from './PerformanceMonitoringService';

export { queryAnalyzerService, QueryAnalyzerService } from './QueryAnalyzerService';
export type {
  IndexRecommendation,
  QueryMetrics,
  QueryStats,
  SlowQueryAnalysis,
} from './QueryAnalyzerService';

export {
  IntegrationStatus,
  IntegrationStatusService,
  integrationStatusService,
} from './IntegrationStatusService';
export type { IntegrationHealth, SystemHealthSummary } from './IntegrationStatusService';

// Distributed Tracing
export {
  DistributedTracingService,
  distributedTracingService,
  SpanKind,
  SpanStatus,
} from './DistributedTracingService';
export type {
  ActiveSpan,
  CompletedSpan,
  SamplingConfig,
  SpanAttributes,
  SpanEvent,
  TraceContext,
  TraceFilter,
  TraceSummary,
  TracingStats,
} from './DistributedTracingService';

// Auto-Scaling Triggers
export {
  AutoScalingTriggerService,
  autoScalingTriggerService,
  ScalingDirection,
  ScalingMetricType,
  ScalingTriggerStatus,
} from './AutoScalingTriggerService';
export type {
  AutoScalingConfig,
  MetricValue,
  ScalingEvent,
  ScalingRecommendation,
  ScalingStats,
  ScalingThreshold,
} from './AutoScalingTriggerService';

// Realtime Resilience Diagnostics
export {
  RealtimeResilienceDiagnosticsService,
  realtimeResilienceDiagnosticsService,
} from './RealtimeResilienceDiagnosticsService';

