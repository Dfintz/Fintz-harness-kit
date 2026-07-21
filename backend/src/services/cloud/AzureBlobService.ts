import { Readable } from 'node:stream';

import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import sharp from 'sharp';

import { ServiceUnavailableError } from '../../utils/apiErrors';
import { createDefaultAzureCredentialOptions } from '../../utils/azureIdentity';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// Dynamic import for ESM module file-type
let fileTypeFromBuffer:
  | ((buffer: Buffer | Uint8Array) => Promise<{ ext: string; mime: string } | undefined>)
  | null = null;
void (async () => {
  try {
    const fileTypeModule = await import('file-type');
    // file-type v21+ exports fileTypeFromBuffer as a named export (ESM-only)
    const mod = fileTypeModule as Record<string, unknown>;
    const def = (fileTypeModule.default ?? {}) as Record<string, unknown>;
    const fn = (mod.fileTypeFromBuffer ?? def.fileTypeFromBuffer) as
      | typeof fileTypeFromBuffer
      | undefined;
    fileTypeFromBuffer = fn ?? null;
  } catch (_error: unknown) {
    logger.warn('file-type module not available, using basic MIME type validation');
  }
})();

// Use global Buffer
const _BufferConstructor = global.Buffer;

/**
 * Image size variant configuration
 */
export interface ImageSizeVariant {
  name: string;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Image optimization options
 */
export interface ImageOptimizationOptions {
  quality?: number; // 1-100 for JPEG, 0-100 for WebP
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  compress?: boolean;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
  fileSize?: number;
}

/**
 * Azure Blob Storage Service for managing image uploads and downloads
 * Supports both connection string (for local dev) and Managed Identity (for production)
 * Features:
 * - Image optimization (compression, resizing)
 * - Multiple size variants (thumbnail, medium, large)
 * - Enhanced file type validation with magic numbers
 * - Automatic format conversion
 * Documentation: https://docs.microsoft.com/en-us/azure/storage/blobs/
 */
export class AzureBlobService {
  private readonly blobServiceClient: BlobServiceClient | null = null;
  private readonly containerName: string;
  private readonly connectionString: string | null = null;
  private readonly storageAccountName: string | null = null;

  // Image size variants
  public readonly SIZE_VARIANTS: { [key: string]: ImageSizeVariant } = {
    thumbnail: { name: 'thumb', width: 150, height: 150, fit: 'cover' },
    small: { name: 'small', width: 400, height: 400, fit: 'inside' },
    medium: { name: 'medium', width: 800, height: 800, fit: 'inside' },
    large: { name: 'large', width: 1920, height: 1920, fit: 'inside' },
  };

  // Allowed image MIME types (SVG intentionally excluded — can contain embedded scripts)
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ];

  // Maximum file size (10MB)
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
    this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER ?? 'images';

    // Try Managed Identity first (for production Azure deployments)
    if (this.storageAccountName && !this.connectionString) {
      try {
        const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
        const accountUrl = `https://${this.storageAccountName}.blob.core.windows.net`;
        this.blobServiceClient = new BlobServiceClient(accountUrl, credential);
      } catch (error: unknown) {
        logger.error('Failed to initialize Azure Blob Storage with Managed Identity:', error);
      }
    }
    // Fall back to connection string (for local development)
    else if (this.connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    }
  }

  /**
   * Check if Azure Blob Storage is configured
   */
  public isConfigured(): boolean {
    return this.blobServiceClient !== null;
  }

  /**
   * Initialize container (create if it doesn't exist)
   */
  private async ensureContainerExists(): Promise<ContainerClient> {
    if (!this.blobServiceClient) {
      throw new Error(
        'Azure Blob Storage is not configured. Please set AZURE_STORAGE_ACCOUNT_NAME (for Managed Identity) or AZURE_STORAGE_CONNECTION_STRING (for local development) environment variable.'
      );
    }

    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

    // Create container if it doesn't exist (private access — images served via signed URLs)
    try {
      await containerClient.createIfNotExists();
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      logger.error('Azure Blob container initialization failed', {
        container: this.containerName,
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableError(
        'Image storage service is temporarily unavailable. Please try again later.'
      );
    }

    return containerClient;
  }

  /**
   * Validate file buffer using magic numbers (file signature)
   * @param fileBuffer - Buffer containing file data
   * @param declaredMimeType - MIME type from upload
   * @returns Validation result with detected type
   */
  public async validateFile(
    fileBuffer: Buffer | Uint8Array,
    declaredMimeType: string
  ): Promise<FileValidationResult> {
    // Check file size
    if (fileBuffer.length > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
        fileSize: fileBuffer.length,
      };
    }

    // Check if file is empty
    if (fileBuffer.length === 0) {
      return {
        valid: false,
        error: 'File is empty',
      };
    }

    try {
      if (!fileTypeFromBuffer) {
        // Fall back to basic MIME type validation when file-type module is unavailable
        logger.warn('file-type module not loaded, falling back to basic MIME validation');
        if (!this.ALLOWED_MIME_TYPES.includes(declaredMimeType.toLowerCase())) {
          return {
            valid: false,
            error: `File type ${declaredMimeType} is not allowed`,
            detectedMimeType: declaredMimeType,
          };
        }
        return {
          valid: true,
          detectedMimeType: declaredMimeType,
          fileSize: fileBuffer.length,
        };
      }

      // Detect actual file type using magic numbers
      const fileType = await fileTypeFromBuffer(fileBuffer);

      if (!fileType) {
        return {
          valid: false,
          error: 'Unable to determine file type',
        };
      }

      // Check if detected MIME type is allowed
      if (!this.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
        return {
          valid: false,
          error: `File type ${fileType.mime} is not allowed`,
          detectedMimeType: fileType.mime,
        };
      }

      // Verify declared MIME type matches detected type (prevent MIME type spoofing)
      const normalizedDeclared = declaredMimeType.toLowerCase().replace('jpg', 'jpeg');
      const normalizedDetected = fileType.mime.toLowerCase();

      if (normalizedDeclared !== normalizedDetected) {
        logger.warn(`MIME type mismatch: declared=${declaredMimeType}, detected=${fileType.mime}`);
        // Still allow if detected type is valid, but log warning
      }

      return {
        valid: true,
        detectedMimeType: fileType.mime,
        fileSize: fileBuffer.length,
      };
    } catch (error: unknown) {
      logger.error('Error validating file:', error);
      return {
        valid: false,
        error: 'File validation failed',
      };
    }
  }

  /**
   * Optimize image buffer
   * @param fileBuffer - Original image buffer
   * @param options - Optimization options
   * @returns Optimized image buffer and content type
   */
  public async optimizeImage(
    fileBuffer: Buffer,
    options: ImageOptimizationOptions = {}
  ): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      let pipeline = sharp(fileBuffer);

      // Get image metadata
      const metadata = await pipeline.metadata();
      logger.info(
        `Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}, size: ${fileBuffer.length} bytes`
      );

      // Apply resize if specified
      if (options.resize) {
        pipeline = pipeline.resize({
          width: options.resize.width,
          height: options.resize.height,
          fit: options.resize.fit ?? 'inside',
          withoutEnlargement: true, // Don't upscale images
        });
      }

      // Rotate based on EXIF orientation
      pipeline = pipeline.rotate();

      // Convert to specified format or optimize existing format
      const format = options.format ?? (metadata.format as string);
      const quality = options.quality ?? 85;

      switch (format) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({
            quality,
            progressive: true, // Progressive JPEGs load faster
            mozjpeg: true, // Use mozjpeg for better compression
          });
          break;
        case 'png':
          pipeline = pipeline.png({
            compressionLevel: 9,
            progressive: true,
          });
          break;
        case 'webp':
          pipeline = pipeline.webp({
            quality,
            effort: 6, // Balance between speed and compression
          });
          break;
        case 'avif':
          pipeline = pipeline.avif({
            quality,
            effort: 4,
          });
          break;
        default:
          // Keep original format with optimization
          if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
            pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
          }
      }

      const optimizedBuffer = await pipeline.toBuffer();
      const compressionRatio = ((1 - optimizedBuffer.length / fileBuffer.length) * 100).toFixed(2);
      logger.info(
        `Optimized image: size: ${optimizedBuffer.length} bytes, compression: ${compressionRatio}%`
      );

      // Determine content type
      const contentType =
        format === 'jpeg' || format === 'jpg'
          ? 'image/jpeg'
          : format === 'png'
            ? 'image/png'
            : format === 'webp'
              ? 'image/webp'
              : format === 'avif'
                ? 'image/avif'
                : 'image/jpeg';

      return { buffer: optimizedBuffer, contentType };
    } catch (error: unknown) {
      logger.error('Error optimizing image:', error);
      throw new Error(`Image optimization failed: ${getErrorMessage(error, 'Unknown error')}`);
    }
  }

  /**
   * Upload an image to Azure Blob Storage with optimization
   * @param fileName - Name of the file to save
   * @param fileBuffer - Buffer containing file data
   * @param contentType - MIME type of the file (e.g., 'image/png', 'image/jpeg')
   * @param options - Optional optimization settings
   * @returns URL of the uploaded blob
   */
  public async uploadImage(
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
    options?: ImageOptimizationOptions
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.ensureContainerExists();

    // Optimize image if options provided
    let uploadBuffer = fileBuffer;
    let uploadContentType = contentType;

    if (options) {
      const optimized = await this.optimizeImage(fileBuffer, options);
      uploadBuffer = optimized.buffer;
      uploadContentType = optimized.contentType;
    }

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Upload the file
    try {
      await blockBlobClient.uploadData(uploadBuffer, {
        blobHTTPHeaders: {
          blobContentType: uploadContentType,
          blobCacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
      });
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      logger.error('Azure Blob upload failed', {
        fileName,
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableError(
        'Image storage service is temporarily unavailable. Please try again later.'
      );
    }

    return blockBlobClient.url;
  }

  /**
   * Upload image with multiple size variants
   * @param fileName - Base name of the file (without extension)
   * @param fileBuffer - Buffer containing file data
   * @param contentType - MIME type of the file
   * @param variants - Array of size variant keys (e.g., ['thumbnail', 'medium', 'large'])
   * @returns Object with URLs for each variant and original
   */
  public async uploadImageWithVariants(
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
    variants: string[] = ['thumbnail', 'medium', 'large']
  ): Promise<{ original: string; variants: { [key: string]: string } }> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const urls: { [key: string]: string } = {};

    // Upload original (optimized)
    const originalUrl = await this.uploadImage(fileName, fileBuffer, contentType, {
      quality: 90,
      compress: true,
    });

    // Upload variants
    for (const variantKey of variants) {
      const variant = this.SIZE_VARIANTS[variantKey];
      if (!variant) {
        logger.warn(`Unknown variant: ${variantKey}`);
        continue;
      }

      const variantFileName = fileName.replace(/\.(\w+)$/, `-${variant.name}.$1`);

      try {
        const variantUrl = await this.uploadImage(variantFileName, fileBuffer, contentType, {
          resize: {
            width: variant.width,
            height: variant.height,
            fit: variant.fit,
          },
          quality: 85,
          format: 'webp', // Use WebP for variants for better compression
        });
        urls[variantKey] = variantUrl;
      } catch (error: unknown) {
        logger.error(`Error uploading variant ${variantKey}:`, error);
      }
    }

    return {
      original: originalUrl,
      variants: urls,
    };
  }

  /**
   * Upload an image from a stream
   * @param fileName - Name of the file to save
   * @param stream - Readable stream containing file data
   * @param contentType - MIME type of the file
   * @param size - Size of the file in bytes
   * @returns URL of the uploaded blob
   */
  public async uploadImageFromStream(
    fileName: string,
    stream: Readable,
    contentType: string,
    size: number
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Upload from stream
    try {
      await blockBlobClient.uploadStream(stream, size, 5, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      logger.error('Azure Blob stream upload failed', {
        fileName,
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableError(
        'Image storage service is temporarily unavailable. Please try again later.'
      );
    }

    return blockBlobClient.url;
  }

  /**
   * Download an image from Azure Blob Storage
   * @param fileName - Name of the file to download
   * @returns Buffer containing the file data
   */
  public async downloadImage(fileName: string): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    let downloadResponse;
    try {
      downloadResponse = await blockBlobClient.download();
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        throw new Error('Image not found');
      }
      logger.error('Azure Blob download failed', {
        fileName,
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableError(
        'Image storage service is temporarily unavailable. Please try again later.'
      );
    }

    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download image: no stream available');
    }

    return this.streamToBuffer(downloadResponse.readableStreamBody);
  }

  /**
   * Get the URL of an image without downloading it
   * @param fileName - Name of the file
   * @returns URL of the blob
   */
  public async getImageUrl(fileName: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    return blockBlobClient.url;
  }

  /**
   * Delete an image from Azure Blob Storage
   * @param fileName - Name of the file to delete
   * @returns True if deleted, false if not found
   */
  public async deleteImage(fileName: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    try {
      await blockBlobClient.delete();
      return true;
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return false;
      }
      logger.error('Azure Blob delete failed', {
        fileName,
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableError(
        'Image storage service is temporarily unavailable. Please try again later.'
      );
    }
  }

  /**
   * List all images in the container
   * @param prefix - Optional prefix to filter results
   * @returns Array of blob names
   */
  public async listImages(prefix?: string): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.ensureContainerExists();
    const images: string[] = [];

    const options = prefix ? { prefix } : {};

    for await (const blob of containerClient.listBlobsFlat(options)) {
      images.push(blob.name);
    }

    return images;
  }

  /**
   * Check if an image exists
   * @param fileName - Name of the file to check
   * @returns True if exists, false otherwise
   */
  public async imageExists(fileName: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    return blockBlobClient.exists();
  }

  /**
   * Helper method to convert stream to buffer
   */
  private async streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data: Buffer | string) => {
        chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }
}

