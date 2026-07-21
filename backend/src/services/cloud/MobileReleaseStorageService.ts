import { DefaultAzureCredential } from '@azure/identity';
import { BlobDownloadResponseParsed, BlobServiceClient } from '@azure/storage-blob';

import { NotFoundError, ServiceUnavailableError } from '../../utils/apiErrors';
import { createDefaultAzureCredentialOptions } from '../../utils/azureIdentity';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

const DEFAULT_MOBILE_RELEASES_CONTAINER = 'mobile-releases';
const DEFAULT_APK_CONTENT_TYPE = 'application/vnd.android.package-archive';

export interface MobileReleaseDownloadResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
  eTag?: string;
  lastModified?: Date;
}

/**
 * Storage service for mobile APK releases.
 *
 * Uses Managed Identity in Azure and connection string in local development.
 * Downloads are served through backend proxy so the blob container can stay private.
 */
export class MobileReleaseStorageService {
  private readonly blobServiceClient: BlobServiceClient | null = null;
  private readonly containerName: string;
  private readonly storageAccountName: string | null = null;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
    this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
    this.containerName =
      process.env.AZURE_MOBILE_RELEASES_CONTAINER ?? DEFAULT_MOBILE_RELEASES_CONTAINER;

    if (this.storageAccountName && !connectionString) {
      try {
        const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
        const accountUrl = `https://${this.storageAccountName}.blob.core.windows.net`;
        this.blobServiceClient = new BlobServiceClient(accountUrl, credential);
      } catch (error: unknown) {
        logger.error('Failed to initialize mobile release storage with Managed Identity', {
          error: getErrorMessage(error),
        });
      }
    } else if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    }
  }

  public isConfigured(): boolean {
    return this.blobServiceClient !== null;
  }

  public async downloadRelease(fileName: string): Promise<MobileReleaseDownloadResult> {
    if (!this.blobServiceClient) {
      throw new ServiceUnavailableError('Mobile release storage is not configured');
    }

    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    let downloadResponse: BlobDownloadResponseParsed;
    try {
      downloadResponse = await blockBlobClient.download(0);
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        throw new NotFoundError('Mobile release');
      }

      logger.error('Mobile release blob download failed', {
        container: this.containerName,
        fileName,
        statusCode,
        error: getErrorMessage(error),
      });
      throw new ServiceUnavailableError(
        'Mobile release storage service is temporarily unavailable. Please try again later.'
      );
    }

    if (!downloadResponse.readableStreamBody) {
      throw new ServiceUnavailableError('Failed to stream mobile release from storage');
    }

    return {
      stream: downloadResponse.readableStreamBody,
      contentType: downloadResponse.contentType ?? DEFAULT_APK_CONTENT_TYPE,
      contentLength: downloadResponse.contentLength ?? undefined,
      eTag: downloadResponse.etag ?? undefined,
      lastModified: downloadResponse.lastModified ?? undefined,
    };
  }
}

