/**
 * IntegrationStatusService Tests
 *
 * Tests for integration health monitoring:
 * - System health aggregation
 * - Individual integration health checks
 * - Overall status determination
 * - Cache behavior
 * - Force refresh
 * - Database, Redis, RSI API, Discord, Azure health checks
 */

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    getRepository: jest.fn(),
  },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockCircuitBreakerService = {
  getState: jest.fn().mockReturnValue(null),
  getStats: jest.fn().mockReturnValue(null),
};

jest.mock('../../../services/resilience/CircuitBreakerService', () => ({
  circuitBreakerService: mockCircuitBreakerService,
}));

const mockRedisCache = {
  getStatus: jest.fn().mockReturnValue({
    connected: true,
    enabled: true,
  }),
  getStats: jest.fn().mockReturnValue({
    hitRate: 0.95,
    hits: 1000,
    misses: 50,
  }),
};

jest.mock('../../../utils/redis', () => ({
  cache: mockRedisCache,
}));

import {
  IntegrationStatus,
  IntegrationStatusService,
} from '../../../services/monitoring/IntegrationStatusService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a fresh instance by resetting singleton state.
 * IntegrationStatusService uses a private constructor + singleton,
 * so we access via getInstance() and reset the cache manually.
 */
function getFreshService(): IntegrationStatusService {
  // Access the singleton
  const svc = IntegrationStatusService.getInstance();
  // Force cache expiry so every call re-checks integrations
  (svc as any).lastCacheUpdate = new Date(0);
  (svc as any).healthCache = new Map();
  return svc;
}

describe('IntegrationStatusService', () => {
  let service: IntegrationStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env vars
    delete process.env.REDIS_URL;
    delete process.env.REDIS_CONNECTION_STRING;
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_KEY_VAULT_URL;

    // Mock process.memoryUsage to return healthy state (prevent Memory integration from being DEGRADED)
    // This is necessary for full suite runs where Jest may consume significant heap memory
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024, // 100 MB RSS
      heapTotal: 100 * 1024 * 1024, // 100 MB total
      heapUsed: 40 * 1024 * 1024, // 40 MB used = 40% (below 80% threshold)
      external: 0,
      arrayBuffers: 0,
    });

    service = getFreshService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==================== SINGLETON ====================

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = IntegrationStatusService.getInstance();
      const instance2 = IntegrationStatusService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  // ==================== SYSTEM HEALTH ====================

  describe('getSystemHealth', () => {
    it('should return a system health summary with all integrations', async () => {
      const result = await service.getSystemHealth();

      expect(result).toBeDefined();
      expect(result.overallStatus).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.integrations).toBeInstanceOf(Array);
      expect(result.integrations.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBe(result.integrations.length);
    });

    it('should include database health check', async () => {
      const result = await service.getSystemHealth();

      const dbHealth = result.integrations.find(i => i.name === 'PostgreSQL Database');
      expect(dbHealth).toBeDefined();
      expect(dbHealth!.description).toBe('Primary data store');
    });

    it('should include Redis health check', async () => {
      const result = await service.getSystemHealth();

      const redisHealth = result.integrations.find(i => i.name === 'Redis Cache');
      expect(redisHealth).toBeDefined();
    });

    it('should include RSI API health check', async () => {
      const result = await service.getSystemHealth();

      const rsiHealth = result.integrations.find(i => i.name === 'RSI API');
      expect(rsiHealth).toBeDefined();
      expect(rsiHealth!.description).toBe('Star Citizen user verification');
    });

    it('should include UIF API health check', async () => {
      const result = await service.getSystemHealth();

      const uifHealth = result.integrations.find(i => i.name === 'UIF Trading API');
      expect(uifHealth).toBeDefined();
      expect(uifHealth!.description).toBe('Market prices and trading data');
    });

    it('should include Discord health check', async () => {
      const result = await service.getSystemHealth();

      const discordHealth = result.integrations.find(i => i.name === 'Discord Bot');
      expect(discordHealth).toBeDefined();
    });

    it('should include Azure services health check', async () => {
      const result = await service.getSystemHealth();

      const azureHealth = result.integrations.find(i => i.name === 'Azure Services');
      expect(azureHealth).toBeDefined();
    });

    it('should correctly sum integration status counts', async () => {
      const result = await service.getSystemHealth();

      const { healthy, degraded, unhealthy, unknown } = result.summary;
      expect(healthy + degraded + unhealthy + unknown).toBe(result.summary.total);
    });
  });

  // ==================== OVERALL STATUS DETERMINATION ====================

  describe('overall status logic', () => {
    it('should report UNHEALTHY when any integration is unhealthy', async () => {
      // Make database check throw an error → UNHEALTHY
      const { AppDataSource } = require('../../../config/database');
      AppDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.getSystemHealth();

      expect(result.overallStatus).toBe(IntegrationStatus.UNHEALTHY);
    });

    it('should report HEALTHY when database responds quickly', async () => {
      const { AppDataSource } = require('../../../config/database');
      AppDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
      AppDataSource.isInitialized = true;

      // Set all circuit breakers to CLOSED (healthy)
      mockCircuitBreakerService.getState.mockReturnValue('CLOSED');

      // Configure environment so Redis and Azure show as unknown/healthy
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;...';
      process.env.DISCORD_BOT_TOKEN = 'test-token';

      const result = await service.getSystemHealth();

      expect(result.overallStatus).toBe(IntegrationStatus.HEALTHY);
    });
  });

  // ==================== DATABASE HEALTH ====================

  describe('database health', () => {
    it('should report UNHEALTHY when database is not initialized', async () => {
      const { AppDataSource } = require('../../../config/database');
      AppDataSource.isInitialized = false;

      const result = await service.getSystemHealth();
      const dbHealth = result.integrations.find(i => i.name === 'PostgreSQL Database');

      expect(dbHealth!.status).toBe(IntegrationStatus.UNHEALTHY);
      expect(dbHealth!.errorMessage).toBe('Database not initialized');

      // Restore
      AppDataSource.isInitialized = true;
    });

    it('should report UNHEALTHY when query throws', async () => {
      const { AppDataSource } = require('../../../config/database');
      AppDataSource.isInitialized = true;
      AppDataSource.query.mockRejectedValueOnce(new Error('FATAL: database "scfm" does not exist'));

      const result = await service.getSystemHealth();
      const dbHealth = result.integrations.find(i => i.name === 'PostgreSQL Database');

      expect(dbHealth!.status).toBe(IntegrationStatus.UNHEALTHY);
    });

    it('should include response time when database is healthy', async () => {
      const { AppDataSource } = require('../../../config/database');
      AppDataSource.isInitialized = true;
      AppDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = await service.getSystemHealth();
      const dbHealth = result.integrations.find(i => i.name === 'PostgreSQL Database');

      expect(dbHealth!.responseTime).toBeDefined();
      expect(typeof dbHealth!.responseTime).toBe('number');
    });
  });

  // ==================== REDIS HEALTH ====================

  describe('Redis health', () => {
    it('should report UNKNOWN when Redis not configured', async () => {
      delete process.env.REDIS_URL;
      delete process.env.REDIS_CONNECTION_STRING;

      const result = await service.getSystemHealth();
      const redisHealth = result.integrations.find(i => i.name === 'Redis Cache');

      expect(redisHealth!.status).toBe(IntegrationStatus.UNKNOWN);
      expect(redisHealth!.errorMessage).toBe('Not configured');
    });

    it('should report HEALTHY when Redis is configured', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const result = await service.getSystemHealth();
      const redisHealth = result.integrations.find(i => i.name === 'Redis Cache');

      expect(redisHealth!.status).toBe(IntegrationStatus.HEALTHY);
    });
  });

  // ==================== RSI API HEALTH ====================

  describe('RSI API health', () => {
    it('should report HEALTHY when circuit breaker is CLOSED', async () => {
      mockCircuitBreakerService.getState.mockImplementation((name: string) => {
        if (name === 'rsi-api') return 'CLOSED';
        return null;
      });

      const result = await service.getSystemHealth();
      const rsiHealth = result.integrations.find(i => i.name === 'RSI API');

      expect(rsiHealth!.status).toBe(IntegrationStatus.HEALTHY);
    });

    it('should report DEGRADED when circuit breaker is HALF_OPEN', async () => {
      mockCircuitBreakerService.getState.mockImplementation((name: string) => {
        if (name === 'rsi-api') return 'HALF_OPEN';
        return null;
      });

      const result = await service.getSystemHealth();
      const rsiHealth = result.integrations.find(i => i.name === 'RSI API');

      expect(rsiHealth!.status).toBe(IntegrationStatus.DEGRADED);
    });

    it('should report UNHEALTHY when circuit breaker is OPEN', async () => {
      mockCircuitBreakerService.getState.mockImplementation((name: string) => {
        if (name === 'rsi-api') return 'OPEN';
        return null;
      });

      const result = await service.getSystemHealth();
      const rsiHealth = result.integrations.find(i => i.name === 'RSI API');

      expect(rsiHealth!.status).toBe(IntegrationStatus.UNHEALTHY);
      expect(rsiHealth!.errorMessage).toBe('Circuit breaker is open');
    });

    it('should include success rate metrics from circuit breaker stats', async () => {
      mockCircuitBreakerService.getState.mockImplementation((name: string) => {
        if (name === 'rsi-api') return 'CLOSED';
        return null;
      });
      mockCircuitBreakerService.getStats.mockImplementation((name: string) => {
        if (name === 'rsi-api') {
          return {
            stats: { fires: 100, successes: 95, failures: 5 },
          };
        }
        return null;
      });

      const result = await service.getSystemHealth();
      const rsiHealth = result.integrations.find(i => i.name === 'RSI API');

      expect(rsiHealth!.metrics).toBeDefined();
      expect(rsiHealth!.metrics!.successRate).toBe(95);
      expect(rsiHealth!.metrics!.requestCount).toBe(100);
    });
  });

  // ==================== DISCORD HEALTH ====================

  describe('Discord health', () => {
    it('should report UNKNOWN when Discord not configured', async () => {
      delete process.env.DISCORD_BOT_TOKEN;

      const result = await service.getSystemHealth();
      const discordHealth = result.integrations.find(i => i.name === 'Discord Bot');

      expect(discordHealth!.status).toBe(IntegrationStatus.UNKNOWN);
    });

    it('should report HEALTHY when Discord configured and circuit closed', async () => {
      process.env.DISCORD_BOT_TOKEN = 'bot-token-test';
      mockCircuitBreakerService.getState.mockImplementation((name: string) => {
        if (name === 'discord-api') return 'CLOSED';
        return null;
      });

      const result = await service.getSystemHealth();
      const discordHealth = result.integrations.find(i => i.name === 'Discord Bot');

      expect(discordHealth!.status).toBe(IntegrationStatus.HEALTHY);
    });

    it('should report UNHEALTHY when Discord circuit breaker is OPEN', async () => {
      process.env.DISCORD_BOT_TOKEN = 'bot-token-test';
      mockCircuitBreakerService.getState.mockImplementation((name: string) => {
        if (name === 'discord-api') return 'OPEN';
        return null;
      });

      const result = await service.getSystemHealth();
      const discordHealth = result.integrations.find(i => i.name === 'Discord Bot');

      expect(discordHealth!.status).toBe(IntegrationStatus.UNHEALTHY);
    });
  });

  // ==================== AZURE HEALTH ====================

  describe('Azure health', () => {
    it('should report UNKNOWN when Azure not configured', async () => {
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      delete process.env.AZURE_KEY_VAULT_URL;

      const result = await service.getSystemHealth();
      const azureHealth = result.integrations.find(i => i.name === 'Azure Services');

      expect(azureHealth!.status).toBe(IntegrationStatus.UNKNOWN);
    });

    it('should report HEALTHY when Azure Storage is configured', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING =
        'DefaultEndpointsProtocol=https;AccountName=test';

      const result = await service.getSystemHealth();
      const azureHealth = result.integrations.find(i => i.name === 'Azure Services');

      expect(azureHealth!.status).toBe(IntegrationStatus.HEALTHY);
    });

    it('should report HEALTHY when Azure Key Vault is configured', async () => {
      process.env.AZURE_KEY_VAULT_URL = 'https://myvault.vault.azure.net/';

      const result = await service.getSystemHealth();
      const azureHealth = result.integrations.find(i => i.name === 'Azure Services');

      expect(azureHealth!.status).toBe(IntegrationStatus.HEALTHY);
    });
  });

  // ==================== CACHE BEHAVIOR ====================

  describe('cache behavior', () => {
    it('should use cached results within TTL window', async () => {
      const { AppDataSource } = require('../../../config/database');

      // First call – populates cache
      await service.getSystemHealth();
      const firstCallCount = AppDataSource.query.mock.calls.length;

      // Second call within 30s – should use cache
      const result2 = await service.getSystemHealth();

      expect(AppDataSource.query.mock.calls.length).toBe(firstCallCount);
      expect(result2).toBeDefined();
    });
  });

  // ==================== GET INTEGRATION HEALTH ====================

  describe('getIntegrationHealth', () => {
    it('should return health for a specific integration', async () => {
      const result = await service.getIntegrationHealth('PostgreSQL Database');

      expect(result).toBeDefined();
      expect(result!.name).toBe('PostgreSQL Database');
    });

    it('should return null for unknown integration name', async () => {
      const result = await service.getIntegrationHealth('Nonexistent Service');

      expect(result).toBeNull();
    });
  });

  // ==================== FORCE REFRESH ====================

  describe('refreshHealth', () => {
    it('should invalidate cache and return fresh data', async () => {
      const { AppDataSource } = require('../../../config/database');

      // First call
      await service.getSystemHealth();
      const firstCallCount = AppDataSource.query.mock.calls.length;

      // Force refresh
      const result = await service.refreshHealth();

      // Should have made additional database query
      expect(AppDataSource.query.mock.calls.length).toBeGreaterThan(firstCallCount);
      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});
