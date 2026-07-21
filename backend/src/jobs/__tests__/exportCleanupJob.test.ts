import { AppDataSource } from '../../config/database';
import {
  OrganizationDeletionRequest,
  OrgDeletionRequestStatus,
} from '../../models/OrganizationDeletionRequest';
import { ExportCleanupJob } from '../exportCleanupJob';
import AzureBlobService from '../../services/cloud/AzureBlobService';

jest.mock('../../config/database');
jest.mock('../../services/cloud/AzureBlobService');
describe('ExportCleanupJob', () => {
  let job: ExportCleanupJob;
  let mockDeletionRequestRepo: any;
  let mockBlobService: jest.Mocked<AzureBlobService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock repository
    mockDeletionRequestRepo = {
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockDeletionRequestRepo);

    // Create job instance
    job = new ExportCleanupJob();

    // Mock blob service
    mockBlobService = {
      isConfigured: jest.fn().mockReturnValue(true),
      deleteImage: jest.fn().mockResolvedValue(true),
    } as any;

    (job as any).blobService = mockBlobService;
  });

  describe('execute', () => {
    it('should skip cleanup if no old exports found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDeletionRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await job.execute();

      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      expect(mockBlobService.deleteImage).not.toHaveBeenCalled();
      expect(mockDeletionRequestRepo.save).not.toHaveBeenCalled();
    });

    it('should clean up old exports successfully', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31); // 31 days ago

      const mockRequests = [
        {
          id: 'req-1',
          organizationId: 'org-1',
          dataExportGenerated: true,
          exportFilePath: 'exports/org-1-req-1-old.json.enc',
          exportDownloadToken: 'token-1',
          status: OrgDeletionRequestStatus.COMPLETED,
          createdAt: oldDate,
        },
        {
          id: 'req-2',
          organizationId: 'org-2',
          dataExportGenerated: true,
          exportFilePath: 'exports/org-2-req-2-old.json.enc',
          exportDownloadToken: 'token-2',
          status: OrgDeletionRequestStatus.CANCELLED,
          createdAt: oldDate,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRequests),
      };

      mockDeletionRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      await job.execute();

      expect(mockBlobService.deleteImage).toHaveBeenCalledTimes(2);
      expect(mockBlobService.deleteImage).toHaveBeenCalledWith('exports/org-1-req-1-old.json.enc');
      expect(mockBlobService.deleteImage).toHaveBeenCalledWith('exports/org-2-req-2-old.json.enc');

      expect(mockDeletionRequestRepo.save).toHaveBeenCalledTimes(2);

      // Verify that export metadata was cleared
      const savedRequest1 = mockDeletionRequestRepo.save.mock.calls[0][0];
      expect(savedRequest1.exportFilePath).toBeNull();
      expect(savedRequest1.exportDownloadToken).toBeNull();

      const savedRequest2 = mockDeletionRequestRepo.save.mock.calls[1][0];
      expect(savedRequest2.exportFilePath).toBeNull();
      expect(savedRequest2.exportDownloadToken).toBeNull();
    });

    it('should handle blob deletion failures gracefully', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      const mockRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        dataExportGenerated: true,
        exportFilePath: 'exports/org-1-req-1-old.json.enc',
        exportDownloadToken: 'token-1',
        status: OrgDeletionRequestStatus.COMPLETED,
        createdAt: oldDate,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRequest]),
      };

      mockDeletionRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      // Mock blob deletion failure
      mockBlobService.deleteImage.mockRejectedValue(new Error('Blob not found'));

      // Should not throw, should continue with database cleanup
      await job.execute();

      expect(mockBlobService.deleteImage).toHaveBeenCalled();
      expect(mockDeletionRequestRepo.save).toHaveBeenCalled();

      // Verify metadata still cleared despite blob error
      const savedRequest = mockDeletionRequestRepo.save.mock.calls[0][0];
      expect(savedRequest.exportFilePath).toBeNull();
    });

    it('should skip requests without export file path', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      const mockRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        dataExportGenerated: true,
        exportFilePath: null,
        status: OrgDeletionRequestStatus.COMPLETED,
        createdAt: oldDate,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRequest]),
      };

      mockDeletionRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await job.execute();

      expect(mockBlobService.deleteImage).not.toHaveBeenCalled();
      expect(mockDeletionRequestRepo.save).not.toHaveBeenCalled();
    });

    it('should work when blob service is not configured', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      const mockRequest = {
        id: 'req-1',
        organizationId: 'org-1',
        dataExportGenerated: true,
        exportFilePath: 'exports/org-1-req-1-old.json.enc',
        exportDownloadToken: 'token-1',
        status: OrgDeletionRequestStatus.COMPLETED,
        createdAt: oldDate,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRequest]),
      };

      mockDeletionRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockDeletionRequestRepo.save.mockImplementation(req => Promise.resolve(req));

      // Blob service not configured
      mockBlobService.isConfigured.mockReturnValue(false);

      await job.execute();

      expect(mockBlobService.deleteImage).not.toHaveBeenCalled();
      expect(mockDeletionRequestRepo.save).toHaveBeenCalled();

      // Verify metadata still cleared
      const savedRequest = mockDeletionRequestRepo.save.mock.calls[0][0];
      expect(savedRequest.exportFilePath).toBeNull();
    });

    it('should handle individual cleanup failures and continue', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      const mockRequests = [
        {
          id: 'req-1',
          organizationId: 'org-1',
          dataExportGenerated: true,
          exportFilePath: 'exports/org-1-req-1-old.json.enc',
          status: OrgDeletionRequestStatus.COMPLETED,
          createdAt: oldDate,
        },
        {
          id: 'req-2',
          organizationId: 'org-2',
          dataExportGenerated: true,
          exportFilePath: 'exports/org-2-req-2-old.json.enc',
          status: OrgDeletionRequestStatus.COMPLETED,
          createdAt: oldDate,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRequests),
      };

      mockDeletionRequestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockDeletionRequestRepo.save
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(mockRequests[1]);

      await job.execute();

      expect(mockBlobService.deleteImage).toHaveBeenCalledTimes(2);
      expect(mockDeletionRequestRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSchedule', () => {
    it('should return correct schedule information', () => {
      const schedule = job.getSchedule();

      expect(schedule).toEqual({
        cron: '0 2 * * *',
        description: expect.stringContaining('30 days'),
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
