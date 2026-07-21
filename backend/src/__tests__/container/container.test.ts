/**
 * Tests for the Dependency Injection Container
 */

import 'reflect-metadata';
import { container } from 'tsyringe';

import { 
  TOKENS, 
  initializeContainer, 
  getContainer, 
  resolve 
} from '../../container';

describe('Dependency Injection Container', () => {
  beforeEach(() => {
    // Clear container between tests
    container.clearInstances();
  });

  describe('initializeContainer', () => {
    it('should initialize the container and return it', () => {
      const result = initializeContainer();
      expect(result).toBeDefined();
      expect(result).toBe(container);
    });

    it('should register the logger', () => {
      initializeContainer();
      const logger = container.resolve(TOKENS.LOGGER);
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('getContainer', () => {
    it('should return the container instance', () => {
      const result = getContainer();
      expect(result).toBe(container);
    });
  });

  describe('resolve', () => {
    it('should resolve registered dependencies', () => {
      initializeContainer();
      const logger = resolve(TOKENS.LOGGER);
      expect(logger).toBeDefined();
    });
  });

  describe('TOKENS', () => {
    it('should have all required token definitions', () => {
      expect(TOKENS.DATA_SOURCE).toBe('DataSource');
      expect(TOKENS.LOGGER).toBe('Logger');
      expect(TOKENS.FLEET_REPOSITORY).toBe('FleetRepository');
      expect(TOKENS.USER_REPOSITORY).toBe('UserRepository');
      expect(TOKENS.ORGANIZATION_REPOSITORY).toBe('OrganizationRepository');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
