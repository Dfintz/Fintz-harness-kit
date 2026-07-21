/**
 * Tests for PublicOrgDirectoryService slug operations
 *
 * Covers slug generation, collision handling, and syncSlug.
 */
import { PublicOrgDirectoryService } from '../../services/organization/PublicOrgDirectoryService';

// Mock dependencies
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/slugify', () => ({
  slugify: (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replaceAll(/[^a-z0-9\s-]/g, '')
      .replaceAll(/[\s-]+/g, '-')
      .replaceAll(/^-+|-+$/g, ''),
  isUUID: (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
}));

import { AppDataSource } from '../../data-source';

const mockProfileRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
  count: jest.fn(),
  delete: jest.fn(),
};

const mockOrgRepo = {
  findOne: jest.fn(),
};

const mockMembershipQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
};

const mockMembershipRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockMembershipQueryBuilder),
};

(AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
  const name = typeof entity === 'function' ? entity.name : '';
  if (name === 'PublicOrgProfile') return mockProfileRepo;
  if (name === 'Organization') return mockOrgRepo;
  if (name === 'OrganizationMembership') return mockMembershipRepo;
  return {};
});

describe('PublicOrgDirectoryService', () => {
  let service: PublicOrgDirectoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublicOrgDirectoryService();
  });

  describe('getPublicProfile', () => {
    it('should look up by UUID when identifier is a UUID', async () => {
      const uuid = '12345678-1234-1234-1234-123456789abc';
      mockProfileRepo.findOne.mockResolvedValue(null);

      await service.getPublicProfile(uuid);

      expect(mockProfileRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: uuid, isPublic: true },
        })
      );
    });

    it('should look up by slug when identifier is not a UUID', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await service.getPublicProfile('my-org-slug');

      expect(mockProfileRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { isPublic: true, organization: { rsiSid: 'MY-ORG-SLUG' } },
            { isPublic: true, slug: 'my-org-slug' },
          ],
        })
      );
    });

    it('should return null when profile is not found', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const result = await service.getPublicProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('should return public list item when profile is found', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        id: 'profile-1',
        organizationId: 'org-1',
        slug: 'test-org',
        isPublic: true,
        primaryFocus: 'combat',
        activityLevel: 'high',
        memberCount: 10,
        isVerified: false,
        isRecruiting: true,
        organization: { name: 'Test Org' },
      });

      const result = await service.getPublicProfile('test-org');

      expect(result).not.toBeNull();
      expect(result?.organizationName).toBe('Test Org');
      expect(result?.slug).toBe('test-org');
    });

    it('should expose rsiSid in profile response when present', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        id: 'profile-1',
        organizationId: 'org-1',
        slug: 'test-org',
        isPublic: true,
        primaryFocus: 'combat',
        activityLevel: 'high',
        memberCount: 10,
        isVerified: false,
        isRecruiting: true,
        organization: { name: 'Test Org', rsiSid: 'FRINGENAUTS' },
      });

      const result = await service.getPublicProfile('fringenauts');

      expect(result?.rsiSid).toBe('FRINGENAUTS');
    });
  });

  describe('getOrCreateProfile — slug collision handling', () => {
    it('should generate a unique slug on create', async () => {
      // No existing profile
      mockProfileRepo.findOne
        .mockResolvedValueOnce(null) // getOrCreateProfile — no existing profile
        .mockResolvedValueOnce(null); // slug collision check — no collision

      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-1', name: 'Test Org', totalMembers: 5 });

      const savedProfile = {
        id: 'new-profile',
        organizationId: 'org-1',
        slug: 'test-org',
      };
      mockProfileRepo.create.mockReturnValue(savedProfile);
      mockProfileRepo.save.mockResolvedValue(savedProfile);

      const result = await service.getOrCreateProfile('org-1');

      expect(mockProfileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'test-org' })
      );
      expect(result.slug).toBe('test-org');
    });

    it('should append suffix when slug already exists', async () => {
      // No existing profile for this org
      mockProfileRepo.findOne
        .mockResolvedValueOnce(null) // getOrCreateProfile — no existing
        .mockResolvedValueOnce({ id: 'other', slug: 'test-org' }) // collision on "test-org"
        .mockResolvedValueOnce(null); // "test-org-2" is available

      mockOrgRepo.findOne.mockResolvedValue({ id: 'org-2', name: 'Test Org', totalMembers: 3 });

      const savedProfile = { id: 'new-profile', organizationId: 'org-2', slug: 'test-org-2' };
      mockProfileRepo.create.mockReturnValue(savedProfile);
      mockProfileRepo.save.mockResolvedValue(savedProfile);

      await service.getOrCreateProfile('org-2');

      expect(mockProfileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'test-org-2' })
      );
    });
  });

  describe('syncSlug', () => {
    it('should update slug when org name changes', async () => {
      const existingProfile = { id: 'profile-1', organizationId: 'org-1', slug: 'old-name' };
      mockProfileRepo.findOne
        .mockResolvedValueOnce(existingProfile) // find profile
        .mockResolvedValueOnce(null); // no collision on new slug

      mockProfileRepo.save.mockResolvedValue({ ...existingProfile, slug: 'new-name' });

      const result = await service.syncSlug('org-1', 'New Name');

      expect(result?.slug).toBe('new-name');
      expect(mockProfileRepo.save).toHaveBeenCalled();
    });

    it('should return null when profile does not exist', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const result = await service.syncSlug('nonexistent', 'New Name');

      expect(result).toBeNull();
    });

    it('should handle slug collision during sync', async () => {
      const existingProfile = { id: 'profile-1', organizationId: 'org-1', slug: 'old-name' };
      mockProfileRepo.findOne
        .mockResolvedValueOnce(existingProfile) // find profile
        .mockResolvedValueOnce({ id: 'other', slug: 'new-name' }) // collision
        .mockResolvedValueOnce(null); // "new-name-2" available

      mockProfileRepo.save.mockResolvedValue({ ...existingProfile, slug: 'new-name-2' });

      const result = await service.syncSlug('org-1', 'New Name');

      expect(result?.slug).toBe('new-name-2');
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
