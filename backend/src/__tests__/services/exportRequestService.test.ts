/**
 * ExportRequestService Unit Tests
 *
 * Tests GDPR export request tracking, processing, and file management
 * Updated to include Azure Blob Storage tests
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import fs from 'fs/promises';

import { ExportRequestStatus } from '../../models/ExportRequest';
import { GdprExportStorageService } from '../../services/cloud/GdprExportStorageService';
import { ConsentService } from '../../services/user/ConsentService';
import { ExportRequestService } from '../../services/user/ExportRequestService';
import * as gdprUtils from '../../utils/gdprUtils';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../services/user/ConsentService');
jest.mock('../../services/cloud/GdprExportStorageService');
jest.mock('../../utils/gdprUtils', () => ({
  getUserPrimaryOrganization: jest.fn(),
}));

describe('ExportRequestService', () => {
  let service: ExportRequestService;
  let mockRepository: any;
  let mockConsentService: jest.Mocked<ConsentService>;
  let mockGdprExportStorage: jest.Mocked<GdprExportStorageService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set required environment variables for testing
    process.env.EXPORT_TOKEN_SECRET = 'test-secret-for-testing';
    process.env.NODE_ENV = 'test';

    // Create mock repository
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    // Mock AppDataSource.getRepository
    mockAppDataSource.getRepository = jest.fn().mockReturnValue(mockRepository);

    // Mock ConsentService
    mockConsentService = {
      exportUserData: jest.fn(),
    } as any;

    // Mock GdprExportStorageService
    mockGdprExportStorage = {
      isConfigured: jest.fn(),
      uploadExport: jest.fn(),
      generateSasUrl: jest.fn(),
      downloadExport: jest.fn(),
      deleteExport: jest.fn(),
      exportExists: jest.fn(),
    } as any;

    // Mock getUserPrimaryOrganization to return null by default (use default settings)
    (gdprUtils.getUserPrimaryOrganization as jest.Mock).mockResolvedValue(null);

    service = new ExportRequestService();
    (service as any).consentService = mockConsentService;
    (service as any).gdprExportStorage = mockGdprExportStorage;
  });

  describe('createExportRequest', () => {
    it('should create an export request successfully', async () => {
      const userId = 'user-123';
      const ipAddress = '127.0.0.1';
      const userAgent = 'Test Browser';

      const mockRequest = {
        id: 'export-request-123',
        userId,
        status: ExportRequestStatus.PENDING,
        requestedAt: new Date(),
        requestIpAddress: ipAddress,
        requestUserAgent: userAgent,
        notificationSent: false,
      };

      mockRepository.create.mockReturnValue(mockRequest);
      mockRepository.save.mockResolvedValue(mockRequest);

      const result = await service.createExportRequest(userId, ipAddress, userAgent);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.status).toBe(ExportRequestStatus.PENDING);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle errors during creation', async () => {
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.createExportRequest('user-123')).rejects.toThrow(
        'Failed to create export request'
      );
    });
  });

  describe('getExportRequest', () => {
    it('should retrieve an export request by ID', async () => {
      const requestId = 'export-request-123';
      const mockRequest = {
        id: requestId,
        userId: 'user-123',
        status: ExportRequestStatus.PENDING,
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);

      const result = await service.getExportRequest(requestId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(requestId);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: requestId },
      });
    });

    it('should return null if export request not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getExportRequest('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserExportRequests', () => {
    it('should retrieve user export requests with limit', async () => {
      const userId = 'user-123';
      const mockRequests = [
        { id: 'req-1', userId, status: ExportRequestStatus.COMPLETED },
        { id: 'req-2', userId, status: ExportRequestStatus.PENDING },
      ];

      mockRepository.find.mockResolvedValue(mockRequests);

      const result = await service.getUserExportRequests(userId, 10);

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { requestedAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getPendingExportRequests', () => {
    it('should retrieve pending export requests', async () => {
      const mockRequests = [
        { id: 'req-1', status: ExportRequestStatus.PENDING },
        { id: 'req-2', status: ExportRequestStatus.PENDING },
      ];

      mockRepository.find.mockResolvedValue(mockRequests);

      const result = await service.getPendingExportRequests(10);

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { status: ExportRequestStatus.PENDING },
        order: { requestedAt: 'ASC' },
        take: 10,
      });
    });
  });

  describe('processExportRequest', () => {
    beforeEach(() => {
      // Mock fs promises for legacy cleanup
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      // Default: Azure configured
      mockGdprExportStorage.isConfigured.mockReturnValue(true);
      mockGdprExportStorage.uploadExport.mockResolvedValue('blob-name-123');
      mockGdprExportStorage.generateSasUrl.mockResolvedValue('https://storage.example.com/sas');
    });

    it('should process export request successfully', async () => {
      const requestId = 'export-request-123';
      const mockRequest = {
        id: requestId,
        userId: 'user-123',
        status: ExportRequestStatus.PENDING,
        requestedAt: new Date(),
      };

      const mockExportData = {
        user: { id: 'user-123', username: 'testuser' },
        consents: [],
        userShips: [],
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);
      mockRepository.save.mockResolvedValue({
        ...mockRequest,
        status: ExportRequestStatus.COMPLETED,
      });
      mockConsentService.exportUserData.mockResolvedValue(mockExportData);

      const result = await service.processExportRequest(requestId);

      expect(result.status).toBe(ExportRequestStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
      expect(result.filePath).toBeDefined();
      expect(result.downloadToken).toBeDefined();
      expect(mockGdprExportStorage.uploadExport).toHaveBeenCalled();
      expect(mockGdprExportStorage.generateSasUrl).toHaveBeenCalled();
    });

    it('should throw error if export request not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.processExportRequest('nonexistent-id')).rejects.toThrow(
        'Export request not found'
      );
    });

    it('should throw error if request is not pending', async () => {
      const mockRequest = {
        id: 'req-1',
        userId: 'user-123',
        status: ExportRequestStatus.COMPLETED,
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);

      await expect(service.processExportRequest('req-1')).rejects.toThrow(
        'is not in PENDING status'
      );
    });

    it('should mark request as failed on processing error', async () => {
      const mockRequest = {
        id: 'req-1',
        userId: 'user-123',
        status: ExportRequestStatus.PENDING,
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);
      mockConsentService.exportUserData.mockRejectedValue(new Error('Export failed'));

      await expect(service.processExportRequest('req-1')).rejects.toThrow('Export failed');

      // Verify it was marked as failed
      const saveCalls = mockRepository.save.mock.calls;
      const lastSave = saveCalls[saveCalls.length - 1][0];
      expect(lastSave.status).toBe(ExportRequestStatus.FAILED);
      expect(lastSave.failureReason).toBe('Export failed');
    });
  });

  describe('verifyDownloadToken', () => {
    it('should verify valid download token', async () => {
      const requestId = 'export-request-123';
      const token = 'valid-token';
      const mockRequest = {
        id: requestId,
        userId: 'user-123',
        status: ExportRequestStatus.COMPLETED,
        downloadToken: token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);

      const result = await service.verifyDownloadToken(requestId, token);

      expect(result).toBeDefined();
      expect(result?.id).toBe(requestId);
    });

    it('should return null for invalid token', async () => {
      const mockRequest = {
        id: 'req-1',
        status: ExportRequestStatus.COMPLETED,
        downloadToken: 'valid-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);

      const result = await service.verifyDownloadToken('req-1', 'wrong-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const mockRequest = {
        id: 'req-1',
        status: ExportRequestStatus.COMPLETED,
        downloadToken: 'valid-token',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);
      mockRepository.save.mockResolvedValue({
        ...mockRequest,
        status: ExportRequestStatus.EXPIRED,
      });

      const result = await service.verifyDownloadToken('req-1', 'valid-token');

      expect(result).toBeNull();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return null if request not completed', async () => {
      const mockRequest = {
        id: 'req-1',
        status: ExportRequestStatus.PENDING,
        downloadToken: 'valid-token',
      };

      mockRepository.findOne.mockResolvedValue(mockRequest);

      const result = await service.verifyDownloadToken('req-1', 'valid-token');

      expect(result).toBeNull();
    });
  });

  describe('markNotificationSent', () => {
    it('should mark notification as sent', async () => {
      const requestId = 'export-request-123';
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.markNotificationSent(requestId);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: requestId },
        { notificationSent: true }
      );
    });
  });

  describe('cleanupExpiredExports', () => {
    beforeEach(() => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    });

    it('should clean up expired export requests', async () => {
      const expiredRequests = [
        {
          id: 'req-1',
          status: ExportRequestStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          filePath: '/tmp/export-1.json',
        },
        {
          id: 'req-2',
          status: ExportRequestStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          filePath: '/tmp/export-2.json',
        },
      ];

      mockRepository.find.mockResolvedValue(expiredRequests);
      mockRepository.save.mockResolvedValue({});

      const result = await service.cleanupExpiredExports();

      expect(result).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle file deletion errors gracefully', async () => {
      const expiredRequest = {
        id: 'req-1',
        status: ExportRequestStatus.COMPLETED,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        filePath: '/tmp/export-1.json',
      };

      mockRepository.find.mockResolvedValue([expiredRequest]);
      mockRepository.save.mockResolvedValue({});
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await service.cleanupExpiredExports();

      expect(result).toBe(1);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('getExportCountLastNDays', () => {
    it('should return count of exports in last N days', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getExportCountLastNDays(30);

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalled();
    });

    it('should handle errors and return 0', async () => {
      mockRepository.count.mockRejectedValue(new Error('Database error'));

      const result = await service.getExportCountLastNDays(30);

      expect(result).toBe(0);
    });
  });

  describe('Azure Blob Storage Integration', () => {
    describe('processExportRequest with Azure Blob Storage', () => {
      beforeEach(() => {
        // Mock fs for fallback scenario
        (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
        (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      });

      it('should use Azure Blob Storage when configured', async () => {
        const requestId = 'export-request-123';
        const mockRequest = {
          id: requestId,
          userId: 'user-123',
          status: ExportRequestStatus.PENDING,
          requestedAt: new Date(),
        };

        const mockExportData = {
          user: { id: 'user-123', username: 'testuser' },
          consents: [],
          userShips: [],
        };

        const blobName = 'user-123/export-request-123/1234567890.json';
        const sasUrl =
          'https://storage.blob.core.windows.net/gdpr-exports/user-123/export-request-123/1234567890.json?sas=token';

        mockRepository.findOne.mockResolvedValue(mockRequest);
        mockRepository.save.mockResolvedValue({
          ...mockRequest,
          status: ExportRequestStatus.COMPLETED,
        });
        mockConsentService.exportUserData.mockResolvedValue(mockExportData);
        mockGdprExportStorage.isConfigured.mockReturnValue(true);
        mockGdprExportStorage.uploadExport.mockResolvedValue(blobName);
        mockGdprExportStorage.generateSasUrl.mockResolvedValue(sasUrl);

        const result = await service.processExportRequest(requestId);

        expect(result.status).toBe(ExportRequestStatus.COMPLETED);
        expect(mockGdprExportStorage.uploadExport).toHaveBeenCalledWith(
          'user-123',
          requestId,
          mockExportData
        );
        expect(mockGdprExportStorage.generateSasUrl).toHaveBeenCalledWith(
          blobName,
          expect.any(Number) // expiration days * 24
        );
        expect(result.filePath).toBe(blobName);
        expect(result.exportMetadata?.storageType).toBe('azure-blob');
        expect(result.exportMetadata?.downloadUrl).toBe(sasUrl);
        // Should NOT use local file system
        expect(fs.mkdir).not.toHaveBeenCalled();
        expect(fs.writeFile).not.toHaveBeenCalled();
      });

      it('should throw when Azure Blob Storage is not configured', async () => {
        const requestId = 'export-request-123';
        const mockRequest = {
          id: requestId,
          userId: 'user-123',
          status: ExportRequestStatus.PENDING,
          requestedAt: new Date(),
        };

        const mockExportData = {
          user: { id: 'user-123', username: 'testuser' },
          consents: [],
        };

        mockRepository.findOne.mockResolvedValue(mockRequest);
        mockRepository.save.mockResolvedValue({
          ...mockRequest,
          status: ExportRequestStatus.FAILED,
        });
        mockConsentService.exportUserData.mockResolvedValue(mockExportData);
        mockGdprExportStorage.isConfigured.mockReturnValue(false);

        await expect(service.processExportRequest(requestId)).rejects.toThrow(
          'GDPR export storage is not configured'
        );
      });
    });

    describe('cleanupExpiredExports with Azure Blob Storage', () => {
      it('should delete from Azure Blob Storage when storage type is azure-blob', async () => {
        const expiredRequest = {
          id: 'req-1',
          status: ExportRequestStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          filePath: 'user-123/req-1/1234567890.json',
          exportMetadata: { storageType: 'azure-blob' },
        };

        mockRepository.find.mockResolvedValue([expiredRequest]);
        mockRepository.save.mockResolvedValue({});
        mockGdprExportStorage.isConfigured.mockReturnValue(true);
        mockGdprExportStorage.deleteExport.mockResolvedValue(true);

        const result = await service.cleanupExpiredExports();

        expect(result).toBe(1);
        expect(mockGdprExportStorage.deleteExport).toHaveBeenCalledWith(
          'user-123/req-1/1234567890.json'
        );
        expect(fs.unlink).not.toHaveBeenCalled();
      });

      it('should delete from local file system when storage type is local-file', async () => {
        const expiredRequest = {
          id: 'req-1',
          status: ExportRequestStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          filePath: '/tmp/gdpr-exports/export-1.json',
          exportMetadata: { storageType: 'local-file' },
        };

        mockRepository.find.mockResolvedValue([expiredRequest]);
        mockRepository.save.mockResolvedValue({});
        (fs.unlink as jest.Mock).mockResolvedValue(undefined);

        const result = await service.cleanupExpiredExports();

        expect(result).toBe(1);
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/gdpr-exports/export-1.json');
        expect(mockGdprExportStorage.deleteExport).not.toHaveBeenCalled();
      });

      it('should handle blob deletion errors gracefully', async () => {
        const expiredRequest = {
          id: 'req-1',
          status: ExportRequestStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          filePath: 'user-123/req-1/1234567890.json',
          exportMetadata: { storageType: 'azure-blob' },
        };

        mockRepository.find.mockResolvedValue([expiredRequest]);
        mockRepository.save.mockResolvedValue({});
        mockGdprExportStorage.isConfigured.mockReturnValue(true);
        mockGdprExportStorage.deleteExport.mockRejectedValue(new Error('Blob not found'));

        const result = await service.cleanupExpiredExports();

        // Should still mark as expired even if deletion fails
        expect(result).toBe(1);
        expect(mockRepository.save).toHaveBeenCalled();
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
