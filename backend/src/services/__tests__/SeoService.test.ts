import { SeoService, SitemapEntry } from '../seo/SeoService';

// Mock dependencies
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../organization/OrganizationFederationService', () => ({
  OrganizationFederationService: {
    getInstance: jest.fn(),
  },
}));

jest.mock('../organization/PublicJobListingService', () => ({
  PublicJobListingService: jest.fn(),
}));

import { AppDataSource } from '../../data-source';
import { OrganizationFederationService } from '../organization/OrganizationFederationService';
import { PublicJobListingService } from '../organization/PublicJobListingService';

describe('SeoService', () => {
  let service: SeoService;
  let mockProfileRepo: any;
  let mockOrgRepo: any;
  let mockActivityRepo: any;
  let mockFederationService: any;
  let mockJobListingService: any;

  const orgId = 'org-123';
  const fedId = 'fed-456';

  const mockOrganization = {
    id: orgId,
    name: 'Test Organization',
    description: 'A test organization for Star Citizen',
    logoUrl: 'https://example.com/logo.png',
  };

  const mockProfile = {
    organizationId: orgId,
    isPublic: true,
    tagline: 'The best org in the verse',
    primaryFocus: 'combat' as const,
    memberCount: 42,
    rsiUrl: 'https://robertsspaceindustries.com/orgs/TEST',
    languages: ['en', 'de'],
    updatedAt: new Date('2026-01-15'),
    organization: mockOrganization,
  };

  const mockFederation = {
    id: fedId,
    name: 'Test Alliance',
    description: 'A test alliance',
    memberCount: 5,
    memberOrganizations: [
      { organizationId: 'org-1', organizationName: 'Org One', role: 'leader' },
      { organizationId: 'org-2', organizationName: 'Org Two', role: 'member' },
    ],
    tags: ['combat', 'mining'],
    createdAt: new Date('2026-01-01').toISOString(),
    sharedResourceTypes: ['ships', 'credits'],
    treatyCount: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PUBLIC_URL = 'https://fringecore.space';

    mockProfileRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockOrgRepo = {
      findOne: jest.fn(),
    };

    mockActivityRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn(function () {
          return this;
        }),
        andWhere: jest.fn(function () {
          return this;
        }),
        select: jest.fn(function () {
          return this;
        }),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    mockFederationService = {
      getPublicFederation: jest.fn(),
      getPublicFederations: jest.fn(),
    };

    mockJobListingService = {
      getJobListing: jest.fn(),
      getPublicJobListings: jest.fn().mockResolvedValue({ data: [] }),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      const name = entity?.name || entity?.toString();
      if (name === 'PublicOrgProfile') return mockProfileRepo;
      if (name === 'Organization') return mockOrgRepo;
      if (name === 'Activity') return mockActivityRepo;
      return {};
    });

    (OrganizationFederationService.getInstance as jest.Mock).mockReturnValue(mockFederationService);

    (PublicJobListingService as unknown as jest.Mock).mockImplementation(
      () => mockJobListingService
    );

    service = new SeoService();
  });

  afterEach(() => {
    delete process.env.PUBLIC_URL;
  });

  // --- getDirectoryHomeMeta ---

  describe('getDirectoryHomeMeta', () => {
    it('should return SEO metadata for the directory homepage', () => {
      const meta = service.getDirectoryHomeMeta();

      expect(meta.title).toContain('Organization Directory');
      expect(meta.title).toContain('Star Citizen Fleet Manager');
      expect(meta.canonicalUrl).toBe('https://fringecore.space/directory');
    });

    it('should include Open Graph metadata', () => {
      const meta = service.getDirectoryHomeMeta();

      expect(meta.openGraph.type).toBe('website');
      expect(meta.openGraph.url).toBe('https://fringecore.space/directory');
      expect(meta.openGraph.siteName).toBe('Star Citizen Fleet Manager');
      expect(meta.openGraph.image).toBeDefined();
    });

    it('should include Twitter Card metadata', () => {
      const meta = service.getDirectoryHomeMeta();

      expect(meta.twitterCard.card).toBe('summary_large_image');
      expect(meta.twitterCard.title).toBeDefined();
      expect(meta.twitterCard.description).toBeDefined();
    });

    it('should include JSON-LD WebSite schema', () => {
      const meta = service.getDirectoryHomeMeta();
      const jsonLd = meta.jsonLd as any;

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('WebSite');
      expect(jsonLd.name).toBe('Star Citizen Fleet Manager');
      expect(jsonLd.url).toBe('https://fringecore.space');
    });

    it('should include SearchAction in JSON-LD', () => {
      const meta = service.getDirectoryHomeMeta();
      const jsonLd = meta.jsonLd as any;

      expect(jsonLd.potentialAction).toBeDefined();
      expect(jsonLd.potentialAction['@type']).toBe('SearchAction');
      expect(jsonLd.potentialAction.target).toContain('search=');
    });

    it('should use FRONTEND_URL fallback when PUBLIC_URL is not set', () => {
      delete process.env.PUBLIC_URL;
      process.env.FRONTEND_URL = 'https://custom.example.com';

      const meta = service.getDirectoryHomeMeta();
      expect(meta.canonicalUrl).toBe('https://custom.example.com/directory');

      delete process.env.FRONTEND_URL;
    });

    it('should use default URL when no env vars set', () => {
      delete process.env.PUBLIC_URL;
      delete process.env.FRONTEND_URL;

      const meta = service.getDirectoryHomeMeta();
      expect(meta.canonicalUrl).toBe('https://fringecore.space/directory');
    });
  });

  describe('directory collection metadata', () => {
    it('should return organizations directory metadata with collection canonical URL', () => {
      const meta = service.getDirectoryOrganizationsMeta();

      expect(meta.title).toContain('Organizations Directory');
      expect(meta.canonicalUrl).toBe('https://fringecore.space/directory/organizations');
      expect((meta.jsonLd as any)['@type']).toBe('CollectionPage');
    });

    it('should return alliances directory metadata with collection canonical URL', () => {
      const meta = service.getDirectoryAlliancesMeta();

      expect(meta.title).toContain('Alliances Directory');
      expect(meta.canonicalUrl).toBe('https://fringecore.space/directory/alliances');
      expect((meta.jsonLd as any)['@type']).toBe('CollectionPage');
    });

    it('should return opportunities directory metadata with collection canonical URL', () => {
      const meta = service.getDirectoryOpportunitiesMeta();

      expect(meta.title).toContain('Opportunities Directory');
      expect(meta.canonicalUrl).toBe('https://fringecore.space/directory/opportunities');
      expect((meta.jsonLd as any)['@type']).toBe('CollectionPage');
    });
  });

  // --- getOrganizationMeta ---

  describe('getOrganizationMeta', () => {
    it('should return SEO metadata for a public organization', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);

      expect(meta).not.toBeNull();
      expect(meta!.title).toContain('Test Organization');
      expect(meta!.canonicalUrl).toBe(`https://fringecore.space/directory/${orgId}`);
    });

    it('should return null for non-existent organization', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const meta = await service.getOrganizationMeta('non-existent');

      expect(meta).toBeNull();
    });

    it('should include organization name in Open Graph', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);

      expect(meta!.openGraph.title).toBe('Test Organization');
      expect(meta!.openGraph.type).toBe('profile');
      expect(meta!.openGraph.image).toBe('https://example.com/logo.png');
    });

    it('should use tagline as description when available', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);

      expect(meta!.description).toBe('The best org in the verse');
    });

    it('should generate description from focus when no tagline', async () => {
      const profileNoTagline = {
        ...mockProfile,
        tagline: null,
        organization: { ...mockOrganization, description: null },
      };
      mockProfileRepo.findOne.mockResolvedValue(profileNoTagline);

      const meta = await service.getOrganizationMeta(orgId);

      expect(meta!.description).toContain('combat operations');
    });

    it('should truncate long descriptions to 160 chars', async () => {
      const longTagline = 'A'.repeat(200);
      const profileLongDesc = { ...mockProfile, tagline: longTagline };
      mockProfileRepo.findOne.mockResolvedValue(profileLongDesc);

      const meta = await service.getOrganizationMeta(orgId);

      expect(meta!.description.length).toBeLessThanOrEqual(160);
      expect(meta!.description.endsWith('...')).toBe(true);
    });

    it('should include JSON-LD Organization schema', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);
      const jsonLd = meta!.jsonLd as any;

      expect(jsonLd['@type']).toBe('Organization');
      expect(jsonLd.name).toBe('Test Organization');
      expect(jsonLd.numberOfEmployees.value).toBe(42);
    });

    it('should include logo in JSON-LD when available', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);
      const jsonLd = meta!.jsonLd as any;

      expect(jsonLd.logo).toBe('https://example.com/logo.png');
    });

    it('should include RSI URL in sameAs', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);
      const jsonLd = meta!.jsonLd as any;

      expect(jsonLd.sameAs).toContain('https://robertsspaceindustries.com/orgs/TEST');
    });

    it('should include languages in knowsLanguage', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);
      const jsonLd = meta!.jsonLd as any;

      expect(jsonLd.knowsLanguage).toEqual(['en', 'de']);
    });

    it('should use default image when org has no logo', async () => {
      const profileNoLogo = {
        ...mockProfile,
        organization: { ...mockOrganization, logoUrl: null },
      };
      mockProfileRepo.findOne.mockResolvedValue(profileNoLogo);

      const meta = await service.getOrganizationMeta(orgId);

      expect(meta!.openGraph.image).toContain('og-image.png');
    });

    it('should use summary card type for organizations', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);

      const meta = await service.getOrganizationMeta(orgId);

      expect(meta!.twitterCard.card).toBe('summary');
    });

    it('should query with correct where clause', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await service.getOrganizationMeta(orgId);

      expect(mockProfileRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, isPublic: true },
          relations: ['organization'],
        })
      );
    });
  });

  // --- getFederationMeta ---

  describe('getFederationMeta', () => {
    it('should return SEO metadata for a public federation', async () => {
      mockFederationService.getPublicFederation.mockResolvedValue(mockFederation);

      const meta = await service.getFederationMeta(fedId);

      expect(meta).not.toBeNull();
      expect(meta!.title).toContain('Test Alliance');
      expect(meta!.title).toContain('Alliance');
      expect(meta!.canonicalUrl).toBe(`https://fringecore.space/directory/federations/${fedId}`);
    });

    it('should return null for non-existent federation', async () => {
      mockFederationService.getPublicFederation.mockResolvedValue(null);

      const meta = await service.getFederationMeta('non-existent');

      expect(meta).toBeNull();
    });

    it('should include member organizations in JSON-LD', async () => {
      mockFederationService.getPublicFederation.mockResolvedValue(mockFederation);

      const meta = await service.getFederationMeta(fedId);
      const jsonLd = meta!.jsonLd as any;

      expect(jsonLd['@type']).toBe('Organization');
      expect(jsonLd.memberOf).toHaveLength(2);
      expect(jsonLd.memberOf[0].name).toBe('Org One');
    });

    it('should include member count in JSON-LD', async () => {
      mockFederationService.getPublicFederation.mockResolvedValue(mockFederation);

      const meta = await service.getFederationMeta(fedId);
      const jsonLd = meta!.jsonLd as any;

      expect(jsonLd.numberOfEmployees.value).toBe(5);
    });

    it('should generate description when federation has none', async () => {
      const fedNoDesc = { ...mockFederation, description: null };
      mockFederationService.getPublicFederation.mockResolvedValue(fedNoDesc);

      const meta = await service.getFederationMeta(fedId);

      expect(meta!.description).toContain('Test Alliance');
      expect(meta!.description).toContain('5 member organizations');
    });

    it('should truncate long federation descriptions', async () => {
      const fedLongDesc = { ...mockFederation, description: 'B'.repeat(200) };
      mockFederationService.getPublicFederation.mockResolvedValue(fedLongDesc);

      const meta = await service.getFederationMeta(fedId);

      expect(meta!.description.length).toBeLessThanOrEqual(160);
    });

    it('should use profile type for Open Graph', async () => {
      mockFederationService.getPublicFederation.mockResolvedValue(mockFederation);

      const meta = await service.getFederationMeta(fedId);

      expect(meta!.openGraph.type).toBe('profile');
    });
  });

  // --- generateSitemap ---

  describe('generateSitemap', () => {
    it('should include homepage and all core public static pages', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });
      mockActivityRepo.createQueryBuilder().getMany.mockResolvedValue([]);
      mockJobListingService.getPublicJobListings.mockResolvedValue({ data: [] });

      const entries = await service.generateSitemap();
      const urls = entries.map((entry: SitemapEntry) => entry.loc);

      expect(entries.length).toBeGreaterThanOrEqual(10);
      expect(entries[0].loc).toBe('https://fringecore.space');
      expect(entries[0].priority).toBe(1);
      expect(urls).toContain('https://fringecore.space/directory');
      expect(urls).toContain('https://fringecore.space/directory/organizations');
      expect(urls).toContain('https://fringecore.space/directory/alliances');
      expect(urls).toContain('https://fringecore.space/directory/opportunities');
      expect(urls).toContain('https://fringecore.space/welcome');
      expect(urls).toContain('https://fringecore.space/opportunities');
      expect(urls).toContain('https://fringecore.space/public/stats');
      expect(urls).toContain('https://fringecore.space/changelog');
      expect(urls).toContain('https://fringecore.space/mobile');
      expect(urls).toContain('https://fringecore.space/join/activity');
      expect(urls).toContain('https://fringecore.space/directory/federations');
      expect(urls).toContain('https://fringecore.space/directory/jobs');
    });

    it('should include all public organization profiles', async () => {
      const profiles = [
        { organizationId: 'org-1', updatedAt: new Date('2026-01-10') },
        { organizationId: 'org-2', updatedAt: new Date('2026-01-12') },
      ];
      mockProfileRepo.find.mockResolvedValue(profiles);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });

      const entries = await service.generateSitemap();

      const orgEntries = entries.filter((e: SitemapEntry) => e.loc.match(/\/directory\/org-\d+$/));
      expect(orgEntries).toHaveLength(2);
      expect(orgEntries[0].changefreq).toBe('weekly');
      expect(orgEntries[0].priority).toBe(0.7);
      expect(orgEntries[0].lastmod).toBe('2026-01-10');
    });

    it('should include all public federations', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({
        data: [
          { id: 'fed-1', createdAt: '2026-01-05T00:00:00Z' },
          { id: 'fed-2', createdAt: '2026-01-08T00:00:00Z' },
        ],
      });

      const entries = await service.generateSitemap();

      const fedEntries = entries.filter((e: SitemapEntry) =>
        e.loc.match(/\/federations\/fed-\d+$/)
      );
      expect(fedEntries).toHaveLength(2);
      expect(fedEntries[0].priority).toBe(0.6);
    });

    it('should query profiles with correct selection', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });
      mockActivityRepo.createQueryBuilder().getMany.mockResolvedValue([]);
      mockJobListingService.getPublicJobListings.mockResolvedValue({ data: [] });

      await service.generateSitemap();

      expect(mockProfileRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true },
          select: ['organizationId', 'updatedAt'],
        })
      );
    });

    it('should include all public activities', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });
      mockJobListingService.getPublicJobListings.mockResolvedValue({ data: [] });

      const mockActivities = [
        { id: 'activity-1', updatedAt: new Date('2026-01-10T12:00:00Z') },
        { id: 'activity-2', updatedAt: new Date('2026-01-12T14:30:00Z') },
      ];

      mockActivityRepo.createQueryBuilder().getMany.mockResolvedValue(mockActivities);

      const entries = await service.generateSitemap();

      const activityEntries = entries.filter((e: SitemapEntry) =>
        e.loc.match(/\/opportunities\/activities\/activity-\d+$/)
      );
      expect(activityEntries).toHaveLength(2);
      expect(activityEntries[0].loc).toContain('activity-1');
      expect(activityEntries[0].changefreq).toBe('weekly');
      expect(activityEntries[0].priority).toBe(0.6);
      expect(activityEntries[0].lastmod).toBe('2026-01-10');
      expect(activityEntries[1].lastmod).toBe('2026-01-12');
    });

    it('should include all public job listings', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });
      mockActivityRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      const mockJobs = {
        data: [
          { id: 'job-uuid-1', postedAt: new Date('2026-01-09T10:00:00Z') },
          { id: 'job-uuid-2', postedAt: new Date('2026-01-11T16:45:00Z') },
        ],
      };

      mockJobListingService.getPublicJobListings.mockResolvedValue(mockJobs);

      const entries = await service.generateSitemap();

      const jobEntries = entries.filter((e: SitemapEntry) => e.loc.match(/\/directory\/jobs\//));
      expect(jobEntries).toHaveLength(2);
      expect(jobEntries[0].loc).toContain('job-uuid-1');
      expect(jobEntries[0].changefreq).toBe('weekly');
      expect(jobEntries[0].priority).toBe(0.5);
      expect(jobEntries[0].lastmod).toBe('2026-01-09');
      expect(jobEntries[1].lastmod).toBe('2026-01-11');
    });

    it('should handle activities with correct QueryBuilder pattern', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });
      mockActivityRepo.createQueryBuilder().getMany.mockResolvedValue([]);
      mockJobListingService.getPublicJobListings.mockResolvedValue({ data: [] });

      await service.generateSitemap();

      const qb = mockActivityRepo.createQueryBuilder('activity');
      expect(qb.where).toHaveBeenCalledWith('activity.visibility = :visibility', {
        visibility: 'public',
      });
      expect(qb.select).toHaveBeenCalledWith(['activity.id', 'activity.updatedAt']);
    });
  });

  // --- generateSitemapXml ---

  describe('generateSitemapXml', () => {
    it('should generate valid XML sitemap', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });

      const xml = await service.generateSitemapXml();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain('</urlset>');
    });

    it('should include loc, changefreq, and priority elements', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });

      const xml = await service.generateSitemapXml();

      expect(xml).toContain('<loc>');
      expect(xml).toContain('<changefreq>');
      expect(xml).toContain('<priority>');
    });

    it('should include lastmod for organization entries', async () => {
      mockProfileRepo.find.mockResolvedValue([
        { organizationId: 'org-1', updatedAt: new Date('2026-02-01') },
      ]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });

      const xml = await service.generateSitemapXml();

      expect(xml).toContain('<lastmod>2026-02-01</lastmod>');
    });

    it('should escape XML special characters in URLs', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });

      const xml = await service.generateSitemapXml();

      // Should not contain unescaped ampersands (other than &amp;)
      const unescapedAmpersands = xml.match(/&(?!amp;|lt;|gt;|quot;|apos;)/g);
      expect(unescapedAmpersands).toBeNull();
    });

    it('should format priorities with one decimal place', async () => {
      mockProfileRepo.find.mockResolvedValue([]);
      mockFederationService.getPublicFederations.mockResolvedValue({ data: [] });

      const xml = await service.generateSitemapXml();

      expect(xml).toContain('<priority>1.0</priority>');
      expect(xml).toContain('<priority>0.9</priority>');
    });
  });

  // --- Focus descriptions ---

  describe('focus descriptions', () => {
    const focusTypes = [
      { focus: 'combat', contains: 'combat' },
      { focus: 'mining', contains: 'mining' },
      { focus: 'trading', contains: 'trading' },
      { focus: 'exploration', contains: 'exploration' },
      { focus: 'bounty_hunting', contains: 'bounty hunting' },
      { focus: 'medical', contains: 'medical' },
      { focus: 'transport', contains: 'transport' },
      { focus: 'salvage', contains: 'salvage' },
      { focus: 'security', contains: 'security' },
      { focus: 'social', contains: 'social' },
      { focus: 'piracy', contains: 'pirate' },
      { focus: 'racing', contains: 'racing' },
      { focus: 'mixed', contains: 'diverse' },
    ];

    it.each(focusTypes)(
      'should generate description for $focus focus',
      async ({ focus, contains }) => {
        const profile = {
          ...mockProfile,
          tagline: null,
          primaryFocus: focus,
          organization: { ...mockOrganization, description: null },
        };
        mockProfileRepo.findOne.mockResolvedValue(profile);

        const meta = await service.getOrganizationMeta(orgId);

        expect(meta!.description).toContain(contains);
      }
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

