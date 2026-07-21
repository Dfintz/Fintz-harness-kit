import { RsiCrawlerService } from '../../services/external/RsiCrawlerService';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
  })),
  isAxiosError: jest.fn(() => false),
}));

// Mock cheerio
jest.mock('cheerio', () => ({
  load: jest.fn(() => ({
    find: jest.fn(() => ({
      length: 0,
      first: jest.fn(() => ({
        text: jest.fn(() => ''),
        attr: jest.fn(() => undefined),
      })),
      eq: jest.fn(() => ({
        text: jest.fn(() => ''),
      })),
      each: jest.fn(),
    })),
  })),
}));

describe('RsiCrawlerService', () => {
  let service: RsiCrawlerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RsiCrawlerService();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(service).toBeDefined();
    });

    it('should have circuit breaker in closed state', () => {
      const status = service.getCircuitStatus();
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear cache without errors', () => {
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  describe('getCircuitStatus', () => {
    it('should return circuit status', () => {
      const status = service.getCircuitStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failures');
      expect(status).toHaveProperty('lastFailure');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
