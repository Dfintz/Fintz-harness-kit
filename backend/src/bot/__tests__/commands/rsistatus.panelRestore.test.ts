// Regression guard: restoring a persisted RSI status panel after a bot restart
// must distinguish a DEFINITIVE Discord "not found" (Unknown Channel 10003 /
// Unknown Message 10008) from a TRANSIENT failure (rate limit, network blip, a
// cold gateway cache during the post-restart startup burst). Only the former may
// permanently drop the panel from Redis. A transient hiccup previously deleted
// the panel forever, freezing the live panel until the operator recreated it.

jest.mock('../../BotClientManager', () => ({
  BotClientManager: { getInstance: jest.fn() },
}));

jest.mock('../../../utils/redis', () => ({
  redisClient: { getClient: jest.fn() },
}));

import { redisClient } from '../../../utils/redis';
import { BotClientManager } from '../../BotClientManager';
import { restorePanelEntry } from '../../commands/rsistatus';

const REDIS_PANELS_KEY = 'rsistatus:panels';
const guildId = 'guild-1';
const panelJson = JSON.stringify({ channelId: 'chan-1', messageId: 'msg-1' });

let hdel: jest.Mock;

function mockBotClient(channelsFetch: jest.Mock): void {
  (BotClientManager.getInstance as jest.Mock).mockReturnValue({
    getClient: () => ({ channels: { fetch: channelsFetch } }),
  });
}

function textChannelWith(messagesFetch: jest.Mock) {
  return { isTextBased: () => true, messages: { fetch: messagesFetch } };
}

beforeEach(() => {
  jest.clearAllMocks();
  hdel = jest.fn().mockResolvedValue(1);
  (redisClient.getClient as jest.Mock).mockReturnValue({ hdel });
});

describe('restorePanelEntry resilience (transient vs definitive)', () => {
  it('keeps the panel (no Redis delete) on a transient channel fetch error', async () => {
    mockBotClient(jest.fn().mockRejectedValue(new Error('network blip')));

    const result = await restorePanelEntry(guildId, panelJson);

    expect(result).toBe(true);
    expect(hdel).not.toHaveBeenCalled();
  });

  it('keeps the panel on a transient message fetch error', async () => {
    const channel = textChannelWith(jest.fn().mockRejectedValue(new Error('rate limited')));
    mockBotClient(jest.fn().mockResolvedValue(channel));

    const result = await restorePanelEntry(guildId, panelJson);

    expect(result).toBe(true);
    expect(hdel).not.toHaveBeenCalled();
  });

  it('drops the panel from Redis on an Unknown Channel (10003) error', async () => {
    mockBotClient(jest.fn().mockRejectedValue({ code: 10003 }));

    const result = await restorePanelEntry(guildId, panelJson);

    expect(result).toBe(false);
    expect(hdel).toHaveBeenCalledWith(REDIS_PANELS_KEY, guildId);
  });

  it('drops the panel from Redis on an Unknown Message (10008) error', async () => {
    const channel = textChannelWith(jest.fn().mockRejectedValue({ code: 10008 }));
    mockBotClient(jest.fn().mockResolvedValue(channel));

    const result = await restorePanelEntry(guildId, panelJson);

    expect(result).toBe(false);
    expect(hdel).toHaveBeenCalledWith(REDIS_PANELS_KEY, guildId);
  });

  it('restores the panel when the channel and message both resolve', async () => {
    const channel = textChannelWith(jest.fn().mockResolvedValue({ id: 'msg-1' }));
    mockBotClient(jest.fn().mockResolvedValue(channel));

    const result = await restorePanelEntry(guildId, panelJson);

    expect(result).toBe(true);
    expect(hdel).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
