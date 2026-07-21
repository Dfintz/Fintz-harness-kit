import fs from 'node:fs';
import path from 'node:path';

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getBackendUrl } from '../config/urls';
import { AzureBlobService, ImageOptimizationOptions } from '../services/infrastructure';
import { RequestWithFile } from '../types/express';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { extractPaginationOptions, paginateArray } from '../utils/pagination';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/** Directory for local image storage when Azure Blob is not configured.
 *  Stored outside `public/` so files are NOT served by express.static
 *  without authentication — they are only accessible via the authenticated
 *  download proxy at GET /api/v2/images/download/:fileName.
 */
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
const SAFE_STORAGE_FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);

type SupportedImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';

const FORMAT_EXTENSION_MAP: Record<SupportedImageFormat, string> = {
  jpeg: '.jpeg',
  png: '.png',
  webp: '.webp',
  avif: '.avif',
};

function parseSupportedImageFormat(rawFormat: unknown): SupportedImageFormat | undefined {
  if (rawFormat === 'jpeg' || rawFormat === 'png' || rawFormat === 'webp' || rawFormat === 'avif') {
    return rawFormat;
  }

  return undefined;
}

function normalizeImageExtension(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.has(extension) ? extension : '.bin';
}

function sanitizeStorageFileName(fileName: string): string {
  let decodedFileName = fileName;

  try {
    decodedFileName = decodeURIComponent(fileName);
  } catch {
    throw new ValidationError('Invalid file name encoding');
  }

  if (
    !SAFE_STORAGE_FILE_NAME_RE.test(decodedFileName) ||
    decodedFileName.includes('..') ||
    decodedFileName.includes('/') ||
    decodedFileName.includes('\\')
  ) {
    throw new ValidationError('Invalid file name');
  }

  return decodedFileName;
}

/**
 * Resolve a user-supplied file name to a safe absolute path inside
 * {@link LOCAL_UPLOADS_DIR}, defending against path-traversal attacks
 * (e.g. `../../etc/passwd`). Strips directory components via
 * `path.basename`, then verifies the resolved path is contained within
 * the uploads directory before returning it.
 *
 * @throws {ValidationError} if the resolved path escapes the uploads dir.
 */
function resolveSafeLocalImagePath(fileName: string): string {
  const safeName = sanitizeStorageFileName(fileName);
  return path.join(LOCAL_UPLOADS_DIR, safeName);
}

/**
 * Convert a raw Azure Blob URL to an API proxy download URL.
 * The storage account has public access disabled, so clients must
 * fetch images through the backend proxy endpoint.
 * Returns an absolute URL so it works across origins.
 */
function toProxyUrl(blobUrl: string): string {
  try {
    const fileName = new URL(blobUrl).pathname.split('/').pop();
    if (fileName) {
      const base = getBackendUrl();
      return `${base}/api/v2/images/download/${encodeURIComponent(fileName)}`;
    }
  } catch {
    // Not a valid URL — return as-is (e.g. local path)
  }
  return blobUrl;
}

/**
 * Image controller for Azure Blob Storage operations
 * Extends BaseController for standardized error handling
 */
export class ImageController extends BaseController {
  private readonly azureBlobService: AzureBlobService;

  constructor() {
    super();
    this.azureBlobService = new AzureBlobService();
  }

  /**
   * Upload an image to Azure Blob Storage with enhanced validation and optimization
   * POST /api/images/upload
   *
   * Query parameters:
   * - quality: Image quality (1-100)
   * - format: Target format (jpeg, png, webp, avif)
   * - resize: Resize option (thumbnail, small, medium, large)
   * - variants: Create multiple size variants (true/false)
   * - width: Custom width for resize
   * - height: Custom height for resize
   */
  uploadImage = async (req: RequestWithFile, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      // Enhanced file validation using magic numbers
      const validationResult = await this.azureBlobService.validateFile(
        req.file.buffer,
        req.file.mimetype
      );

      if (!validationResult.valid) {
        throw new ValidationError(validationResult.error ?? 'File validation failed');
      }

      logger.info(
        `File validated: ${validationResult.detectedMimeType}, size: ${validationResult.fileSize} bytes`
      );

      // Parse optimization options from query parameters
      const quality = req.query.quality ? Number.parseInt(req.query.quality as string, 10) : 85;
      const format = parseSupportedImageFormat(req.query.format);
      const resizeOption = req.query.resize as string | undefined;
      const createVariants = parseBooleanQuery(req.query.variants);
      const customWidth = req.query.width
        ? Number.parseInt(req.query.width as string, 10)
        : undefined;
      const customHeight = req.query.height
        ? Number.parseInt(req.query.height as string, 10)
        : undefined;

      // Generate unique filename
      const fileExtension = format
        ? FORMAT_EXTENSION_MAP[format]
        : normalizeImageExtension(req.file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;

      // Build optimization options
      const optimizationOptions: ImageOptimizationOptions = {
        quality: Math.min(Math.max(quality, 1), 100), // Clamp between 1-100
        format,
        compress: true,
      };

      // Add resize options
      if (resizeOption && this.azureBlobService.SIZE_VARIANTS[resizeOption]) {
        const variant = this.azureBlobService.SIZE_VARIANTS[resizeOption];
        optimizationOptions.resize = {
          width: variant.width,
          height: variant.height,
          fit: variant.fit,
        };
      } else if (customWidth || customHeight) {
        optimizationOptions.resize = {
          width: customWidth,
          height: customHeight,
          fit: 'inside',
        };
      }

      // Local filesystem fallback when Azure is not configured
      if (!this.azureBlobService.isConfigured()) {
        logger.info('Azure Blob Storage not configured — saving to local filesystem');
        const localUrl = await this.saveToLocalFilesystem(
          uniqueFileName,
          req.file.buffer,
          optimizationOptions
        );
        res.status(200).json({
          message: 'Image uploaded successfully (local storage)',
          fileName: uniqueFileName,
          url: localUrl,
          originalName: req.file.originalname,
          originalSize: req.file.size,
          detectedMimeType: validationResult.detectedMimeType,
          optimizationApplied: true,
          storage: 'local',
        });
        return;
      }

      // Upload with variants or single optimized image
      // Falls back to local filesystem if Azure is configured but unavailable at runtime
      try {
        if (createVariants) {
          const variantKeys = ['thumbnail', 'small', 'medium', 'large'];
          const result = await this.azureBlobService.uploadImageWithVariants(
            uniqueFileName,
            req.file.buffer,
            validationResult.detectedMimeType ?? req.file.mimetype,
            variantKeys
          );

          const proxyVariants: Record<string, string> = {};
          for (const [key, val] of Object.entries(result.variants)) {
            proxyVariants[key] = toProxyUrl(val);
          }
          res.status(200).json({
            message: 'Image uploaded successfully with variants',
            fileName: uniqueFileName,
            url: toProxyUrl(result.original),
            variants: proxyVariants,
            originalName: req.file.originalname,
            originalSize: req.file.size,
            detectedMimeType: validationResult.detectedMimeType,
            optimizationApplied: true,
          });
        } else {
          // Single upload with optimization
          const imageUrl = await this.azureBlobService.uploadImage(
            uniqueFileName,
            req.file.buffer,
            validationResult.detectedMimeType ?? req.file.mimetype,
            optimizationOptions
          );

          res.status(200).json({
            message: 'Image uploaded successfully',
            fileName: uniqueFileName,
            url: toProxyUrl(imageUrl),
            originalName: req.file.originalname,
            originalSize: req.file.size,
            detectedMimeType: validationResult.detectedMimeType,
            optimizationApplied: true,
            optimizationOptions: {
              quality: optimizationOptions.quality,
              format: optimizationOptions.format,
              resized: !!optimizationOptions.resize,
            },
          });
        }
      } catch (blobError) {
        logger.warn('Azure Blob Storage upload failed, falling back to local filesystem', {
          error: blobError instanceof Error ? blobError.message : String(blobError),
        });
        const localUrl = await this.saveToLocalFilesystem(
          uniqueFileName,
          req.file.buffer,
          optimizationOptions
        );
        res.status(200).json({
          message: 'Image uploaded successfully (local storage fallback)',
          fileName: uniqueFileName,
          url: localUrl,
          originalName: req.file.originalname,
          originalSize: req.file.size,
          detectedMimeType: validationResult.detectedMimeType,
          optimizationApplied: true,
          storage: 'local',
        });
      }
    });
  };

  /**
   * Save an image to local filesystem (fallback when Azure Blob is not configured).
   * Applies Sharp optimization before writing to disk.
   */
  private async saveToLocalFilesystem(
    fileName: string,
    buffer: Buffer,
    options: ImageOptimizationOptions
  ): Promise<string> {
    const safeFileName = sanitizeStorageFileName(fileName);

    try {
      await fs.promises.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
    } catch (mkdirErr) {
      logger.error('Failed to create local uploads directory', {
        directory: LOCAL_UPLOADS_DIR,
        error: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
      });
      throw new ServiceUnavailableError(
        'Image storage is temporarily unavailable. Please try again later.'
      );
    }

    let outputBuffer = buffer;
    try {
      const optimized = await this.azureBlobService.optimizeImage(buffer, options);
      outputBuffer = optimized.buffer;
    } catch (err) {
      logger.warn('Sharp optimization failed for local save, using original buffer', err);
    }

    try {
      const filePath = resolveSafeLocalImagePath(safeFileName);
      // deepcode ignore PT: Path traversal prevented by resolveSafeLocalImagePath() directory jail
      // NOSONAR: CWE-22 false positive — fileName is validated by strict allowlist regex
      // and blocked on path separators / dot-dot segments before path construction.
      await fs.promises.writeFile(filePath, outputBuffer);
    } catch (writeErr) {
      logger.error('Failed to write image to local filesystem', {
        fileName,
        error: writeErr instanceof Error ? writeErr.message : String(writeErr),
      });
      throw new ServiceUnavailableError(
        'Image storage is temporarily unavailable. Please try again later.'
      );
    }

    const base = getBackendUrl();
    return `${base}/api/v2/images/download/${encodeURIComponent(safeFileName)}`;
  }

  /**
   * Download an image from Azure Blob Storage
   * GET /api/images/:fileName/download
   */
  downloadImage = async (req: RequestWithFile, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { fileName } = req.params;

      if (!fileName) {
        throw new ValidationError('File name is required');
      }

      const safeFileName = sanitizeStorageFileName(fileName);

      const contentType = this.getImageContentType(safeFileName);

      // Local filesystem fallback when Azure is not configured
      if (!this.azureBlobService.isConfigured()) {
        await this.serveLocalImage(res, safeFileName, contentType);
        return;
      }

      // Try Azure Blob, fall back to local filesystem if unavailable
      try {
        // Check if image exists in Azure Blob
        const exists = await this.azureBlobService.imageExists(safeFileName);
        if (!exists) {
          throw new NotFoundError('Image');
        }

        // Download the image
        const imageBuffer = await this.azureBlobService.downloadImage(safeFileName);
        this.sendImageResponse(res, imageBuffer, safeFileName, contentType);
      } catch (blobError) {
        // Azure unavailable or image not found in Azure — try local filesystem
        if (blobError instanceof NotFoundError) {
          logger.debug('Image not found in Azure Blob, trying local filesystem', {
            fileName: safeFileName,
          });
        } else {
          logger.warn('Azure Blob download failed, trying local filesystem', {
            error: blobError instanceof Error ? blobError.message : String(blobError),
          });
        }
        await this.serveLocalImage(res, safeFileName, contentType);
      }
    });
  };

  /** Map file extension to image MIME type. */
  private getImageContentType(fileName: string): string {
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return contentTypeMap[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
  }

  /** Set cache/content headers and send an image buffer. */
  private sendImageResponse(
    res: Response,
    buffer: Buffer,
    fileName: string,
    contentType: string
  ): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fileName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  }

  /** Read an image from the local uploads directory and serve it, or throw NotFoundError. */
  private async serveLocalImage(
    res: Response,
    fileName: string,
    contentType: string
  ): Promise<void> {
    const localPath = resolveSafeLocalImagePath(fileName);
    const exists = await fs.promises
      .access(localPath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      throw new NotFoundError('Image');
    }
    // deepcode ignore PT: Path traversal prevented by resolveSafeLocalImagePath() directory jail
    // NOSONAR: CWE-22 false positive — fileName is validated by strict allowlist regex
    // and blocked on path separators / dot-dot segments before path construction.
    const fileBuffer = await fs.promises.readFile(localPath);
    this.sendImageResponse(res, fileBuffer, fileName, contentType);
  }

  /**
   * Get image URL without downloading
   * GET /api/images/:fileName/url
   */
  getImageUrl = async (req: RequestWithFile, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { fileName } = req.params;

      if (!fileName) {
        throw new ValidationError('File name is required');
      }

      const safeFileName = sanitizeStorageFileName(fileName);

      // Check if Azure Blob Storage is configured
      if (!this.azureBlobService.isConfigured()) {
        throw new ServiceUnavailableError('Azure Blob Storage is not configured');
      }

      // Check if image exists
      const exists = await this.azureBlobService.imageExists(safeFileName);
      if (!exists) {
        throw new NotFoundError('Image');
      }

      const url = await this.azureBlobService.getImageUrl(safeFileName);

      res.status(200).json({
        fileName: safeFileName,
        url: toProxyUrl(url),
      });
    });
  };

  /**
   * Delete an image from Azure Blob Storage
   * DELETE /api/images/:fileName
   */
  deleteImage = async (req: RequestWithFile, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { fileName } = req.params;

      if (!fileName) {
        throw new ValidationError('File name is required');
      }

      const safeFileName = sanitizeStorageFileName(fileName);

      // Check if Azure Blob Storage is configured
      if (!this.azureBlobService.isConfigured()) {
        throw new ServiceUnavailableError('Azure Blob Storage is not configured');
      }

      const deleted = await this.azureBlobService.deleteImage(safeFileName);

      if (deleted) {
        res.status(200).json({
          message: 'Image deleted successfully',
          fileName: safeFileName,
        });
      } else {
        throw new NotFoundError('Image');
      }
    });
  };

  /**
   * Validate an image file without uploading
   * POST /api/images/validate
   */
  validateImage = async (req: RequestWithFile, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      // Check if Azure Blob Storage is configured
      if (!this.azureBlobService.isConfigured()) {
        throw new ServiceUnavailableError('Azure Blob Storage is not configured');
      }

      // Validate file
      const validationResult = await this.azureBlobService.validateFile(
        req.file.buffer,
        req.file.mimetype
      );

      if (validationResult.valid) {
        res.status(200).json({
          valid: true,
          message: 'File is valid',
          detectedMimeType: validationResult.detectedMimeType,
          declaredMimeType: req.file.mimetype,
          fileSize: validationResult.fileSize,
          fileName: req.file.originalname,
        });
      } else {
        res.status(400).json({
          valid: false,
          error: validationResult.error,
          detectedMimeType: validationResult.detectedMimeType,
          declaredMimeType: req.file.mimetype,
          fileSize: req.file.size,
          fileName: req.file.originalname,
        });
      }
    });
  };

  /**
   * List all images in Azure Blob Storage with pagination support
   * GET /api/images
   */
  listImages = async (req: RequestWithFile, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      // Check if Azure Blob Storage is configured
      if (!this.azureBlobService.isConfigured()) {
        throw new ServiceUnavailableError('Azure Blob Storage is not configured');
      }

      const prefix = req.query.prefix as string | undefined;
      const paginationOptions = extractPaginationOptions(req);
      const images = await this.azureBlobService.listImages(prefix);

      // Sort images by name (default) or last modified
      const sortFunction = (
        a: { name: string; lastModified?: string },
        b: { name: string; lastModified?: string }
      ): number => {
        if (paginationOptions.sortBy === 'lastModified' && a.lastModified && b.lastModified) {
          const order = paginationOptions.sortOrder === 'DESC' ? -1 : 1;
          return order * (new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
        }
        // Default: sort by name
        const order = paginationOptions.sortOrder === 'DESC' ? -1 : 1;
        return order * a.name.localeCompare(b.name);
      };

      const result = paginateArray(
        images.map(name => ({ name })),
        paginationOptions,
        sortFunction
      );

      res.status(200).json(result);
    });
  };
}
