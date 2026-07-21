/**
 * DiscordAuditLogService shutdown lifecycle tests
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import type { Client } from 'discord.js';

import { DiscordAuditLogService } from '../../../services/discord/DiscordAuditLogService';

describe('DiscordAuditLogService', () => {
  let service: DiscordAuditLogService;
  let mockClient: {
    on: jest.Mock;
    off: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (DiscordAuditLogService as unknown as { instance: undefined }).instance = undefined;
    service = DiscordAuditLogService.getInstance();

    mockClient = {
      on: jest.fn().mockReturnThis(),
      off: jest.fn().mockReturnThis(),
    };
  });

  it('should register listeners on initialize and remove the same listeners on shutdown', () => {
    service.initialize(mockClient as unknown as Client);

    expect(mockClient.on).toHaveBeenCalledTimes(5);

    const onCalls = mockClient.on.mock.calls as Array<[string, (...args: unknown[]) => void]>;

    service.shutdown();

    expect(mockClient.off).toHaveBeenCalledTimes(5);
    for (const [event, handler] of onCalls) {
      expect(mockClient.off).toHaveBeenCalledWith(event, handler);
    }

    const internal = service as unknown as { client: unknown };
    expect(internal.client).toBeNull();
  });

  it('should be safe to call shutdown before initialize', () => {
    expect(() => service.shutdown()).not.toThrow();
    expect(mockClient.off).not.toHaveBeenCalled();
  });
});
