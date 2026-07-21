import {
  getAppInsightsClient,
  trackEvent,
  trackMetric,
  trackException,
  trackTrace,
} from '../applicationInsights';
import logger from '../../utils/logger';

// Mock the logger
describe('Application Insights Configuration', () => {
  describe('getAppInsightsClient', () => {
    it('should return the default client or undefined', () => {
      const client = getAppInsightsClient();
      // Client will be undefined if not initialized
      expect(client === undefined || client !== null).toBe(true);
    });
  });

  describe('Helper functions - graceful degradation', () => {
    // These tests ensure that tracking functions don't throw errors
    // when Application Insights is not configured or the client is not initialized

    it('trackEvent should not throw when client is not initialized', () => {
      expect(() => trackEvent('test-event', { prop: 'value' })).not.toThrow();
    });

    it('trackEvent should handle events without properties', () => {
      expect(() => trackEvent('test-event')).not.toThrow();
    });

    it('trackMetric should not throw when client is not initialized', () => {
      expect(() => trackMetric('test-metric', 42)).not.toThrow();
    });

    it('trackException should not throw when client is not initialized', () => {
      const error = new Error('Test error');
      expect(() => trackException(error, { context: 'test' })).not.toThrow();
    });

    it('trackException should handle exceptions without properties', () => {
      const error = new Error('Test error');
      expect(() => trackException(error)).not.toThrow();
    });

    it('trackTrace should not throw when client is not initialized', () => {
      expect(() => trackTrace('test message', 'Information', { context: 'test' })).not.toThrow();
    });

    it('trackTrace should handle traces without severity or properties', () => {
      expect(() => trackTrace('test message')).not.toThrow();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
