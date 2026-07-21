import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

import { createDefaultAzureCredentialOptions } from '../../utils/azureIdentity';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Placeholder marker for backend-proxied blob downloads.
 * Used in metadata when SAS URLs cannot be generated (e.g. Managed Identity without account key).
 * This is NOT an actual API endpoint; the real download goes through the existing
 * GDPR export download endpoint, which detects non-HTTPS "URLs" and proxies the blob.
 */
const BLOB_DOWNLOAD_PROXY_MARKER = '__BACKEND_PROXY__';

/**
 * GDPR Export Storage Service for Azure Blob Storage
 *
 * Manages GDPR data exports with:
 * - Secure blob upload with encryption in transit
 * - SAS URL generation for temporary downloads (24 hours default)
 * - Application-managed cleanup of expired exports (retention enforced by ExportRequestService)
 * - Private container access
 *
 * Note: Azure Blob Storage's native lifecycle management policies are not configured here;
 *       retention is enforced by application-level cleanup jobs.
 *
 * Container Structure:
 * - Container: gdpr-exports (private access)
 * - Blob naming: {userId}/{requestId}/{timestamp}.json
 */
export class GdprExportStorageService {
  private readonly blobServiceClient: BlobServiceClient | null = null;
  private readonly containerName: string;
  private readonly storageAccountName: string | null = null;
  private readonly storageAccountKey: string | null = null;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || null;
    this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || null;
    this.storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || null;
    this.containerName = process.env.GDPR_EXPORT_CONTAINER || 'gdpr-exports';

    // Try Managed Identity first (for production Azure deployments)
    if (this.storageAccountName && !connectionString) {
      try {
        const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
        const accountUrl = `https://${this.storageAccountName}.blob.core.windows.net`;
        this.blobServiceClient = new BlobServiceClient(accountUrl, credential);
        logger.info('Initialized GDPR export storage with Managed Identity');
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error('Failed to initialize GDPR export storage with Managed Identity:', {
          error: errorMessage,
        });
        throw new Error(
          `GDPR export storage initialization failed for Managed Identity: ${errorMessage}`
        );
      }
    }
    // Fall back to connection string (for local development)
    else if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

      // When using a connection string, extract account name and key for SAS generation in dev
      try {
        const segments = connectionString.split(';');
        for (const segment of segments) {
          if (!segment) {
            continue;
          }
          const [rawKey, ...rawValueParts] = segment.split('=');
          if (!rawKey || rawValueParts.length === 0) {
            continue;
          }
          const key = rawKey.trim().toLowerCase();
          const value = rawValueParts.join('=').trim();

          if (!this.storageAccountName && key === 'accountname') {
            this.storageAccountName = value;
          } else if (!this.storageAccountKey && key === 'accountkey') {
            this.storageAccountKey = value;
          }
        }
      } catch (error: unknown) {
        logger.warn(
          'Failed to parse storage account name/key from connection string for GDPR export storage:',
          error
        );
      }

      logger.info('Initialized GDPR export storage with connection string');
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
   * Creates a private container with no public access
   */
  private async ensureContainerExists(): Promise<ContainerClient> {
    if (!this.blobServiceClient) {
      throw new Error(
        'Azure Blob Storage is not configured for GDPR exports. Please set AZURE_STORAGE_ACCOUNT_NAME (for Managed Identity) or AZURE_STORAGE_CONNECTION_STRING (for local development).'
      );
    }

    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

    // Create container if it doesn't exist with private access (no public access)
    // Note: Not setting 'access' property creates a private container
    await containerClient.createIfNotExists();

    logger.debug(`GDPR export container "${this.containerName}" ensured`);

    return containerClient;
  }

  /**
   * Validate that userId and requestId only contain safe characters
   * Prevents path traversal and ensures proper blob naming
   * @param value - The value to validate
   * @param fieldName - The name of the field being validated
   * @throws Error if validation fails
   */
  private validateSafeIdentifier(value: string, fieldName: string): void {
    // Allow only alphanumeric characters, hyphens, and underscores
    const safePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePattern.test(value)) {
      throw new Error(
        `Invalid ${fieldName}: must contain only alphanumeric characters, hyphens, and underscores`
      );
    }
  }

  /**
   * Upload GDPR export data to Azure Blob Storage
   *
   * @param userId - User ID
   * @param requestId - Export request ID
   * @param exportData - JSON export data
   * @returns Blob name (path in container)
   */
  public async uploadExport(
    userId: string,
    requestId: string,
    exportData: Record<string, unknown>
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for GDPR exports');
    }

    // Validate identifiers to prevent path traversal
    this.validateSafeIdentifier(userId, 'userId');
    this.validateSafeIdentifier(requestId, 'requestId');

    const containerClient = await this.ensureContainerExists();

    // Generate blob name: {userId}/{requestId}/{timestamp}.json
    const timestamp = Date.now();
    const blobName = `${userId}/${requestId}/${timestamp}.json`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Convert data to JSON string
    const jsonContent = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');

    // Upload with metadata
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/json',
        blobContentDisposition: `attachment; filename="user-data-${userId}-${requestId}.json"`,
      },
      metadata: {
        userId,
        requestId,
        exportDate: new Date().toISOString(),
        dataType: 'gdpr-export',
      },
    });

    logger.info('GDPR export uploaded to blob storage', {
      userId,
      requestId,
      blobName,
      size: buffer.length,
    });

    return blobName;
  }

  /**
   * Generate SAS URL for downloading export
   *
   * @param blobName - Blob name (path in container)
   * @param expirationHours - Hours until SAS URL expires (default: 24)
   * @returns Secure download URL with SAS token
   */
  public async generateSasUrl(blobName: string, expirationHours: number = 24): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for GDPR exports');
    }

    // If using Managed Identity without storage account key, we cannot generate SAS URLs
    // In this case, the download would need to be proxied through the backend
    if (!this.storageAccountKey) {
      logger.warn(
        'Cannot generate SAS URL without AZURE_STORAGE_ACCOUNT_KEY. Downloads must be proxied through backend.'
      );
      // Return the blob name with a marker prefix that the controller can recognize
      return `${BLOB_DOWNLOAD_PROXY_MARKER}:${blobName}`;
    }

    try {
      const sharedKeyCredential = new StorageSharedKeyCredential(
        this.storageAccountName!,
        this.storageAccountKey
      );

      const startsOn = new Date();
      const expiresOn = new Date();
      expiresOn.setHours(expiresOn.getHours() + expirationHours);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName,
          permissions: BlobSASPermissions.parse('r'), // Read-only
          startsOn,
          expiresOn,
        },
        sharedKeyCredential
      ).toString();

      const downloadUrl = `https://${this.storageAccountName}.blob.core.windows.net/${this.containerName}/${blobName}?${sasToken}`;

      logger.info('SAS URL generated for GDPR export', {
        blobName,
        expiresOn: expiresOn.toISOString(),
      });

      return downloadUrl;
    } catch (error: unknown) {
      logger.error('Failed to generate SAS URL for GDPR export', {
        error: getErrorMessage(error),
        blobName,
      });
      throw new Error('Failed to generate secure download URL');
    }
  }

  /**
   * Download export data from blob storage
   * Used when proxying downloads through backend (Managed Identity without key)
   *
   * @param blobName - Blob name (path in container)
   * @returns Buffer containing the JSON export data
   */
  public async downloadExport(blobName: string): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for GDPR exports');
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      const downloadResponse = await blockBlobClient.download();

      if (!downloadResponse.readableStreamBody) {
        throw new Error('Failed to download export: no stream available');
      }

      const buffer = await this.streamToBuffer(downloadResponse.readableStreamBody);

      logger.info('GDPR export downloaded from blob storage', {
        blobName,
        size: buffer.length,
      });

      return buffer;
    } catch (error: unknown) {
      // Re-throw configuration errors as-is
      if (
        error instanceof Error &&
        error.message.includes('Azure Blob Storage is not configured')
      ) {
        throw error;
      }
      logger.error('Failed to download GDPR export from blob storage', {
        error: getErrorMessage(error),
        blobName,
      });
      throw new Error('Failed to download export data');
    }
  }

  /**
   * Delete export from blob storage
   *
   * @param blobName - Blob name (path in container)
   * @returns True if deleted, false if not found
   */
  public async deleteExport(blobName: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for GDPR exports');
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      await blockBlobClient.delete();
      logger.info('GDPR export deleted from blob storage', { blobName });
      return true;
    } catch (error: unknown) {
      // Type-safe error handling for Azure Storage errors
      interface AzureStorageError {
        statusCode?: number;
      }

      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? (error as AzureStorageError).statusCode
          : undefined;

      if (statusCode === 404) {
        logger.warn('GDPR export not found for deletion', { blobName });
        return false;
      }

      logger.error('Failed to delete GDPR export from blob storage', {
        error: getErrorMessage(error),
        blobName,
      });
      throw error;
    }
  }

  /**
   * Check if export exists in blob storage
   *
   * @param blobName - Blob name (path in container)
   * @returns True if exists, false otherwise
   */
  public async exportExists(blobName: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      return await blockBlobClient.exists();
    } catch (error: unknown) {
      logger.error('Failed to check if GDPR export exists', {
        error: getErrorMessage(error),
        blobName,
      });
      return false;
    }
  }

  /**
   * Get blob properties including content length (file size)
   * CWE-770: Used to check file size before downloading to prevent resource exhaustion
   *
   * @param blobName - Blob name (path in container)
   * @returns Blob properties including contentLength
   */
  public async getBlobProperties(blobName: string): Promise<{ contentLength?: number } | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const containerClient = await this.ensureContainerExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      const properties = await blockBlobClient.getProperties();
      return {
        contentLength: properties.contentLength,
      };
    } catch (error: unknown) {
      logger.error('Failed to get GDPR export properties', {
        error: getErrorMessage(error),
        blobName,
      });
      return null;
    }
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

/**
 * Singleton instance
 */
let gdprExportStorageServiceInstance: GdprExportStorageService | null = null;

/**
 * Get singleton instance of GdprExportStorageService
 * Lazy initialization ensures environment variables are loaded before instantiation
 * @returns GdprExportStorageService instance
 */
export function getGdprExportStorageService(): GdprExportStorageService {
  gdprExportStorageServiceInstance ??= new GdprExportStorageService();
  return gdprExportStorageServiceInstance;
}

