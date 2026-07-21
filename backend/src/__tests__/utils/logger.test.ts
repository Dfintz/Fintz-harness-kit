import { AzureBlobLogTransport } from '../../utils/AzureBlobLogTransport';
import logger from '../../utils/logger';

// Simple integration tests for logger functionality
describe('Logger Integration Tests', () => {
  describe('AzureBlobLogTransport', () => {
    it('should create transport with connection string', () => {
      const transport = new AzureBlobLogTransport({
        containerName: 'test-logs',
        connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;',
      });

      expect(transport).toBeDefined();
      expect(transport).toBeInstanceOf(AzureBlobLogTransport);
    });

    it('should create transport with storage account name', () => {
      const transport = new AzureBlobLogTransport({
        containerName: 'test-logs',
        storageAccountName: 'testaccount',
      });

      expect(transport).toBeDefined();
      expect(transport).toBeInstanceOf(AzureBlobLogTransport);
    });

    it('should have log method', () => {
      const transport = new AzureBlobLogTransport({
        containerName: 'test-logs',
        storageAccountName: 'testaccount',
      });

      expect(transport.log).toBeDefined();
      expect(typeof transport.log).toBe('function');
    });

    it('should have close method', () => {
      const transport = new AzureBlobLogTransport({
        containerName: 'test-logs',
        storageAccountName: 'testaccount',
      });

      expect(transport.close).toBeDefined();
      expect(typeof transport.close).toBe('function');
    });

    it('should handle log calls without throwing', done => {
      const transport = new AzureBlobLogTransport({
        containerName: 'test-logs',
        storageAccountName: 'testaccount',
      });

      const logInfo = {
        level: 'info',
        message: 'Test log message',
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        transport.log(logInfo, () => {
          done();
        });
      }).not.toThrow();
    });
  });

  describe('Logger Module', () => {
    it('should export a logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should be able to log messages without throwing', () => {
      expect(() => {
        logger.info('Test info message');
        logger.error('Test error message');
        logger.warn('Test warning message');
      }).not.toThrow();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
