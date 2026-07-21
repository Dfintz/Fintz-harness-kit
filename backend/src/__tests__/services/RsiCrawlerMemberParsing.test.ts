/**
 * RsiCrawlerService — Member HTML Parsing Tests
 *
 * Validates that crawlOrganizationMembers correctly parses the RSI org
 * members page HTML. Uses a realistic HTML snippet matching the current
 * RSI website structure (as of 2026-04).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { RsiCrawlerService } from '../../services/external/RsiCrawlerService';

/** Realistic RSI org members page HTML snippet */
const RSI_MEMBERS_HTML = `
<html>
<body>
<div class="listing-members clearfix">
  <ul class="members-data" class="clearfix">
    <li class="member-item js-member-item  org-visibility-V" data-org-sid="FRINAUTS" data-org-name="Fringenauts Inc.">
      <a class="membercard js-edit-member" href="/citizens/Gremwolf">
        <span class="thumb">
          <img src="https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg" />
        </span>
        <span class="right">
          <span class="abs-overlay trans-03s roles">
            <span class="title">Affiliate</span>
          </span>
          <span class="trans-03s frontinfo">
            <span class="name-wrap">
              <span class="trans-03s name data4">Gremwolf</span>
              <span class="trans-03s nick data2">Gremwolf</span>
            </span>
            <span class="ranking-stars data2">
              <span class="stars" style="width: 0%;"></span>
            </span>
            <span class="rank">External Partner</span>
          </span>
        </span>
      </a>
    </li>

    <li class="member-item js-member-item  org-visibility-V" data-org-sid="FRINAUTS" data-org-name="Fringenauts Inc.">
      <a class="membercard js-edit-member" href="/citizens/Fintz">
        <span class="thumb">
          <img src="https://cdn.robertsspaceindustries.com/media/abc123.jpg" />
        </span>
        <span class="right">
          <span class="abs-overlay trans-03s roles">
            <span class="title">Roles</span>
            <span class="role">CEO</span>
          </span>
          <span class="trans-03s frontinfo">
            <span class="name-wrap">
              <span class="trans-03s name data4">Fintz</span>
              <span class="trans-03s nick data2">Fintz</span>
            </span>
            <span class="ranking-stars data2">
              <span class="stars" style="width: 100%;"></span>
            </span>
            <span class="rank">Board Member</span>
          </span>
        </span>
      </a>
    </li>

    <li class="member-item js-member-item  org-visibility-V" data-org-sid="FRINAUTS" data-org-name="Fringenauts Inc.">
      <a class="membercard js-edit-member" href="/citizens/LOK35">
        <span class="thumb">
          <img src="https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg" />
        </span>
        <span class="right">
          <span class="abs-overlay trans-03s roles">
            <span class="title">Affiliate</span>
          </span>
          <span class="trans-03s frontinfo">
            <span class="name-wrap">
              <span class="trans-03s name data4">LOK</span>
              <span class="trans-03s nick data2">LOK35</span>
            </span>
            <span class="ranking-stars data2">
              <span class="stars" style="width: 60%;"></span>
            </span>
            <span class="rank">Senior</span>
          </span>
        </span>
      </a>
    </li>
  </ul>
</div>
</body>
</html>
`;

describe('RsiCrawlerService — Member HTML Parsing', () => {
  let service: RsiCrawlerService;
  let mockAxiosGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RsiCrawlerService();

    // Access the private axios instance and mock its get method
    mockAxiosGet = (service as any).axiosInstance.get = jest.fn();

    // Bypass circuit breaker & rate limiter
    (service as any).circuitState = 'closed';
    (service as any).failures = 0;
    (service as any).requestTimestamps = [];
  });

  it('should parse all 3 members from the HTML', async () => {
    mockAxiosGet.mockResolvedValue({ data: RSI_MEMBERS_HTML });

    const members = await service.crawlOrganizationMembers('FRINAUTS', 1);

    expect(members).toHaveLength(3);
  });

  it('should correctly extract handles from .nick element', async () => {
    mockAxiosGet.mockResolvedValue({ data: RSI_MEMBERS_HTML });

    const members = await service.crawlOrganizationMembers('FRINAUTS', 1);

    expect(members[0].handle).toBe('Gremwolf');
    expect(members[1].handle).toBe('Fintz');
    expect(members[2].handle).toBe('LOK35');
  });

  it('should correctly extract display names', async () => {
    mockAxiosGet.mockResolvedValue({ data: RSI_MEMBERS_HTML });

    const members = await service.crawlOrganizationMembers('FRINAUTS', 1);

    expect(members[0].displayName).toBe('Gremwolf');
    expect(members[1].displayName).toBe('Fintz');
    expect(members[2].displayName).toBe('LOK');
  });

  it('should correctly extract ranks', async () => {
    mockAxiosGet.mockResolvedValue({ data: RSI_MEMBERS_HTML });

    const members = await service.crawlOrganizationMembers('FRINAUTS', 1);

    expect(members[0].rank).toBe('External Partner');
    expect(members[1].rank).toBe('Board Member');
    expect(members[2].rank).toBe('Senior');
  });

  it('should correctly parse star levels from width percentage', async () => {
    mockAxiosGet.mockResolvedValue({ data: RSI_MEMBERS_HTML });

    const members = await service.crawlOrganizationMembers('FRINAUTS', 1);

    expect(members[0].stars).toBe(0); // width: 0%
    expect(members[1].stars).toBe(5); // width: 100%
    expect(members[2].stars).toBe(3); // width: 60%
  });

  it('should correctly detect affiliate status from .roles .title', async () => {
    mockAxiosGet.mockResolvedValue({ data: RSI_MEMBERS_HTML });

    const members = await service.crawlOrganizationMembers('FRINAUTS', 1);

    // Gremwolf: Affiliate
    expect(members[0].isAffiliate).toBe(true);
    expect(members[0].isMain).toBe(false);

    // Fintz: Roles (not affiliate)
    expect(members[1].isAffiliate).toBe(false);
    expect(members[1].isMain).toBe(true);

    // LOK35: Affiliate
    expect(members[2].isAffiliate).toBe(true);
    expect(members[2].isMain).toBe(false);
  });

  it('should extract avatar URLs from .thumb img', async () => {
    mockAxiosGet.mockResolvedValue({ data: RSI_MEMBERS_HTML });

    const members = await service.crawlOrganizationMembers('FRINAUTS', 1);

    expect(members[0].avatar).toContain('avatar_default_big.jpg');
    expect(members[1].avatar).toContain('abc123.jpg');
  });

  it('should fallback to parsing href if .nick is missing', async () => {
    const htmlWithoutNick = `
    <html><body>
      <li class="member-item">
        <a class="membercard" href="/citizens/TestUser">
          <span class="right">
            <span class="roles"><span class="title"></span></span>
            <span class="frontinfo">
              <span class="name-wrap">
                <span class="name">Test Display</span>
              </span>
              <span class="ranking-stars"><span class="stars" style="width: 40%;"></span></span>
              <span class="rank">Member</span>
            </span>
          </span>
        </a>
      </li>
    </body></html>`;

    mockAxiosGet.mockResolvedValue({ data: htmlWithoutNick });

    const members = await service.crawlOrganizationMembers('TEST', 1);

    expect(members).toHaveLength(1);
    expect(members[0].handle).toBe('TestUser');
    expect(members[0].stars).toBe(2); // 40% → 2 stars
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
