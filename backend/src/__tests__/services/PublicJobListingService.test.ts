import { Organization } from '../../models/Organization';
import {
  JobType,
  ListingOwnerType,
  PayType,
  PublicJobListing,
} from '../../models/PublicJobListing';
import { OrgPrimaryFocus } from '../../models/PublicOrgProfile';
import { Ship } from '../../models/Ship';
import {
  CreateJobListingInput,
  JobListingFilterOptions,
  PublicJobListingService,
} from '../../services/organization/PublicJobListingService';
import { resetFullTextSearchCache } from '../../utils/query/fullTextSearch';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

import { AppDataSource } from '../../config/database';

describe('PublicJobListingService', () => {
  let service: PublicJobListingService;
  let mockJobRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    find: jest.Mock;
  };
  let mockOrgRepository: {
    findOne: jest.Mock;
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    description: 'A test organization',
    logoUrl: 'https://example.com/logo.png',
  } as Organization;

  const mockJobListing = {
    id: 'job-123',
    organizationId: 'org-123',
    organization: mockOrganization,
    allianceId: null,
    ownerType: ListingOwnerType.ORGANIZATION,
    title: 'Test Pilot Position',
    description: 'Looking for experienced pilots',
    jobType: JobType.PILOT,
    focus: OrgPrimaryFocus.COMBAT,
    payType: PayType.FIXED,
    payMin: 50000,
    payMax: 100000,
    experienceLevel: 3,
    isActive: true,
    postedAt: new Date(),
    expiresAt: null,
    contactInfo: 'test@example.com',
    timezone: 'UTC',
    languages: ['en'],
    tags: ['veteran', 'combat'],
    createdAt: new Date(),
    updatedAt: new Date(),
    isExpired: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(true),
    getPayDisplay: jest.fn().mockReturnValue('50,000-100,000 aUEC'),
  } as unknown as PublicJobListing;

  beforeEach(() => {
    resetFullTextSearchCache();
    jest.clearAllMocks();

    mockJobRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
    };

    mockOrgRepository = {
      findOne: jest.fn(),
    };

    const mockShipRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      metadata: { columns: [], relations: [] },
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === PublicJobListing) {
        return mockJobRepository;
      }
      if (entity === Organization) {
        return mockOrgRepository;
      }
      if (entity === Ship) {
        return mockShipRepository;
      }
      return {};
    });

    service = new PublicJobListingService();
  });

  describe('getPublicJobListings', () => {
    it('should return paginated job listings', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockJobListing], 1]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getPublicJobListings();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Test Pilot Position');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should apply job type filter correctly', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: JobListingFilterOptions = {
        jobTypes: [JobType.PILOT, JobType.GUNNER],
      };

      await service.getPublicJobListings(filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.jobType IN (:...jobTypes)', {
        jobTypes: [JobType.PILOT, JobType.GUNNER],
      });
    });

    it('should apply focus filter correctly', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: JobListingFilterOptions = {
        focuses: [OrgPrimaryFocus.COMBAT, OrgPrimaryFocus.MINING],
      };

      await service.getPublicJobListings(filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.focus IN (:...focuses)', {
        focuses: [OrgPrimaryFocus.COMBAT, OrgPrimaryFocus.MINING],
      });
    });

    it('should apply owner type filter correctly', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: JobListingFilterOptions = {
        ownerType: ListingOwnerType.ALLIANCE,
      };

      await service.getPublicJobListings(filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.ownerType = :ownerType', {
        ownerType: ListingOwnerType.ALLIANCE,
      });
    });

    it('should apply search term filter correctly', async () => {
      const mockQueryBuilder = {
        connection: { options: { type: 'sqlite' } },
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters: JobListingFilterOptions = {
        searchTerm: 'pilot',
      };

      await service.getPublicJobListings(filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(job.title ILIKE :search_jobSearch OR job.description ILIKE :search_jobSearch)',
        { search_jobSearch: '%pilot%' }
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('job.postedAt', 'DESC');
      expect(mockQueryBuilder.orderBy).not.toHaveBeenCalled();
    });

    it('should apply full-text search on postgres', async () => {
      const mockQueryBuilder = {
        connection: { options: { type: 'postgres' } },
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getPublicJobListings({ searchTerm: 'pilot' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "job.search_vector @@ to_tsquery('english', :tsquery_jobSearch)",
        { tsquery_jobSearch: 'pilot' }
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        "ts_rank(job.search_vector, to_tsquery('english', :tsquery_jobSearch))",
        'DESC'
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('job.postedAt', 'DESC');
      expect(mockQueryBuilder.orderBy).not.toHaveBeenCalled();
    });

    it('should keep explicit sort as secondary ordering for search results', async () => {
      const mockQueryBuilder = {
        connection: { options: { type: 'postgres' } },
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getPublicJobListings(
        { searchTerm: 'pilot' },
        { page: 1, limit: 10, sortBy: 'title', sortOrder: 'ASC' }
      );

      expect(mockQueryBuilder.addOrderBy).toHaveBeenNthCalledWith(
        1,
        "ts_rank(job.search_vector, to_tsquery('english', :tsquery_jobSearch))",
        'DESC'
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenNthCalledWith(2, 'job.title', 'ASC');
      expect(mockQueryBuilder.orderBy).not.toHaveBeenCalled();
    });

    it('should validate sortBy field for security', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Use valid sort field
      await service.getPublicJobListings(
        {},
        { page: 1, limit: 10, sortBy: 'title', sortOrder: 'ASC' }
      );

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('job.title', 'ASC');
    });

    it('should fallback to postedAt for invalid sortBy', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Use invalid sort field (potential SQL injection)
      await service.getPublicJobListings(
        {},
        { page: 1, limit: 10, sortBy: 'id; DROP TABLE jobs;--', sortOrder: 'DESC' }
      );

      // Should fallback to postedAt
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('job.postedAt', 'DESC');
    });
  });

  describe('getJobListing', () => {
    it('should return job listing when found and visible', async () => {
      mockJobRepository.findOne.mockResolvedValue(mockJobListing);

      const result = await service.getJobListing('550e8400-e29b-41d4-a716-446655440000');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-123');
      expect(result?.title).toBe('Test Pilot Position');
    });

    it('should return null when job not found', async () => {
      mockJobRepository.findOne.mockResolvedValue(null);

      const result = await service.getJobListing('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toBeNull();
    });

    it('should return null when job is not visible', async () => {
      const inactiveJob = {
        ...mockJobListing,
        isVisible: jest.fn().mockReturnValue(false),
      };
      mockJobRepository.findOne.mockResolvedValue(inactiveJob);

      const result = await service.getJobListing('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toBeNull();
    });
  });

  describe('createJobListing', () => {
    it('should create a job listing for organization', async () => {
      mockOrgRepository.findOne.mockResolvedValue(mockOrganization);
      mockJobRepository.create.mockReturnValue(mockJobListing);
      mockJobRepository.save.mockResolvedValue(mockJobListing);

      const input: CreateJobListingInput = {
        organizationId: 'org-123',
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Test Pilot Position',
        description: 'Looking for pilots',
        jobType: JobType.PILOT,
        focus: OrgPrimaryFocus.COMBAT,
      };

      const result = await service.createJobListing(input);

      expect(result).toEqual(mockJobListing);
      expect(mockJobRepository.create).toHaveBeenCalled();
      expect(mockJobRepository.save).toHaveBeenCalled();
    });

    it('should throw error when organization not found', async () => {
      mockOrgRepository.findOne.mockResolvedValue(null);

      const input: CreateJobListingInput = {
        organizationId: 'nonexistent',
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Test Position',
        jobType: JobType.CREW,
        focus: OrgPrimaryFocus.MIXED,
      };

      await expect(service.createJobListing(input)).rejects.toThrow('Organization not found');
    });

    it('should throw error when organization ID missing for org type', async () => {
      const input: CreateJobListingInput = {
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Test Position',
        jobType: JobType.CREW,
        focus: OrgPrimaryFocus.MIXED,
      };

      await expect(service.createJobListing(input)).rejects.toThrow('Organization ID is required');
    });

    it('should throw error when alliance ID missing for alliance type', async () => {
      const input: CreateJobListingInput = {
        ownerType: ListingOwnerType.ALLIANCE,
        title: 'Test Position',
        jobType: JobType.CREW,
        focus: OrgPrimaryFocus.MIXED,
      };

      await expect(service.createJobListing(input)).rejects.toThrow('Alliance ID is required');
    });
  });

  describe('updateJobListing', () => {
    it('should update job listing fields', async () => {
      const existingJob = { ...mockJobListing };
      mockJobRepository.findOne.mockResolvedValue(existingJob);
      mockJobRepository.save.mockImplementation(entity => Promise.resolve(entity));

      const result = await service.updateJobListing('job-123', {
        title: 'Updated Title',
        experienceLevel: 5,
      });

      expect(result?.title).toBe('Updated Title');
      expect(result?.experienceLevel).toBe(5);
      expect(mockJobRepository.save).toHaveBeenCalled();
    });

    it('should return null when job not found', async () => {
      mockJobRepository.findOne.mockResolvedValue(null);

      const result = await service.updateJobListing('nonexistent', { title: 'New Title' });

      expect(result).toBeNull();
    });
  });

  describe('deleteJobListing', () => {
    it('should delete job listing and return true', async () => {
      mockJobRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteJobListing('job-123');

      expect(result).toBe(true);
      expect(mockJobRepository.delete).toHaveBeenCalledWith({ id: 'job-123' });
    });

    it('should return false when job not deleted', async () => {
      mockJobRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteJobListing('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getOrganizationJobCount', () => {
    it('should return count of active jobs for organization', async () => {
      mockJobRepository.count.mockResolvedValue(5);

      const result = await service.getOrganizationJobCount('org-123');

      expect(result).toBe(5);
      expect(mockJobRepository.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', isActive: true },
      });
    });
  });

  describe('getAllianceJobCount', () => {
    it('should return count of active jobs for alliance', async () => {
      mockJobRepository.count.mockResolvedValue(3);

      const result = await service.getAllianceJobCount('alliance-123');

      expect(result).toBe(3);
      expect(mockJobRepository.count).toHaveBeenCalledWith({
        where: { allianceId: 'alliance-123', isActive: true },
      });
    });
  });

  describe('getJobTypeOptions', () => {
    it('should return all job type options', () => {
      const options = service.getJobTypeOptions();

      expect(options).toContain(JobType.PILOT);
      expect(options).toContain(JobType.GUNNER);
      expect(options).toContain(JobType.ENGINEER);
      expect(options.length).toBe(Object.values(JobType).length);
    });
  });

  describe('getPayTypeOptions', () => {
    it('should return all pay type options', () => {
      const options = service.getPayTypeOptions();

      expect(options).toContain(PayType.FIXED);
      expect(options).toContain(PayType.HOURLY);
      expect(options).toContain(PayType.VOLUNTEER);
      expect(options.length).toBe(Object.values(PayType).length);
    });
  });

  describe('getJobListingStats', () => {
    it('should return job listing statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce([
            { type: 'pilot', count: '10' },
            { type: 'gunner', count: '5' },
          ])
          .mockResolvedValueOnce([
            { focus: 'combat', count: '8' },
            { focus: 'mining', count: '7' },
          ]),
      };

      mockJobRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // active
        .mockResolvedValueOnce(60) // org listings
        .mockResolvedValueOnce(20); // alliance listings

      mockJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getJobListingStats();

      expect(result.totalListings).toBe(100);
      expect(result.activeListings).toBe(80);
      expect(result.organizationListings).toBe(60);
      expect(result.allianceListings).toBe(20);
      expect(result.byJobType.pilot).toBe(10);
      expect(result.byJobType.gunner).toBe(5);
      expect(result.byFocus.combat).toBe(8);
      expect(result.byFocus.mining).toBe(7);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
