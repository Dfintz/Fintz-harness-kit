const mockSubscribe = jest.fn().mockResolvedValue(undefined);
const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn();
const mockOn = jest.fn();
const mockPublish = jest.fn().mockResolvedValue(1);
const mockRefreshNow = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    disconnect: mockDisconnect,
    on: mockOn,
    publish: mockPublish,
  }));
});

jest.mock('../../utils/redis', () => ({
  attachRedisErrorObserver: jest.fn(),
  getRedisConfigAsync: jest.fn().mockResolvedValue({
    host: 'localhost',
    port: 6379,
  }),
  sanitizeRedisErrorForLogging: jest.fn(String),
  setupEntraTokenRefreshForClient: jest.fn().mockResolvedValue({
    stop: mockStop,
    refreshNow: mockRefreshNow,
  }),
}));

import { initializeDomainEventBridge, shutdownDomainEventBridge } from './DomainEventBridge';
import { domainEvents } from './DomainEventBus';

describe('DomainEventBridge lifecycle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await shutdownDomainEventBridge();
  });

  afterAll(async () => {
    await shutdownDomainEventBridge();
  });

  it('removes bridged listeners on shutdown and avoids duplicate listeners after reinit', async () => {
    const eventName = 'activity:created' as const;
    const baseline = domainEvents.listenerCount(eventName);

    await initializeDomainEventBridge();
    expect(domainEvents.listenerCount(eventName)).toBe(baseline + 1);

    await shutdownDomainEventBridge();
    expect(domainEvents.listenerCount(eventName)).toBe(baseline);

    await initializeDomainEventBridge();
    expect(domainEvents.listenerCount(eventName)).toBe(baseline + 1);
    expect(mockSubscribe).toHaveBeenCalled();

    await shutdownDomainEventBridge();
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockDisconnect.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

