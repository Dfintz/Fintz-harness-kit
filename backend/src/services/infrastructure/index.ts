/**
 * Infrastructure Domain Services - Facade
 *
 * Re-exports from focused sub-domains for backward compatibility.
 * Services are now organized into sub-domains:
 * - cloud/      - Azure blob storage, Key Vault services
 * - resilience/ - Circuit breakers, HTTP client management
 * - caching/    - Query cache, enhanced cache services
 * - monitoring/ - Performance monitoring, integration status, query analysis, distributed tracing, auto-scaling
 * - data/       - Data retention services
 * - secrets/    - Secrets management services
 */

// Cloud services (Azure infrastructure)
export { AzureBlobService } from '../cloud/AzureBlobService';
export type { ImageOptimizationOptions } from '../cloud/AzureBlobService';
export { KeyVaultService } from '../cloud/KeyVaultService';
export { MobileReleaseStorageService } from '../cloud/MobileReleaseStorageService';

// Secrets management
export { SecretsManagerService } from '../secrets/SecretsManagerService';

// Caching services
export { EnhancedCacheService, enhancedCacheService } from '../caching/EnhancedCacheService';
export type { CacheMetrics, CacheWarmingConfig } from '../caching/EnhancedCacheService';
export { queryCacheService } from '../caching/QueryCacheService';

// Monitoring and performance services
export { QueryAnalyzerService, queryAnalyzerService } from '../monitoring/QueryAnalyzerService';
export type {
  IndexRecommendation,
  QueryMetrics,
  QueryStats,
  SlowQueryAnalysis,
} from '../monitoring/QueryAnalyzerService';

export {
  PerformanceHealthStatus,
  PerformanceMonitoringService,
  performanceMonitoringService,
} from '../monitoring/PerformanceMonitoringService';
export type {
  PerformanceReport,
  PerformanceThresholds,
} from '../monitoring/PerformanceMonitoringService';

export {
  IntegrationStatus,
  IntegrationStatusService,
  integrationStatusService,
} from '../monitoring/IntegrationStatusService';
export type {
  IntegrationHealth,
  SystemHealthSummary,
} from '../monitoring/IntegrationStatusService';

// Distributed Tracing
export {
  DistributedTracingService,
  distributedTracingService,
  SpanKind,
  SpanStatus,
} from '../monitoring/DistributedTracingService';
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
} from '../monitoring/DistributedTracingService';

// Auto-Scaling Triggers
export {
  AutoScalingTriggerService,
  autoScalingTriggerService,
  ScalingDirection,
  ScalingMetricType,
  ScalingTriggerStatus,
} from '../monitoring/AutoScalingTriggerService';
export type {
  AutoScalingConfig,
  MetricValue,
  ScalingEvent,
  ScalingRecommendation,
  ScalingStats,
  ScalingThreshold,
} from '../monitoring/AutoScalingTriggerService';

// Data services
export {
  DATA_RETENTION_PERIODS,
  DataRetentionService,
  getDataRetentionService,
  scheduleDataRetentionCleanup,
} from '../data/DataRetentionService';
export type { RetentionCleanupResult } from '../data/DataRetentionService';

// Resilience services (circuit breakers, HTTP clients)
export {
  clientConfigs,
  HttpClientManager,
  httpClientManager,
} from '../resilience/HttpClientManager';
export type { HttpClientConfig } from '../resilience/HttpClientManager';

export { CircuitBreakerService, circuitBreakerService } from '../resilience/CircuitBreakerService';
export type {
  CircuitBreakerOptions,
  CircuitBreakerStats,
} from '../resilience/CircuitBreakerService';

// Note: FocusService has been moved to /services/user/ domain as it handles user/org gameplay preferences
export { FocusService } from '../user/FocusService';

