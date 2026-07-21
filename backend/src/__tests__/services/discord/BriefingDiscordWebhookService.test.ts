import axios from 'axios';

import { Briefing, BriefingClassification, BriefingStatus } from '../../../models/Briefing';
import {
  BriefingDiscordWebhookService,
  buildBriefingDiscordEmbed,
} from '../../../services/discord/BriefingDiscordWebhookService';
import { BadRequestError, ForbiddenError, ServiceUnavailableError } from '../../../utils/apiErrors';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    isAxiosError: jest.fn(() => false),
  },
}));
jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: { SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS' },
  logAuditEvent: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockedAxios = axios as unknown as {
  post: jest.Mock;
  isAxiosError: jest.Mock;
};

const makeBriefing = (overrides: Partial<Briefing> = {}): Briefing =>
  ({
    id: 'briefing-1',
    title: 'Op Nightfall',
    creatorId: 'user-1',
    organizationId: 'org-1',
    classification: BriefingClassification.RESTRICTED,
    status: BriefingStatus.ACTIVE,
    elements: [],
    version: 1,
    createdAt: new Date('2026-06-22T00:00:00.000Z'),
    updatedAt: new Date('2026-06-22T00:00:00.000Z'),
    ...overrides,
  }) as Briefing;

const VALID_WEBHOOK = 'https://discord.com/api/webhooks/123/abcdef';

describe('buildBriefingDiscordEmbed', () => {
  it('builds an embed from the persisted briefing fields', () => {
    const embed = buildBriefingDiscordEmbed(
      makeBriefing({ classification: BriefingClassification.CONFIDENTIAL })
    );
    expect(embed.title).toBe('Briefing: Op Nightfall');
    expect(embed.color).toBe(0x00d4ff);
    expect(embed.fields).toEqual([
      { name: 'Classification', value: 'confidential', inline: true },
      { name: 'Status', value: 'active', inline: true },
      { name: 'Elements', value: '0', inline: true },
    ]);
    expect(embed.footer.text).toBe('Briefing ID: briefing-1');
    expect(embed.timestamp).toBe('2026-06-22T00:00:00.000Z');
  });

  it('uses the first non-empty text element as the description snippet', () => {
    const embed = buildBriefingDiscordEmbed(
      makeBriefing({
        elements: [
          { id: 'e1', type: 'marker', position: { x: 0, y: 0 }, data: {} },
          { id: 'e2', type: 'text', position: { x: 1, y: 1 }, data: { text: 'Hold the line.' } },
        ],
      })
    );
    expect(embed.description).toBe('Hold the line.');
  });

  it('falls back to a pluralized element count when there is no text element', () => {
    expect(buildBriefingDiscordEmbed(makeBriefing({ elements: [] })).description).toBe(
      '*0 elements*'
    );
    expect(
      buildBriefingDiscordEmbed(
        makeBriefing({
          elements: [{ id: 'e', type: 'marker', position: { x: 0, y: 0 }, data: {} }],
        })
      ).description
    ).toBe('*1 element*');
  });

  it('truncates an over-long title to the Discord limit', () => {
    const embed = buildBriefingDiscordEmbed(makeBriefing({ title: 'A'.repeat(400) }));
    expect(embed.title.length).toBeLessThanOrEqual(250);
  });
});

describe('BriefingDiscordWebhookService.postBriefingToWebhook', () => {
  let service: BriefingDiscordWebhookService;
  const ctx = { organizationId: 'org-1', userId: 'user-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.isAxiosError.mockReturnValue(false);
    service = new BriefingDiscordWebhookService();
  });

  it('posts the embed payload to the webhook URL with redirects disabled', async () => {
    mockedAxios.post.mockResolvedValue({ status: 204 });
    await service.postBriefingToWebhook(makeBriefing(), VALID_WEBHOOK, ctx);

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, payload, config] = mockedAxios.post.mock.calls[0]!;
    expect(url).toBe(VALID_WEBHOOK);
    expect((payload as { embeds: unknown[] }).embeds).toHaveLength(1);
    expect((config as { maxRedirects?: number }).maxRedirects).toBe(0);
  });

  it('rejects a non-Discord host with BadRequestError and does not post', async () => {
    await expect(
      service.postBriefingToWebhook(makeBriefing(), 'https://evil.com/api/webhooks/1/2', ctx)
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('rejects a non-webhook Discord path with BadRequestError and does not post', async () => {
    await expect(
      service.postBriefingToWebhook(makeBriefing(), 'https://discord.com/api/users/@me', ctx)
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('rejects an http (non-https) Discord URL with BadRequestError', async () => {
    await expect(
      service.postBriefingToWebhook(makeBriefing(), 'http://discord.com/api/webhooks/1/2', ctx)
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('blocks secret / top_secret classifications with ForbiddenError and does not post', async () => {
    await expect(
      service.postBriefingToWebhook(
        makeBriefing({ classification: BriefingClassification.TOP_SECRET }),
        VALID_WEBHOOK,
        ctx
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('maps a Discord delivery failure to ServiceUnavailableError', async () => {
    mockedAxios.post.mockRejectedValue(new Error('network'));
    await expect(
      service.postBriefingToWebhook(makeBriefing(), VALID_WEBHOOK, ctx)
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});
