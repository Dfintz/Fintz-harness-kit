/**
 * Integration tests for v2 directory routes
 * Tests GET /api/v2/directory/* endpoints
 */
import { json } from 'body-parser';
import express from 'express';
import request from 'supertest';

// Mock the services BEFORE importing routes
const mockGetPublicDirectory = jest.fn();
const mockGetPublicProfile = jest.fn();
const mockGetDirectoryStats = jest.fn();
const mockGetPublicFederations = jest.fn();
const mockGetPublicFederation = jest.fn();
const mockGetPublicFederationStats = jest.fn();
const mockGetDirectoryHomeMeta = jest.fn();
const mockGetDirectoryOrganizationsMeta = jest.fn();
const mockGetDirectoryAlliancesMeta = jest.fn();
const mockGetDirectoryOpportunitiesMeta = jest.fn();
const mockGetOrganizationMeta = jest.fn();
const mockGetFederationMeta = jest.fn();
const mockGenerateSitemapXml = jest.fn();

jest.mock('../../services/organization/PublicOrgDirectoryService', () => ({
  PublicOrgDirectoryService: jest.fn(() => ({
    getPublicDirectory: mockGetPublicDirectory,
    getPublicProfile: mockGetPublicProfile,
    getDirectoryStats: mockGetDirectoryStats,
  })),
}));

jest.mock('../../services/organization/OrganizationFederationService', () => ({
  OrganizationFederationService: {
    getInstance: jest.fn(() => ({
      getPublicFederations: mockGetPublicFederations,
      getPublicFederation: mockGetPublicFederation,
      getPublicFederationStats: mockGetPublicFederationStats,
    })),
  },
}));

jest.mock('../../services/seo/SeoService', () => ({
  SeoService: jest.fn(() => ({
    getDirectoryHomeMeta: mockGetDirectoryHomeMeta,
    getDirectoryOrganizationsMeta: mockGetDirectoryOrganizationsMeta,
    getDirectoryAlliancesMeta: mockGetDirectoryAlliancesMeta,
    getDirectoryOpportunitiesMeta: mockGetDirectoryOpportunitiesMeta,
    getOrganizationMeta: mockGetOrganizationMeta,
    getFederationMeta: mockGetFederationMeta,
    getHomePageMeta: mockGetDirectoryHomeMeta,
    generateSitemapXml: mockGenerateSitemapXml,
  })),
}));

// Mock auth middleware to avoid AuthenticationService instantiation during import
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', username: 'testuser', role: 'admin' };
    next();
  }),
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', username: 'testuser', role: 'admin' };
    next();
  }),
  generateToken: jest.fn(() => 'mock-jwt-token'),
}));

// Import only the directory routes, not the entire v2 index
import { errorHandlerV2 } from '../../middleware/errorHandlerV2';
import { requestIdMiddleware } from '../../middleware/requestId';
import { standardResponseMiddleware } from '../../middleware/standardResponse';
import directoryRoutes from '../../routes/v2/directory';

describe('V2 Directory Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create Express app with directory routes and middleware
    app = express();
    app.use(json());
    app.use(requestIdMiddleware);
    app.use(standardResponseMiddleware);
    app.use('/api/v2', directoryRoutes);
    app.use(errorHandlerV2); // Add error handler last

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/v2/directory/organizations', () => {
    it('should return 200 with paginated organizations list', async () => {
      const mockOrgs = [
        {
          id: 'org-1',
          organizationId: 'org-1',
          organizationName: 'Test Org',
          tagline: 'A test organization',
          primaryFocus: 'PVP',
          memberCount: 50,
          activityLevel: 'MEDIUM',
          isVerified: true,
          isRecruiting: true,
        },
      ];

      mockGetPublicDirectory.mockResolvedValue({
        data: mockOrgs,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app).get('/api/v2/directory/organizations').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('pagination');
      expect(response.body.meta.pagination.total).toBe(1);
    });

    it('should handle pagination parameters', async () => {
      mockGetPublicDirectory.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 2,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrev: true,
        },
      });

      const response = await request(app)
        .get('/api/v2/directory/organizations')
        .query({ page: '2', limit: '10' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.meta.pagination.page).toBe(2);
      expect(response.body.meta.pagination.limit).toBe(10);
      expect(mockGetPublicDirectory).toHaveBeenCalled();
    });

    it('should handle filter parameters', async () => {
      mockGetPublicDirectory.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app)
        .get('/api/v2/directory/organizations')
        .query({
          primaryFocus: 'PVP',
          isRecruiting: 'true',
          minMemberCount: '10',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGetPublicDirectory).toHaveBeenCalled();
    });
  });

  describe('GET /api/v2/directory/organizations/:organizationId', () => {
    it('should return 200 with organization data', async () => {
      const mockOrg = {
        id: 'org-1',
        organizationName: 'Test Org',
        tagline: 'A test organization',
        primaryFocus: 'combat',
        memberCount: 50,
      };

      mockGetPublicProfile.mockResolvedValue(mockOrg);

      const response = await request(app).get('/api/v2/directory/organizations/org-1').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('organizationName', 'Test Org');
    });

    it.skip('should return 404 when organization not found', async () => {
      mockGetPublicProfile.mockResolvedValue(null);

      await request(app).get('/api/v2/directory/organizations/nonexistent').expect(404);
    });
  });

  describe('GET /api/v2/directory/organizations/stats', () => {
    it('should return 200 with statistics', async () => {
      const mockStats = {
        totalOrganizations: 100,
        recruitingOrganizations: 50,
        verifiedOrganizations: 30,
        byFocus: { combat: 40, trading: 30 },
      };

      mockGetDirectoryStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/v2/directory/organizations/stats').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalOrganizations).toBe(100);
    });
  });

  describe('GET /api/v2/directory/federations', () => {
    it('should return 200 with paginated federations list', async () => {
      const mockFederations = [
        {
          id: 'fed-1',
          name: 'Test Federation',
          description: 'A test federation',
          memberCount: 5,
          memberOrganizations: [],
          tags: ['combat'],
          createdAt: new Date('2024-01-01'),
          sharedResourceTypes: ['fleet'],
          treatyCount: 2,
        },
      ];

      mockGetPublicFederations.mockResolvedValue({
        data: mockFederations,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app).get('/api/v2/directory/federations').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('name', 'Test Federation');
      expect(response.body.meta.pagination.total).toBe(1);
    });

    it('should handle filter and sort parameters', async () => {
      mockGetPublicFederations.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const response = await request(app)
        .get('/api/v2/directory/federations')
        .query({
          name: 'Test',
          tags: 'combat,trading',
          sortBy: 'memberCount',
          sortOrder: 'DESC',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGetPublicFederations).toHaveBeenCalled();
    });
  });

  describe('GET /api/v2/directory/federations/:federationId', () => {
    it('should return 200 with federation data', async () => {
      const mockFederation = {
        id: 'fed-1',
        name: 'Test Federation',
        description: 'A test federation',
        memberCount: 5,
        memberOrganizations: [],
        tags: ['combat'],
        createdAt: new Date('2024-01-01'),
        sharedResourceTypes: ['fleet'],
        treatyCount: 1,
      };

      mockGetPublicFederation.mockResolvedValue(mockFederation);

      const response = await request(app).get('/api/v2/directory/federations/fed-1').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('name', 'Test Federation');
    });

    it.skip('should return 404 when federation not found', async () => {
      mockGetPublicFederation.mockResolvedValue(null);

      await request(app).get('/api/v2/directory/federations/nonexistent').expect(404);
    });
  });

  describe('GET /api/v2/directory/federations/stats', () => {
    it('should return 200 with federation statistics', async () => {
      const mockStats = {
        totalFederations: 10,
        totalMemberOrganizations: 50,
        averageMembersPerFederation: 5,
        byTag: { combat: 5, trading: 3 },
      };

      mockGetPublicFederationStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/v2/directory/federations/stats').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalFederations).toBe(10);
    });
  });

  describe('GET /api/v2/directory/seo', () => {
    it('should return 200 with directory SEO metadata', async () => {
      const mockMeta = {
        title: 'Directory',
        description: 'Explore organizations',
        keywords: ['fleet', 'organization'],
      };

      mockGetDirectoryHomeMeta.mockReturnValue(mockMeta);

      const response = await request(app).get('/api/v2/directory/seo').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Directory');
    });
  });

  describe('GET /api/v2/directory/organizations/:organizationId/seo', () => {
    it('should return 200 with organization SEO metadata', async () => {
      const mockMeta = {
        title: 'Test Org',
        description: 'Test organization',
        keywords: ['combat'],
      };

      mockGetOrganizationMeta.mockResolvedValue(mockMeta);

      const response = await request(app)
        .get('/api/v2/directory/organizations/org-1/seo')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Org');
    });

    it.skip('should return 404 when organization SEO not found', async () => {
      mockGetOrganizationMeta.mockResolvedValue(null);

      await request(app).get('/api/v2/directory/organizations/nonexistent/seo').expect(404);
    });
  });

  describe('GET /api/v2/directory/federations/:federationId/seo', () => {
    it('should return 200 with federation SEO metadata', async () => {
      const mockMeta = {
        title: 'Test Federation',
        description: 'Test federation',
        keywords: ['alliance'],
      };

      mockGetFederationMeta.mockResolvedValue(mockMeta);

      const response = await request(app)
        .get('/api/v2/directory/federations/fed-1/seo')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Federation');
    });

    it.skip('should return 404 when federation SEO not found', async () => {
      mockGetFederationMeta.mockResolvedValue(null);

      await request(app).get('/api/v2/directory/federations/nonexistent/seo').expect(404);
    });
  });

  describe('GET /api/v2/directory/seo/html', () => {
    it('should return SEO HTML document for route path', async () => {
      mockGetDirectoryHomeMeta.mockReturnValue({
        title: 'Home',
        description: 'Welcome',
        canonicalUrl: 'https://fringecore.space/',
        openGraph: {
          title: 'Home',
          description: 'Welcome',
          type: 'website',
          url: 'https://fringecore.space/',
          siteName: 'Star Citizen Fleet Manager',
          image: 'https://fringecore.space/og-image.png',
        },
        twitterCard: {
          card: 'summary_large_image',
          title: 'Home',
          description: 'Welcome',
          image: 'https://fringecore.space/og-image.png',
        },
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Star Citizen Fleet Manager',
        },
      });

      const response = await request(app)
        .get('/api/v2/directory/seo/html')
        .query({ path: '/' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('<!doctype html>');
      expect(response.text).toContain('<script type="application/ld+json">');
      expect(response.text).toContain('<meta property="og:title"');
    });
  });

  describe('GET /api/v2/sitemap.xml', () => {
    it('should return XML sitemap response', async () => {
      mockGenerateSitemapXml.mockResolvedValue(
        '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>'
      );

      const response = await request(app).get('/api/v2/sitemap.xml').expect(200);

      expect(response.headers['content-type']).toContain('application/xml');
      expect(response.text).toContain('<urlset>');
      expect(mockGenerateSitemapXml).toHaveBeenCalledTimes(1);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
