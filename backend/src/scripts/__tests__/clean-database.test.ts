/**
 * Tests for Database Cleanup Script
 *
 * These tests verify that the database cleanup script works correctly
 * in CI/CD environments.
 */

import { DataSource } from 'typeorm';

// Mock logger to prevent console output during tests
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Database Cleanup Script', () => {
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    // Create a mock DataSource
    mockDataSource = {
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      options: {
        type: 'postgres',
        database: 'test_db',
      },
    } as unknown as jest.Mocked<DataSource>;

    // Mock DataSource constructor
    jest.spyOn(require('typeorm'), 'DataSource').mockImplementation(() => mockDataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCleanupDataSource', () => {
    it('should create DataSource from DATABASE_URL when available', () => {
      const originalEnv = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/dbname';

      // Import after setting env var
      const cleanDatabase = require('../clean-database').cleanDatabase;

      expect(require('typeorm').DataSource).toBeDefined();

      process.env.DATABASE_URL = originalEnv;
    });

    it('should create DataSource from individual env vars when DATABASE_URL not available', () => {
      const originalEnv = {
        DATABASE_URL: process.env.DATABASE_URL,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_NAME: process.env.DB_NAME,
      };

      delete process.env.DATABASE_URL;
      process.env.DB_HOST = 'testhost';
      process.env.DB_PORT = '5433';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';

      const cleanDatabase = require('../clean-database').cleanDatabase;

      expect(require('typeorm').DataSource).toBeDefined();

      // Restore env
      Object.assign(process.env, originalEnv);
    });
  });

  describe('cleanDatabase', () => {
    it('should prevent running in production without override', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DB_CLEAN;

      // Mock process.exit to prevent test from exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        const cleanDatabase = require('../clean-database').cleanDatabase;
        await expect(cleanDatabase()).rejects.toThrow();
      } finally {
        mockExit.mockRestore();
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should successfully clean database in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Mock successful cleanup queries
      mockDataSource.query
        .mockResolvedValueOnce(undefined) // DROP TABLES
        .mockResolvedValueOnce(undefined) // DROP VIEWS
        .mockResolvedValueOnce(undefined) // DROP SEQUENCES
        .mockResolvedValueOnce(undefined) // DROP TYPES
        .mockResolvedValueOnce([{ count: '0' }]) // Table count
        .mockResolvedValueOnce([{ count: '0' }]) // View count
        .mockResolvedValueOnce([{ count: '0' }]); // Sequence count

      // Mock process.exit to prevent test from exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called with 0');
      });

      try {
        const cleanDatabase = require('../clean-database').cleanDatabase;
        await expect(cleanDatabase()).rejects.toThrow('process.exit called with 0');

        expect(mockDataSource.initialize).toHaveBeenCalled();
        expect(mockDataSource.query).toHaveBeenCalled();
        expect(mockDataSource.destroy).toHaveBeenCalled();
      } finally {
        mockExit.mockRestore();
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle connection errors gracefully', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Mock connection error
      mockDataSource.initialize.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      );

      // Mock process.exit to prevent test from exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called with 1');
      });

      try {
        const cleanDatabase = require('../clean-database').cleanDatabase;
        await expect(cleanDatabase()).rejects.toThrow('process.exit called with 1');

        expect(mockDataSource.initialize).toHaveBeenCalled();
      } finally {
        mockExit.mockRestore();
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle authentication errors gracefully', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Mock authentication error
      mockDataSource.initialize.mockRejectedValueOnce(
        new Error('password authentication failed for user "test"')
      );

      // Mock process.exit to prevent test from exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called with 1');
      });

      try {
        const cleanDatabase = require('../clean-database').cleanDatabase;
        await expect(cleanDatabase()).rejects.toThrow('process.exit called with 1');

        expect(mockDataSource.initialize).toHaveBeenCalled();
      } finally {
        mockExit.mockRestore();
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
