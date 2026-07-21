/**
 * JobApplicationService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - missing job listing / application            → NotFoundError (statusCode 404)
 * - inactive / expired listing, duplicate apply,
 *   withdraw in a terminal status                 → ConflictError (statusCode 409)
 * - withdrawing someone else's application        → ForbiddenError (statusCode 403)
 * - missing required type-specific fields         → ValidationError (statusCode 400)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response (JobApplicationService is reached via
 * JobApplicationController, which extends BaseController). All of these
 * previously threw a bare Error that fell through to 500.
 */
import { JobApplicationStatus, JobApplicationType } from '../../../models/JobApplication';
import { PublicJobListing } from '../../../models/PublicJobListing';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../utils/apiErrors';

const mockApplicationRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve({ id: 'app-1', ...data })),
};

const mockJobRepo = {
  findOne: jest.fn(),
};

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === PublicJobListing) return mockJobRepo;
      return mockApplicationRepo;
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Import after mocks
import {
  ApplyToJobInput,
  JobApplicationService,
} from '../../../services/organization/JobApplicationService';

describe('JobApplicationService — typed error contract', () => {
  let service: JobApplicationService;

  const jobListingId = 'job-1';
  const applicantUserId = 'user-1';

  const baseApplyInput = (overrides: Partial<ApplyToJobInput> = {}): ApplyToJobInput => ({
    jobListingId,
    applicantUserId,
    applicantDisplayName: 'Tester',
    applicationType: JobApplicationType.GENERAL,
    ...overrides,
  });

  const activeListing = (overrides: Partial<PublicJobListing> = {}): Partial<PublicJobListing> => ({
    id: jobListingId,
    isActive: true,
    expiresAt: undefined,
    shipCrewBreakdown: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JobApplicationService();
  });

  describe('apply', () => {
    it('throws NotFoundError (404) when the listing does not exist', async () => {
      mockJobRepo.findOne.mockResolvedValue(null);

      const error = await service.apply(baseApplyInput()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('throws ConflictError (409) when the listing is inactive', async () => {
      mockJobRepo.findOne.mockResolvedValue(activeListing({ isActive: false }));

      const error = await service.apply(baseApplyInput()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('throws ConflictError (409) when the listing has expired', async () => {
      mockJobRepo.findOne.mockResolvedValue(
        activeListing({ expiresAt: new Date(Date.now() - 60_000) })
      );

      const error = await service.apply(baseApplyInput()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('throws ConflictError (409) for a duplicate active application', async () => {
      mockJobRepo.findOne.mockResolvedValue(activeListing());
      mockApplicationRepo.findOne.mockResolvedValue({ id: 'existing', status: 'pending' });

      const error = await service.apply(baseApplyInput()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('throws ValidationError (400) when a vehicle application omits vehicleName', async () => {
      mockJobRepo.findOne.mockResolvedValue(activeListing());
      mockApplicationRepo.findOne.mockResolvedValue(null);

      const error = await service
        .apply(baseApplyInput({ applicationType: JobApplicationType.VEHICLE }))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('throws ValidationError (400) when a crew application omits ship/role indices', async () => {
      mockJobRepo.findOne.mockResolvedValue(activeListing());
      mockApplicationRepo.findOne.mockResolvedValue(null);

      const error = await service
        .apply(baseApplyInput({ applicationType: JobApplicationType.CREW }))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });
  });

  describe('withdrawApplication', () => {
    it('throws NotFoundError (404) when the application does not exist', async () => {
      mockApplicationRepo.findOne.mockResolvedValue(null);

      const error = await service
        .withdrawApplication('app-x', applicantUserId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it("throws ForbiddenError (403) when withdrawing another user's application", async () => {
      mockApplicationRepo.findOne.mockResolvedValue({
        id: 'app-1',
        applicantUserId: 'someone-else',
        status: JobApplicationStatus.PENDING,
      });

      const error = await service
        .withdrawApplication('app-1', applicantUserId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
    });

    it('throws ConflictError (409) when the application is already approved', async () => {
      mockApplicationRepo.findOne.mockResolvedValue({
        id: 'app-1',
        applicantUserId,
        status: JobApplicationStatus.APPROVED,
      });

      const error = await service
        .withdrawApplication('app-1', applicantUserId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });
});
