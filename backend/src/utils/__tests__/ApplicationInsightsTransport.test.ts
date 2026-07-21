import * as appInsights from 'applicationinsights';

import { ApplicationInsightsTransport } from '../ApplicationInsightsTransport';

type MockClient = {
  trackTrace: jest.Mock;
  trackException: jest.Mock;
  flush: jest.Mock;
};

jest.mock('applicationinsights', () => ({
  defaultClient: {
    trackTrace: jest.fn(),
    trackException: jest.fn(),
    flush: jest.fn(),
  },
}));

describe('ApplicationInsightsTransport', () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = appInsights.defaultClient as unknown as MockClient;
    mockClient.trackTrace.mockClear();
    mockClient.trackException.mockClear();
    mockClient.flush.mockClear();
  });

  it('redacts Authorization and api_key from trace metadata', done => {
    const transport = new ApplicationInsightsTransport();

    transport.log(
      {
        level: 'info',
        message: 'Test trace',
        Authorization: 'Bearer leaked-token',
        api_key: 'leaked-api-key',
        nested: {
          Authorization: 'Bearer nested-token',
          keep: 'ok',
        },
      },
      () => {
        expect(mockClient.trackTrace).toHaveBeenCalledTimes(1);

        const payload = mockClient.trackTrace.mock.calls[0]?.[0] as {
          properties: Record<string, string>;
        };

        expect(payload.properties.Authorization).toBe('[REDACTED]');
        expect(payload.properties.api_key).toBe('[REDACTED]');
        expect(payload.properties.nested).toContain('"Authorization":"[REDACTED]"');
        expect(payload.properties.nested).toContain('"keep":"ok"');
        expect(payload.properties.nested).not.toContain('nested-token');

        done();
      }
    );
  });

  it('tracks as trace for non-error log level with sanitized metadata', done => {
    const transport = new ApplicationInsightsTransport();

    transport.log(
      {
        level: 'warn',
        message: 'Warning trace',
        statusCode: 500,
        requestPath: '/api/v2/test',
      },
      () => {
        expect(mockClient.trackTrace).toHaveBeenCalledTimes(1);

        const payload = mockClient.trackTrace.mock.calls[0]?.[0] as {
          properties: Record<string, string>;
        };

        expect(payload.properties.statusCode).toBe('500');
        expect(payload.properties.requestPath).toBe('/api/v2/test');
        done();
      }
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
