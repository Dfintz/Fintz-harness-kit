/**
 * GdprExportStorageService Unit Tests
 *
 * Tests GDPR export storage with Azure Blob Storage
 */

import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

import { GdprExportStorageService } from '../../services/cloud/GdprExportStorageService';

// Mock dependencies
jest.mock('@azure/storage-blob', () => {
  const mockBlobServiceClient = {
    getContainerClient: jest.fn(),
  };

  return {
    BlobServiceClient: jest.fn(() => mockBlobServiceClient),
    generateBlobSASQueryParameters: jest.fn(() => ({
      toString: () => 'sv=2021-06-08&se=2023-01-01T00%3A00%3A00Z&sr=b&sp=r&sig=mocksignature',
    })),
    StorageSharedKeyCredential: jest.fn(),
    BlobSASPermissions: {
      parse: jest.fn(() => ({})),
    },
  };
});
jest.mock('@azure/identity');
jest.mock('../../utils/errorHandler', () => ({
  getErrorMessage: jest.fn((error: any) => error?.message || String(error)),
}));

describe('GdprExportStorageService', () => {
  let service: GdprExportStorageService;
  let mockBlobServiceClient: jest.Mocked<BlobServiceClient>;
  let mockContainerClient: jest.Mocked<ContainerClient>;
  let mockBlockBlobClient: jest.Mocked<BlockBlobClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    delete process.env.GDPR_EXPORT_CONTAINER;

    // Create mock clients
    mockBlockBlobClient = {
      uploadData: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      url: 'https://storage.blob.core.windows.net/gdpr-exports/test.json',
    } as any;

    mockContainerClient = {
      createIfNotExists: jest.fn(),
      getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
    } as any;

    mockBlobServiceClient = {
      getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
    } as any;

    // Set up BlobServiceClient static methods
    BlobServiceClient.fromConnectionString = jest.fn().mockReturnValue(mockBlobServiceClient);
    (BlobServiceClient as any).mockImplementation(() => mockBlobServiceClient);
  });

  describe('Constructor - Managed Identity', () => {
    it('should initialize with Managed Identity when account name is provided', () => {
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'testaccount';

      const mockCredential = {} as DefaultAzureCredential;
      (DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);

      service = new GdprExportStorageService();

      expect(DefaultAzureCredential).toHaveBeenCalled();
      expect(service.isConfigured()).toBe(true);
    });

    it('should throw error when Managed Identity initialization fails', () => {
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'testaccount';
      (DefaultAzureCredential as jest.Mock).mockImplementation(() => {
        throw new Error('Managed Identity failed');
      });

      expect(() => new GdprExportStorageService()).toThrow(
        'GDPR export storage initialization failed for Managed Identity'
      );
    });
  });

  describe('Constructor - Connection String', () => {
    it('should initialize with connection string and extract account name/key', () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING =
        'DefaultEndpointsProtocol=https;AccountName=testaccount;AccountKey=testkey123;EndpointSuffix=core.windows.net';

      service = new GdprExportStorageService();

      expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith(
        process.env.AZURE_STORAGE_CONNECTION_STRING
      );
      expect(service.isConfigured()).toBe(true);
    });

    it('should handle connection string without proper format gracefully', () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'invalid-connection-string';

      service = new GdprExportStorageService();

      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('Constructor - Not Configured', () => {
    it('should not initialize when no configuration is provided', () => {
      service = new GdprExportStorageService();

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('should return true when blob service client is initialized', () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-connection-string';

      service = new GdprExportStorageService();

      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when blob service client is not initialized', () => {
      service = new GdprExportStorageService();

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('uploadExport', () => {
    beforeEach(() => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-connection-string';
      service = new GdprExportStorageService();
    });

    it('should upload export data successfully', async () => {
      const userId = 'user-123';
      const requestId = 'req-456';
      const exportData = { user: { id: userId }, data: 'test' };

      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.uploadData.mockResolvedValue({} as any);

      const blobName = await service.uploadExport(userId, requestId, exportData);

      expect(blobName).toMatch(/^user-123\/req-456\/\d+\.json$/);
      expect(mockContainerClient.createIfNotExists).toHaveBeenCalled();
      expect(mockBlockBlobClient.uploadData).toHaveBeenCalled();
    });

    it('should throw error when not configured', async () => {
      // Clear the mocks so the service really isn't configured
      (BlobServiceClient.fromConnectionString as jest.Mock).mockReturnValue(null);
      (BlobServiceClient as any).mockImplementation(() => {
        throw new Error('Should not be called');
      });

      const unconfiguredService = new GdprExportStorageService();

      await expect(unconfiguredService.uploadExport('user-123', 'req-456', {})).rejects.toThrow(
        'Azure Blob Storage is not configured for GDPR exports'
      );
    });

    it('should validate userId and reject path traversal attempts', async () => {
      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);

      await expect(service.uploadExport('../admin', 'req-456', {})).rejects.toThrow(
        'Invalid userId'
      );
    });

    it('should validate requestId and reject special characters', async () => {
      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);

      await expect(service.uploadExport('user-123', 'req@456', {})).rejects.toThrow(
        'Invalid requestId'
      );
    });

    it('should allow valid identifiers with hyphens and underscores', async () => {
      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.uploadData.mockResolvedValue({} as any);

      const blobName = await service.uploadExport('user-123_test', 'req-456_export', {});

      expect(blobName).toMatch(/^user-123_test\/req-456_export\/\d+\.json$/);
    });
  });

  describe('generateSasUrl', () => {
    it('should return backend proxy marker when storage account key is not available', async () => {
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'testaccount';
      // No account key provided
      const mockCredential = {} as DefaultAzureCredential;
      (DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);

      service = new GdprExportStorageService();

      const blobName = 'user-123/req-456/123456.json';
      const result = await service.generateSasUrl(blobName);

      expect(result).toContain('__BACKEND_PROXY__');
      expect(result).toContain(blobName);
    });

    it('should generate SAS URL when storage account key is available', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING =
        'DefaultEndpointsProtocol=https;AccountName=testaccount;AccountKey=dGVzdGtleQ==;EndpointSuffix=core.windows.net';

      service = new GdprExportStorageService();

      const blobName = 'user-123/req-456/123456.json';
      const result = await service.generateSasUrl(blobName, 24);

      // Should return a properly formatted URL (mocked behavior)
      expect(result).toBeDefined();
    });

    it('should throw error when not configured', async () => {
      const unconfiguredService = new GdprExportStorageService();

      await expect(unconfiguredService.generateSasUrl('test.json')).rejects.toThrow(
        'Azure Blob Storage is not configured for GDPR exports'
      );
    });
  });

  describe('downloadExport', () => {
    beforeEach(() => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-connection-string';
      service = new GdprExportStorageService();
    });

    it('should download export data successfully', async () => {
      const blobName = 'user-123/req-456/123456.json';
      const mockData = Buffer.from('{"test": "data"}');

      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: {
          on: jest.fn((event, handler) => {
            if (event === 'data') handler(mockData);
            if (event === 'end') handler();
            return { on: jest.fn() };
          }),
        } as any,
      } as any);

      const result = await service.downloadExport(blobName);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockBlockBlobClient.download).toHaveBeenCalled();
    });

    it('should throw error when not configured', async () => {
      // Clear the mocks so the service really isn't configured
      (BlobServiceClient.fromConnectionString as jest.Mock).mockReturnValue(null);
      (BlobServiceClient as any).mockImplementation(() => {
        throw new Error('Should not be called');
      });

      const unconfiguredService = new GdprExportStorageService();

      await expect(unconfiguredService.downloadExport('test.json')).rejects.toThrow(
        'Azure Blob Storage is not configured for GDPR exports'
      );
    });
  });

  describe('deleteExport', () => {
    beforeEach(() => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-connection-string';
      service = new GdprExportStorageService();
    });

    it('should delete export successfully', async () => {
      const blobName = 'user-123/req-456/123456.json';

      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.delete.mockResolvedValue({} as any);

      const result = await service.deleteExport(blobName);

      expect(result).toBe(true);
      expect(mockBlockBlobClient.delete).toHaveBeenCalled();
    });

    it('should return false when blob not found (404)', async () => {
      const blobName = 'user-123/req-456/123456.json';

      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.delete.mockRejectedValue({ statusCode: 404 });

      const result = await service.deleteExport(blobName);

      expect(result).toBe(false);
    });

    it('should throw error for non-404 errors', async () => {
      const blobName = 'user-123/req-456/123456.json';

      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.delete.mockRejectedValue(new Error('Network error'));

      await expect(service.deleteExport(blobName)).rejects.toThrow('Network error');
    });

    it('should throw error when not configured', async () => {
      // Clear the mocks so the service really isn't configured
      (BlobServiceClient.fromConnectionString as jest.Mock).mockReturnValue(null);
      (BlobServiceClient as any).mockImplementation(() => {
        throw new Error('Should not be called');
      });

      const unconfiguredService = new GdprExportStorageService();

      await expect(unconfiguredService.deleteExport('test.json')).rejects.toThrow(
        'Azure Blob Storage is not configured for GDPR exports'
      );
    });
  });

  describe('exportExists', () => {
    beforeEach(() => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-connection-string';
      service = new GdprExportStorageService();
    });

    it('should return true when export exists', async () => {
      const blobName = 'user-123/req-456/123456.json';

      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.exists.mockResolvedValue(true);

      const result = await service.exportExists(blobName);

      expect(result).toBe(true);
    });

    it('should return false when export does not exist', async () => {
      const blobName = 'user-123/req-456/123456.json';

      mockContainerClient.createIfNotExists.mockResolvedValue({} as any);
      mockBlockBlobClient.exists.mockResolvedValue(false);

      const result = await service.exportExists(blobName);

      expect(result).toBe(false);
    });

    it('should return false when not configured', async () => {
      // Ensure env vars are cleared for this test
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      delete process.env.AZURE_STORAGE_ACCOUNT_NAME;

      const unconfiguredService = new GdprExportStorageService();

      const result = await unconfiguredService.exportExists('test.json');

      expect(result).toBe(false);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
