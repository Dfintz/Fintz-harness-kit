import { Response } from 'express';

import { RequestWithFile } from '../../types/express';
import { extractPaginationOptions, paginateArray } from '../../utils/pagination';

// Create mock instance methods BEFORE mocking the class
const mockIsConfigured = jest.fn();
const mockValidateFile = jest.fn();
const mockUploadImage = jest.fn();
const mockUploadImageWithVariants = jest.fn();
const mockImageExists = jest.fn();
const mockDownloadImage = jest.fn();
const mockGetImageUrl = jest.fn();
const mockDeleteImage = jest.fn();
const mockListImages = jest.fn();
const mockOptimizeImage = jest.fn();

const mockAzureBlobInstance = {
  isConfigured: mockIsConfigured,
  validateFile: mockValidateFile,
  uploadImage: mockUploadImage,
  uploadImageWithVariants: mockUploadImageWithVariants,
  imageExists: mockImageExists,
  downloadImage: mockDownloadImage,
  getImageUrl: mockGetImageUrl,
  deleteImage: mockDeleteImage,
  listImages: mockListImages,
  optimizeImage: mockOptimizeImage,
  SIZE_VARIANTS: {
    thumbnail: { name: 'thumb', width: 150, height: 150, fit: 'cover' as const },
    small: { name: 'small', width: 400, height: 400, fit: 'inside' as const },
    medium: { name: 'medium', width: 800, height: 800, fit: 'inside' as const },
    large: { name: 'large', width: 1920, height: 1920, fit: 'inside' as const },
  },
};

// Mock AzureBlobService BEFORE importing controller
jest.mock('../../services/infrastructure', () => ({
  AzureBlobService: jest.fn().mockImplementation(() => mockAzureBlobInstance),
}));

// Mock fs for local filesystem fallback
jest.mock('node:fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
    readFile: jest.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
  },
}));

// Mock pagination utilities
jest.mock('../../utils/pagination');
// Import controller AFTER mocking
import { ImageController } from '../../controllers/imageController';

describe('imageController', () => {
  let controller: ImageController;
  let mockRequest: Partial<RequestWithFile>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ImageController();
    jest.clearAllMocks();

    // Reset all mocks to default return values
    mockIsConfigured.mockReturnValue(true);
    mockValidateFile.mockResolvedValue({
      valid: true,
      detectedMimeType: 'image/jpeg',
      fileSize: 12345,
    });
    mockUploadImage.mockResolvedValue('https://storage.azure.com/test.jpg');
    mockUploadImageWithVariants.mockResolvedValue({
      original: 'https://storage.azure.com/original.jpg',
      variants: {},
    });
    mockImageExists.mockResolvedValue(true);
    mockDownloadImage.mockResolvedValue(Buffer.from('image-data'));
    mockGetImageUrl.mockResolvedValue('https://storage.azure.com/test.jpg');
    mockDeleteImage.mockResolvedValue(true);
    mockListImages.mockResolvedValue([]);

    mockRequest = {
      params: {},
      query: {},
      file: undefined,
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
  });

  describe('uploadImage', () => {
    beforeEach(() => {
      mockRequest.file = {
        buffer: Buffer.from('test-image-data'),
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        size: 12345,
      } as Express.Multer.File;

      mockIsConfigured.mockReturnValue(true);
      mockValidateFile.mockResolvedValue({
        valid: true,
        detectedMimeType: 'image/jpeg',
        fileSize: 12345,
      });
    });

    it('should return 400 if no file is uploaded', async () => {
      mockRequest.file = undefined;

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should save to local filesystem when Azure Blob Storage is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      mockOptimizeImage.mockResolvedValue({
        buffer: Buffer.from('optimized-data'),
        contentType: 'image/jpeg',
      });

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          storage: 'local',
          url: expect.stringContaining('/api/v2/images/download/'),
        })
      );
    });

    it('should return 400 if file validation fails', async () => {
      mockValidateFile.mockResolvedValue({
        valid: false,
        error: 'Invalid file type',
        detectedMimeType: 'application/octet-stream',
      });

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should upload image with default optimization options', async () => {
      const mockImageUrl = 'https://storage.azure.com/test-image.jpg';
      mockUploadImage.mockResolvedValue(mockImageUrl);

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.stringMatching(/\.jpg$/),
        expect.any(Buffer),
        'image/jpeg',
        expect.objectContaining({
          quality: 85,
          compress: true,
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Image uploaded successfully',
          url: 'http://localhost:3000/api/v2/images/download/test-image.jpg',
          originalName: 'test-image.jpg',
          optimizationApplied: true,
        })
      );
    });

    it('should upload image with custom quality', async () => {
      mockRequest.query = { quality: '95' };
      mockUploadImage.mockResolvedValue('test-url');

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg',
        expect.objectContaining({
          quality: 95,
        })
      );
    });

    it('should clamp quality between 1 and 100', async () => {
      mockRequest.query = { quality: '150' };
      mockUploadImage.mockResolvedValue('test-url');

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg',
        expect.objectContaining({
          quality: 100,
        })
      );
    });

    it('should upload image with custom format', async () => {
      mockRequest.query = { format: 'webp' };
      mockUploadImage.mockResolvedValue('test-url');

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.stringMatching(/\.webp$/),
        expect.any(Buffer),
        'image/jpeg',
        expect.objectContaining({
          format: 'webp',
        })
      );
    });

    it('should upload image with resize option', async () => {
      mockRequest.query = { resize: 'thumbnail' };
      mockUploadImage.mockResolvedValue('test-url');

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg',
        expect.objectContaining({
          resize: {
            width: 150,
            height: 150,
            fit: 'cover',
          },
        })
      );
    });

    it('should upload image with custom dimensions', async () => {
      mockRequest.query = { width: '800', height: '600' };
      mockUploadImage.mockResolvedValue('test-url');

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg',
        expect.objectContaining({
          resize: {
            width: 800,
            height: 600,
            fit: 'inside',
          },
        })
      );
    });

    it('should upload image with multiple variants', async () => {
      mockRequest.query = { variants: 'true' };
      const mockResult = {
        original: 'https://storage.azure.com/original.jpg',
        variants: {
          thumbnail: 'https://storage.azure.com/thumbnail.jpg',
          small: 'https://storage.azure.com/small.jpg',
        },
      };
      mockUploadImageWithVariants.mockResolvedValue(mockResult);

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockUploadImageWithVariants).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg',
        ['thumbnail', 'small', 'medium', 'large']
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Image uploaded successfully with variants',
          url: 'http://localhost:3000/api/v2/images/download/original.jpg',
          variants: {
            thumbnail: 'http://localhost:3000/api/v2/images/download/thumbnail.jpg',
            small: 'http://localhost:3000/api/v2/images/download/small.jpg',
          },
        })
      );
    });

    it('should fall back to local storage on Azure upload error', async () => {
      mockUploadImage.mockRejectedValue(new Error('Upload failed'));

      await controller.uploadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ storage: 'local' }));
    });
  });

  describe('downloadImage', () => {
    beforeEach(() => {
      mockIsConfigured.mockReturnValue(true);
    });

    it('should return 400 if fileName is not provided', async () => {
      mockRequest.params = {};

      await controller.downloadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should fall back to local filesystem when Azure Blob Storage is not configured', async () => {
      mockRequest.params = { fileName: 'test.jpg' };
      mockIsConfigured.mockReturnValue(false);

      await controller.downloadImage(mockRequest as RequestWithFile, mockResponse as Response);

      // Controller falls back to local filesystem; when file doesn't exist locally it returns 404
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should return 404 if image does not exist', async () => {
      mockRequest.params = { fileName: 'non-existent.jpg' };
      mockImageExists.mockResolvedValue(false);

      await controller.downloadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should download and return image with correct content type', async () => {
      mockRequest.params = { fileName: 'test-image.jpg' };
      const mockBuffer = Buffer.from('image-data');
      mockImageExists.mockResolvedValue(true);
      mockDownloadImage.mockResolvedValue(mockBuffer);

      await controller.downloadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockDownloadImage).toHaveBeenCalledWith('test-image.jpg');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="test-image.jpg"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('should handle PNG files with correct content type', async () => {
      mockRequest.params = { fileName: 'test-image.png' };
      mockImageExists.mockResolvedValue(true);
      mockDownloadImage.mockResolvedValue(Buffer.from('data'));

      await controller.downloadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    });

    it('should return 404 on download error when local file also missing', async () => {
      mockRequest.params = { fileName: 'test.jpg' };
      mockImageExists.mockResolvedValue(true);
      mockDownloadImage.mockRejectedValue(new Error('Download failed'));

      await controller.downloadImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('getImageUrl', () => {
    beforeEach(() => {
      mockIsConfigured.mockReturnValue(true);
    });

    it('should return 400 if fileName is not provided', async () => {
      mockRequest.params = {};

      await controller.getImageUrl(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 503 if Azure Blob Storage is not configured', async () => {
      mockRequest.params = { fileName: 'test.jpg' };
      mockIsConfigured.mockReturnValue(false);

      await controller.getImageUrl(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('should return 404 if image does not exist', async () => {
      mockRequest.params = { fileName: 'non-existent.jpg' };
      mockImageExists.mockResolvedValue(false);

      await controller.getImageUrl(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return image URL successfully', async () => {
      mockRequest.params = { fileName: 'test-image.jpg' };
      const mockUrl = 'https://storage.azure.com/test-image.jpg';
      mockImageExists.mockResolvedValue(true);
      mockGetImageUrl.mockResolvedValue(mockUrl);

      await controller.getImageUrl(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockGetImageUrl).toHaveBeenCalledWith('test-image.jpg');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        fileName: 'test-image.jpg',
        url: 'http://localhost:3000/api/v2/images/download/test-image.jpg',
      });
    });

    it('should return 500 on error', async () => {
      mockRequest.params = { fileName: 'test.jpg' };
      mockImageExists.mockResolvedValue(true);
      mockGetImageUrl.mockRejectedValue(new Error('URL generation failed'));

      await controller.getImageUrl(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('deleteImage', () => {
    beforeEach(() => {
      mockIsConfigured.mockReturnValue(true);
    });

    it('should return 400 if fileName is not provided', async () => {
      mockRequest.params = {};

      await controller.deleteImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 503 if Azure Blob Storage is not configured', async () => {
      mockRequest.params = { fileName: 'test.jpg' };
      mockIsConfigured.mockReturnValue(false);

      await controller.deleteImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('should delete image successfully', async () => {
      mockRequest.params = { fileName: 'test-image.jpg' };
      mockDeleteImage.mockResolvedValue(true);

      await controller.deleteImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockDeleteImage).toHaveBeenCalledWith('test-image.jpg');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Image deleted successfully',
        fileName: 'test-image.jpg',
      });
    });

    it('should return 404 if image was not found for deletion', async () => {
      mockRequest.params = { fileName: 'non-existent.jpg' };
      mockDeleteImage.mockResolvedValue(false);

      await controller.deleteImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 500 on delete error', async () => {
      mockRequest.params = { fileName: 'test.jpg' };
      mockDeleteImage.mockRejectedValue(new Error('Delete failed'));

      await controller.deleteImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('validateImage', () => {
    beforeEach(() => {
      mockRequest.file = {
        buffer: Buffer.from('test-data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 12345,
      } as Express.Multer.File;

      mockIsConfigured.mockReturnValue(true);
    });

    it('should return 400 if no file is uploaded', async () => {
      mockRequest.file = undefined;

      await controller.validateImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 503 if Azure Blob Storage is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);

      await controller.validateImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('should validate a valid image successfully', async () => {
      mockValidateFile.mockResolvedValue({
        valid: true,
        detectedMimeType: 'image/jpeg',
        fileSize: 12345,
      });

      await controller.validateImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockValidateFile).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg');

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        valid: true,
        message: 'File is valid',
        detectedMimeType: 'image/jpeg',
        declaredMimeType: 'image/jpeg',
        fileSize: 12345,
        fileName: 'test.jpg',
      });
    });

    it('should return 400 for invalid image', async () => {
      mockValidateFile.mockResolvedValue({
        valid: false,
        error: 'Invalid magic number',
        detectedMimeType: 'application/octet-stream',
      });

      await controller.validateImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: false,
          error: 'Invalid magic number',
        })
      );
    });

    it('should return 500 on validation error', async () => {
      mockValidateFile.mockRejectedValue(new Error('Validation error'));

      await controller.validateImage(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('listImages', () => {
    beforeEach(() => {
      mockIsConfigured.mockReturnValue(true);
      (extractPaginationOptions as jest.Mock).mockReturnValue({
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
    });

    it('should return 503 if Azure Blob Storage is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);

      await controller.listImages(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('should list images with pagination', async () => {
      const mockImages = [
        { name: 'image1.jpg', url: 'url1', lastModified: new Date('2025-01-01') },
        { name: 'image2.jpg', url: 'url2', lastModified: new Date('2025-01-02') },
      ];

      mockListImages.mockResolvedValue(mockImages);
      (paginateArray as jest.Mock).mockReturnValue({
        data: mockImages,
        total: 2,
        page: 1,
        limit: 10,
      });

      await controller.listImages(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockListImages).toHaveBeenCalledWith(undefined);
      expect(paginateArray).toHaveBeenCalledWith(
        mockImages.map(img => ({ name: img })),
        expect.objectContaining({
          page: 1,
          limit: 10,
        }),
        expect.any(Function)
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockImages,
        total: 2,
        page: 1,
        limit: 10,
      });
    });

    it('should list images with prefix filter', async () => {
      mockRequest.query = { prefix: 'avatars/' };
      mockListImages.mockResolvedValue([]);
      (paginateArray as jest.Mock).mockReturnValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await controller.listImages(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockListImages).toHaveBeenCalledWith('avatars/');
    });

    it('should return 500 on list error', async () => {
      mockListImages.mockRejectedValue(new Error('List failed'));

      await controller.listImages(mockRequest as RequestWithFile, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });
});
