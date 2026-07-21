// recruitment.ts pulls in botApiClient + discordSettingsService at module load;
// mock both so importing the command never touches the network or database. The
// selector under test is pure, but the import must stay side-effect-free.
jest.mock('../../utils/botApiClient', () => ({
  botApiClient: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettingsByGuildId: jest.fn().mockResolvedValue([]),
  },
}));

import { selectLatestRecruitment, type RecruitmentSummary } from '../recruitment';

/** Build a recruitment summary with sensible defaults for selection tests. */
function rec(overrides: Partial<RecruitmentSummary> & { id: string }): RecruitmentSummary {
  return {
    title: `Posting ${overrides.id}`,
    ...overrides,
  };
}

describe('selectLatestRecruitment (BOT-06)', () => {
  it('returns null for an empty list', () => {
    expect(selectLatestRecruitment([])).toBeNull();
  });

  it('returns the sole posting regardless of status', () => {
    const only = rec({ id: 'a', status: 'paused', createdAt: '2026-06-01T00:00:00Z' });
    expect(selectLatestRecruitment([only])).toBe(only);
  });

  it('prefers an open posting over a more recently updated closed one', () => {
    const open = rec({ id: 'open', status: 'open', updatedAt: '2026-06-01T00:00:00Z' });
    const closedNewer = rec({ id: 'closed', status: 'closed', updatedAt: '2026-06-10T00:00:00Z' });

    // Priority (open) must beat recency (the closed posting is newer).
    expect(selectLatestRecruitment([closedNewer, open])).toBe(open);
  });

  it('prefers closed over paused when no open posting exists', () => {
    const paused = rec({ id: 'paused', status: 'paused', updatedAt: '2026-06-10T00:00:00Z' });
    const closed = rec({ id: 'closed', status: 'closed', updatedAt: '2026-06-01T00:00:00Z' });

    expect(selectLatestRecruitment([paused, closed])).toBe(closed);
  });

  it('within the open group, the most recently updated posting wins', () => {
    const older = rec({ id: 'older', status: 'open', updatedAt: '2026-06-01T00:00:00Z' });
    const newer = rec({ id: 'newer', status: 'open', updatedAt: '2026-06-09T00:00:00Z' });

    expect(selectLatestRecruitment([older, newer])).toBe(newer);
    // Order-independent: server list ordering must not change the result.
    expect(selectLatestRecruitment([newer, older])).toBe(newer);
  });

  it('falls back to createdAt when updatedAt is absent', () => {
    const older = rec({ id: 'older', status: 'closed', createdAt: '2026-06-01T00:00:00Z' });
    const newer = rec({ id: 'newer', status: 'closed', createdAt: '2026-06-08T00:00:00Z' });

    expect(selectLatestRecruitment([older, newer])).toBe(newer);
  });

  it('treats a missing status as the closed priority (defensive)', () => {
    const open = rec({ id: 'open', status: 'open', updatedAt: '2026-06-01T00:00:00Z' });
    const unknown = rec({ id: 'unknown', updatedAt: '2026-06-10T00:00:00Z' });

    // Unknown/missing status is deprioritised below open, so open still wins.
    expect(selectLatestRecruitment([unknown, open])).toBe(open);
  });

  it('does not throw on unparseable timestamps and still returns a candidate', () => {
    const bad = rec({ id: 'bad', status: 'closed', updatedAt: 'not-a-date' });
    const good = rec({ id: 'good', status: 'closed', updatedAt: '2026-06-05T00:00:00Z' });

    expect(selectLatestRecruitment([bad, good])).toBe(good);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
