import { pipeline } from 'node:stream/promises';

import { Request, Response } from 'express';

import { MobileReleaseStorageService } from '../services/cloud/MobileReleaseStorageService';
import { ServiceUnavailableError, ValidationError } from '../utils/apiErrors';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

import { BaseController } from './BaseController';

const SAFE_APK_FILE_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,255}\.apk$/i;
const DEFAULT_APK_CONTENT_TYPE = 'application/vnd.android.package-archive';

function resolveApkContentType(reportedContentType: string): string {
  const normalized = reportedContentType.trim().toLowerCase();
  if (!normalized || normalized === 'application/octet-stream') {
    return DEFAULT_APK_CONTENT_TYPE;
  }
  return reportedContentType;
}

function sanitizeMobileReleaseFileName(fileName: string): string {
  let decodedFileName: string;

  try {
    decodedFileName = decodeURIComponent(fileName);
  } catch {
    throw new ValidationError('Invalid file name encoding');
  }

  if (
    !SAFE_APK_FILE_NAME_RE.test(decodedFileName) ||
    decodedFileName.includes('..') ||
    decodedFileName.includes('/') ||
    decodedFileName.includes('\\')
  ) {
    throw new ValidationError('Invalid APK file name');
  }

  return decodedFileName;
}

/**
 * Mobile release download controller.
 * Serves APK files from a private blob container through backend proxy.
 */
export class MobileReleaseController extends BaseController {
  private readonly mobileReleaseStorageService: MobileReleaseStorageService;

  constructor() {
    super();
    this.mobileReleaseStorageService = new MobileReleaseStorageService();
  }

  downloadRelease = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { fileName } = req.params;

      if (!fileName) {
        throw new ValidationError('File name is required');
      }

      const safeFileName = sanitizeMobileReleaseFileName(fileName);

      if (!this.mobileReleaseStorageService.isConfigured()) {
        throw new ServiceUnavailableError('Mobile release storage is not configured');
      }

      const release = await this.mobileReleaseStorageService.downloadRelease(safeFileName);
      const contentType = resolveApkContentType(release.contentType);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (typeof release.contentLength === 'number') {
        res.setHeader('Content-Length', String(release.contentLength));
      }
      if (release.eTag) {
        res.setHeader('ETag', release.eTag);
      }
      if (release.lastModified) {
        res.setHeader('Last-Modified', release.lastModified.toUTCString());
      }

      try {
        await pipeline(release.stream, res);
      } catch (error: unknown) {
        logger.error('Failed streaming mobile release to client', {
          fileName: safeFileName,
          error: getErrorMessage(error),
        });

        if (!res.headersSent) {
          throw new ServiceUnavailableError(
            'Mobile release download is temporarily unavailable. Please try again later.'
          );
        }
      }
    });
  };
}
