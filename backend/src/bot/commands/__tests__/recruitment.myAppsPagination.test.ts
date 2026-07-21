// Tests for the recruitment "Your Applications" pagination (C2 / CMD-03).
//
// The my-applications list was an untyped `response.data.data || []` shown via
// `.slice(0, 10)`. This slice typed the wire shape (MyApplicationView), extracted
// a pure `buildMyApplicationsView`, and added page navigation. The pure view is
// tested directly; the page-button route is tested through `handleButton` with a
// mocked API client.

const mockGet = jest.fn();

jest.mock('../../utils/botApiClient', () => ({
  botApiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettingsByGuildId: jest.fn().mockResolvedValue([]),
  },
}));

import { buildMyApplicationsView } from '../../embeds/recruitmentEmbeds';
import { recruitment } from '../recruitment';

interface RawApp {
  status: string;
  recruitmentTitle?: string;
  appliedAt: string;
  interviewScheduledAt?: string;
}

function makeApp(i: number): RawApp {
  return {
    status: 'pending',
    recruitmentTitle: `Position ${i}`,
    appliedAt: '2026-06-14T00:00:00.000Z',
  };
}

function makeApps(n: number): RawApp[] {
  return Array.from({ length: n }, (_, i) => makeApp(i + 1));
}

function customIds(
  components: Array<{ components: Array<{ toJSON: () => { custom_id?: string } }> }>
): string[] {
  return components.flatMap(row => row.components.map(c => c.toJSON().custom_id ?? ''));
}

describe('buildMyApplicationsView pagination', () => {
  it('renders the first page with nav controls across multiple pages', () => {
    const { embeds, components } = buildMyApplicationsView(makeApps(25), 0);

    // 10 per page → 25 apps = 3 pages, first page shows 10 fields.
    expect(embeds[0].data.fields).toHaveLength(10);
    expect(embeds[0].data.footer?.text).toBe('Page 1 of 3 • 25 applications');

    // Prev targets page-1 (-1, disabled), Next targets page+1.
    expect(customIds(components as never)).toEqual([
      'recruitment_myappspage_-1',
      'pagination_indicator_noop',
      'recruitment_myappspage_1',
    ]);
  });

  it('omits the nav row and footer when everything fits on one page', () => {
    const { embeds, components } = buildMyApplicationsView(makeApps(4), 0);
    expect(embeds[0].data.fields).toHaveLength(4);
    expect(embeds[0].data.footer).toBeUndefined();
    expect(components).toHaveLength(0);
  });

  it('clamps a stale/out-of-range page to the last page', () => {
    const { embeds, components } = buildMyApplicationsView(makeApps(25), 9);
    expect(embeds[0].data.fields).toHaveLength(5); // page 3 holds 5
    expect(embeds[0].data.footer?.text).toBe('Page 3 of 3 • 25 applications');
    expect(customIds(components as never)).toEqual([
      'recruitment_myappspage_1',
      'pagination_indicator_noop',
      'recruitment_myappspage_3',
    ]);
  });
});

describe('recruitment my-applications page button routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createPageInteraction(customId: string) {
    return {
      customId,
      user: { id: 'discord-user-1', username: 'Applicant' },
      guildId: 'guild-1',
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('re-fetches and edits the list in place when paging', async () => {
    mockGet.mockResolvedValue({ data: { data: makeApps(25) } });
    const interaction = createPageInteraction('recruitment_myappspage_1');

    await recruitment.handleButton?.(interaction as never);

    // Defers the update (HTTP re-fetch can exceed the 3s deadline), then edits.
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/v2/recruitment/my-applications'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Discord-User-Id': 'discord-user-1' }),
      })
    );

    const payload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ data: { footer?: { text?: string } } }>;
    };
    expect(payload.embeds[0].data.footer?.text).toBe('Page 2 of 3 • 25 applications');
  });

  it('ignores a negative page (disabled Prev) without fetching', async () => {
    const interaction = createPageInteraction('recruitment_myappspage_-1');

    await recruitment.handleButton?.(interaction as never);

    expect(interaction.deferUpdate).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
