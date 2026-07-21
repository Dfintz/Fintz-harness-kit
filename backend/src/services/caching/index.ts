/**
 * Caching Domain Services
 * Redis and memory cache services with hit rate tracking and cache warming
 */

export { queryCacheService } from './QueryCacheService';

export { EnhancedCacheService, enhancedCacheService } from './EnhancedCacheService';
export type { CacheMetrics, CacheWarmingConfig } from './EnhancedCacheService';

export {
  CacheBackend,
  DistributedCacheService,
  createDistributedCache,
} from './DistributedCacheService';
export type { CacheStats, DistributedCacheConfig } from './DistributedCacheService';

