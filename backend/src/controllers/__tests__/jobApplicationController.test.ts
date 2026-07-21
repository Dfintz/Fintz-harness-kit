/**
 * Tests for Job Application Controller
 * Covers apply/review/withdraw flows and authorization
 */

import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { JobApplicationStatus, JobApplicationType } from '../../models/JobApplication';
import { PermissionAction, ResourceType } from '../../models/OrganizationPermission';
import { ListingOwnerType } from '../../models/PublicJobListing';
import { JobApplicationController } from '../jobApplicationController';
import { JobApplicationService } from '../../services/organization/JobApplicationService';
import { PublicJobListingService } from '../../services/organization/PublicJobListingService';
import { OrganizationPermissionService } from '../../services/organization/OrganizationPermissionService';
import { OrganizationFederationService } from '../../services/organization/OrganizationFederationService';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../utils/apiErrors';

// Mock dependencies
jest.mock('../../services/organization/JobApplicationService');
jest.mock('../../services/organization/PublicJobListingService');
jest.mock('../../services/organization/OrganizationPermissionService');
jest.mock('../../services/organization/OrganizationFederationService');

describe('JobApplicationController', () => {
  let controller: JobApplicationController;
  let mockAppService: jest.Mocked<JobApplicationService>;
  let mockJobService: jest.Mocked<PublicJobListingService>;
  let mockPermissionService: jest.Mocked<OrganizationPermissionService>;
  let mockFederationService: jest.Mocked<OrganizationFederationService>;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  const testUserId = 'user-123';
  const testJobId = 'job-456';
  const testApplicationId = 'app-789';
  const testOrgId = 'org-abc';
  const testAllianceId = 'alliance-xyz';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock services
    mockAppService = {
      apply: jest.fn(),
      review: jest.fn(),
      withdraw: jest.fn(),
      getApplicationsForJob: jest.fn(),
      getApplicationsByUser: jest.fn(),
    } as unknown as jest.Mocked<JobApplicationService>;

    mockJobService = {
      getJobListingInternal: jest.fn(),
    } as unknown as jest.Mocked<PublicJobListingService>;

    mockPermissionService = {
      checkPermission: jest.fn(),
    } as unknown as jest.Mocked<OrganizationPermissionService>;

    mockFederationService = {
      hasAllianceManageAccess: jest.fn(),
    } as unknown as jest.Mocked<OrganizationFederationService>;

    // Create controller instance
    controller = new JobApplicationController();
    (controller as any).appService = mockAppService;
    (controller as any).jobService = mockJobService;
    (controller as any).permissionService = mockPermissionService;
    (controller as any).federationService = mockFederationService;

    // Setup mock request/response
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockRequest = {
      params: {},
      body: {},
      user: { id: testUserId, username: 'TestUser' },
    } as Partial<AuthRequest>;

    mockResponse = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>;
  });

  describe('applyToJob', () => {
    it('should successfully apply to a job listing', async () => {
      mockRequest.params = { jobId: testJobId };
      mockRequest.body = {
        applicationType: JobApplicationType.CREW,
        message: 'I want to join',
        shipIndex: 0,
        roleIndex: 1,
      };

      const mockApplication = {
        id: testApplicationId,
        jobListingId: testJobId,
        applicantUserId: testUserId,
        status: JobApplicationStatus.PENDING,
      };

      mockAppService.apply.mockResolvedValue(mockApplication as any);

      await controller.applyToJob(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockAppService.apply).toHaveBeenCalledWith(
        expect.objectContaining({
          jobListingId: testJobId,
          applicantUserId: testUserId,
          applicationType: JobApplicationType.CREW,
          message: 'I want to join',
          shipIndex: 0,
          roleIndex: 1,
        })
      );
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Application submitted successfully',
        data: mockApplication,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.applyToJob(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe('reviewApplication', () => {
    const mockListing = {
      id: testJobId,
      ownerType: ListingOwnerType.ORGANIZATION,
      organizationId: testOrgId,
      isVisible: () => true,
    };

    beforeEach(() => {
      mockRequest.params = { jobId: testJobId, applicationId: testApplicationId };
      mockRequest.body = {
        status: JobApplicationStatus.APPROVED,
        reviewNote: 'Looks good',
      };
      mockJobService.getJobListingInternal.mockResolvedValue(mockListing as any);
    });

    it.skip('should successfully approve an application (organization owner)', async () => {
      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Owner',
      });

      const mockApplication = {
        id: testApplicationId,
        status: JobApplicationStatus.APPROVED,
      };
      mockAppService.review.mockResolvedValue(mockApplication as any);

      await controller.reviewApplication(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        testUserId,
        testOrgId,
        ResourceType.RECRUITMENT,
        PermissionAction.EDIT
      );
      expect(mockAppService.review).toHaveBeenCalledWith(
        testApplicationId,
        testUserId,
        expect.objectContaining({
          status: JobApplicationStatus.APPROVED,
          reviewNote: 'Looks good',
        })
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockApplication,
      });
    });

    it('should return 403 when user lacks permissions', async () => {
      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'No permission',
      });

      await controller.reviewApplication(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalled();
    });

    it('should return 404 when job listing does not exist', async () => {
      mockJobService.getJobListingInternal.mockResolvedValue(null);

      await controller.reviewApplication(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalled();
    });

    it.skip('should support alliance listing authorization', async () => {
      const allianceListing = {
        id: testJobId,
        ownerType: ListingOwnerType.ALLIANCE,
        allianceId: testAllianceId,
        isVisible: () => true,
      };
      mockJobService.getJobListingInternal.mockResolvedValue(allianceListing as any);
      mockFederationService.hasAllianceManageAccess.mockResolvedValue(true);

      const mockApplication = {
        id: testApplicationId,
        status: JobApplicationStatus.APPROVED,
      };
      mockAppService.review.mockResolvedValue(mockApplication as any);

      await controller.reviewApplication(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockFederationService.hasAllianceManageAccess).toHaveBeenCalledWith(
        testAllianceId,
        testUserId
      );
      expect(mockAppService.review).toHaveBeenCalled();
    });
  });

  describe('withdrawApplication', () => {
    it.skip('should successfully withdraw own application', async () => {
      mockRequest.params = { jobId: testJobId, applicationId: testApplicationId };

      const mockApplication = {
        id: testApplicationId,
        applicantUserId: testUserId,
        status: JobApplicationStatus.WITHDRAWN,
      };
      mockAppService.withdraw.mockResolvedValue(mockApplication as any);

      await controller.withdrawApplication(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockAppService.withdraw).toHaveBeenCalledWith(testApplicationId, testUserId);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockApplication,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.withdrawApplication(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe('getApplicationsForJob', () => {
    const mockListing = {
      id: testJobId,
      ownerType: ListingOwnerType.ORGANIZATION,
      organizationId: testOrgId,
      isVisible: () => true,
    };

    beforeEach(() => {
      mockRequest.params = { jobId: testJobId };
      mockJobService.getJobListingInternal.mockResolvedValue(mockListing as any);
    });

    it.skip('should list applications for job (authorized owner)', async () => {
      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Owner',
      });

      const mockApplications = [
        { id: 'app-1', status: JobApplicationStatus.PENDING },
        { id: 'app-2', status: JobApplicationStatus.APPROVED },
      ];
      mockAppService.getApplicationsForJob.mockResolvedValue(mockApplications as any);

      await controller.getApplicationsForJob(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockAppService.getApplicationsForJob).toHaveBeenCalledWith(testJobId, undefined);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockApplications,
      });
    });

    it('should return 403 when user lacks permissions', async () => {
      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'No permission',
      });

      await controller.getApplicationsForJob(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalled();
    });
  });

  describe('getMyApplications', () => {
    it('should list applications for authenticated user', async () => {
      const mockApplications = [
        { id: 'app-1', jobListingId: 'job-1', status: JobApplicationStatus.PENDING },
        { id: 'app-2', jobListingId: 'job-2', status: JobApplicationStatus.APPROVED },
      ];
      mockAppService.getApplicationsByUser.mockResolvedValue(mockApplications as any);

      await controller.getMyApplications(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockAppService.getApplicationsByUser).toHaveBeenCalledWith(testUserId);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockApplications,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.getMyApplications(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
