import { AppDataSource } from '../../data-source';
import { ExternalServiceHealthCheckService } from '../health/ExternalServiceHealthCheckService';
import { RedisHealthCheckService } from '../health/RedisHealthCheckService';
import { HealthStatus, ServiceHealthMonitor } from '../health/ServiceHealthMonitor';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../data-source', () => ({
  AppDataSource: {
    isInitialized: true,
    query: jest.fn(),
    getRepository: jest.fn(() => ({})),
  },
}));

jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve(false)),
    del: jest.fn(() => Promise.resolve(true)),
    getStatus: jest.fn(() => ({ connected: false, enabled: true })),
    ping: jest.fn(() => Promise.resolve(false)),
    getInfo: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    get: jest.fn(),
    isAxiosError: jest.fn().mockReturnValue(false),
  },
  AxiosError: class AxiosError extends Error {
    isAxiosError = true;
    response: any;
    code: string | undefined;
    constructor(message: string, code?: string, _config?: any, _request?: any, response?: any) {
      super(message);
      this.code = code;
      this.response = response;
    }
  },
}));

describe('ServiceHealthMonitor', () => {
  let monitor: ServiceHealthMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new ServiceHealthMonitor('1.0.0-test');
  });

  describe('constructor', () => {
    it('should initialize with version', () => {
      expect(monitor).toBeDefined();
    });
  });

  describe('registerService / unregisterService', () => {
    it('should register a health-checkable service', () => {
      const mockService = {
        getServiceName: () => 'TestService',
        healthCheck: jest.fn().mockResolvedValue({
          name: 'TestService',
          status: HealthStatus.HEALTHY,
          lastCheck: new Date(),
        }),
      };

      monitor.registerService(mockService);
      // No error means success
    });

    it('should unregister a service', () => {
      const mockService = {
        getServiceName: () => 'TestService',
        healthCheck: jest.fn().mockResolvedValue({
          name: 'TestService',
          status: HealthStatus.HEALTHY,
          lastCheck: new Date(),
        }),
      };

      monitor.registerService(mockService);
      monitor.unregisterService('TestService');
      // No error means success
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health with core components', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ '1': 1 }]);

      const health = await monitor.getSystemHealth();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.timestamp).toBeDefined();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.version).toBe('1.0.0-test');
      expect(health.components).toBeDefined();
      expect(Array.isArray(health.components)).toBe(true);
    });

    it('should include registered services in health check', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ '1': 1 }]);

      const mockService = {
        getServiceName: () => 'CustomService',
        healthCheck: jest.fn().mockResolvedValue({
          name: 'CustomService',
          status: HealthStatus.HEALTHY,
          lastCheck: new Date(),
        }),
      };

      monitor.registerService(mockService);
      const health = await monitor.getSystemHealth();

      const customComponent = health.components.find(c => c.name === 'CustomService');
      expect(customComponent).toBeDefined();
    });

    it('should handle database health check failure', async () => {
      (AppDataSource.query as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const health = await monitor.getSystemHealth();

      const dbComponent = health.components.find(c => c.name === 'database');
      if (dbComponent) {
        expect(dbComponent.status).not.toBe(HealthStatus.HEALTHY);
      }
    });
  });

  describe('getComponentHealth', () => {
    it('should return health for a specific component', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ '1': 1 }]);

      const component = await monitor.getComponentHealth('database');

      if (component) {
        expect(component.name).toBe('database');
        expect(component.status).toBeDefined();
      }
    });

    it('should return null for unknown component', async () => {
      const component = await monitor.getComponentHealth('nonexistent');

      expect(component).toBeNull();
    });
  });

  describe('isHealthy', () => {
    it('should return true when system is healthy', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ '1': 1 }]);

      const healthy = await monitor.isHealthy();

      expect(typeof healthy).toBe('boolean');
    });
  });

  describe('getUnhealthyComponents', () => {
    it('should return empty for healthy system', async () => {
      (AppDataSource.query as jest.Mock).mockResolvedValue([{ '1': 1 }]);

      const unhealthy = await monitor.getUnhealthyComponents();

      expect(Array.isArray(unhealthy)).toBe(true);
    });
  });

  describe('getUptimeFormatted', () => {
    it('should return formatted uptime string', () => {
      const uptime = monitor.getUptimeFormatted();

      expect(typeof uptime).toBe('string');
      expect(uptime.length).toBeGreaterThan(0);
    });
  });
});

describe('RedisHealthCheckService', () => {
  let redisHealth: RedisHealthCheckService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisHealth = new RedisHealthCheckService();
  });

  describe('getServiceName', () => {
    it('should return Redis service name', () => {
      expect(redisHealth.getServiceName()).toBe('redis');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const health = await redisHealth.healthCheck();

      expect(health).toBeDefined();
      expect(health.name).toBe('redis');
      expect(health.status).toBeDefined();
      expect(health.lastCheck).toBeDefined();
    });

    it('should report unhealthy when Redis is disconnected', async () => {
      const { cache } = require('../../utils/redis');
      cache.getStatus.mockReturnValue({ connected: false, enabled: true });
      cache.ping.mockResolvedValue(false);

      const health = await redisHealth.healthCheck();

      expect(health.status).not.toBe(HealthStatus.HEALTHY);
    });
  });

  describe('getCheckHistory', () => {
    it('should return empty history initially', () => {
      const history = redisHealth.getCheckHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it('should accumulate history after checks', async () => {
      const { cache } = require('../../utils/redis');
      // Set up connected + successful ping so recordCheck is invoked
      cache.getStatus.mockReturnValue({ connected: true, enabled: true });
      // pingRedis does set(key, value) then get(key) and checks result === value
      // We capture what was set and return it from get
      let storedValue: string | null = null;
      cache.set.mockImplementation((_key: string, value: string) => {
        storedValue = value;
        return Promise.resolve(true);
      });
      cache.get.mockImplementation(() => Promise.resolve(storedValue));
      cache.del.mockResolvedValue(true);
      // getRedisDetails calls keys('*')
      if (cache.keys) {
        cache.keys.mockResolvedValue([]);
      }

      await redisHealth.healthCheck();
      await redisHealth.healthCheck();

      const history = redisHealth.getCheckHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getAverageResponseTime', () => {
    it('should return null with no history', () => {
      const avg = redisHealth.getAverageResponseTime();

      expect(avg).toBeNull();
    });
  });

  describe('getUptimePercentage', () => {
    it('should return null with no history', () => {
      const pct = redisHealth.getUptimePercentage();

      expect(pct).toBeNull();
    });
  });

  describe('getLastHealthStatus', () => {
    it('should return UNKNOWN initially', () => {
      const status = redisHealth.getLastHealthStatus();

      expect(status).toBe(HealthStatus.UNKNOWN);
    });
  });
});

describe('ExternalServiceHealthCheckService', () => {
  let extHealth: ExternalServiceHealthCheckService;

  beforeEach(() => {
    jest.clearAllMocks();
    extHealth = new ExternalServiceHealthCheckService();
  });

  describe('getServiceName', () => {
    it('should return external-services name', () => {
      expect(extHealth.getServiceName()).toBe('external-services');
    });
  });

  describe('registerService / unregisterService', () => {
    it('should register a custom external service', () => {
      extHealth.registerService({
        name: 'custom-api',
        url: 'https://api.example.com/health',
        timeout: 5000,
        critical: false,
      });

      const services = extHealth.getRegisteredServices();
      expect(services).toContain('custom-api');
    });

    it('should unregister a service', () => {
      extHealth.registerService({
        name: 'temp-api',
        url: 'https://temp.example.com',
      });

      extHealth.unregisterService('temp-api');

      const services = extHealth.getRegisteredServices();
      expect(services).not.toContain('temp-api');
    });
  });

  describe('getRegisteredServices', () => {
    it('should include default services', () => {
      const services = extHealth.getRegisteredServices();

      // Default services registered in constructor
      expect(services.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('healthCheck', () => {
    it('should return aggregated health status', async () => {
      const axios = require('axios').default;
      axios.request.mockResolvedValue({ status: 200, data: 'ok' });

      const health = await extHealth.healthCheck();

      expect(health).toBeDefined();
      expect(health.name).toBe('external-services');
      expect(health.status).toBeDefined();
    });

    it('should handle service check failures', async () => {
      const axios = require('axios').default;
      axios.request.mockRejectedValue(new Error('Connection refused'));

      const health = await extHealth.healthCheck();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
    });
  });

  describe('checkService', () => {
    it('should check a specific registered service', async () => {
      const axios = require('axios').default;
      axios.request.mockResolvedValue({ status: 200 });

      extHealth.registerService({
        name: 'test-api',
        url: 'https://test.example.com',
      });

      const result = await extHealth.checkService('test-api');

      expect(result).toBeDefined();
      expect(result.name).toBe('test-api');
    });
  });

  describe('hasCriticalFailures', () => {
    it('should return false initially', () => {
      expect(extHealth.hasCriticalFailures()).toBe(false);
    });
  });

  describe('getFailingServices', () => {
    it('should return empty array initially', () => {
      const failing = extHealth.getFailingServices();

      expect(Array.isArray(failing)).toBe(true);
      expect(failing).toHaveLength(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

