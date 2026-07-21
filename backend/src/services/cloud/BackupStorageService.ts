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

const BLOB_DOWNLOAD_PROXY_MARKER = '__BACKEND_PROXY__';

/**
 * Backup Storage Service for Azure Blob Storage
 *
 * Manages organization backup data with:
 * - Secure blob upload for large JSON backup payloads
 * - SAS URL generation for temporary downloads
 * - Private container access
 *
 * Container Structure:
 * - Container: org-backups (private access)
 * - Blob naming: {organizationId}/{backupId}/{timestamp}.json
 */
export class BackupStorageService {
  private readonly blobServiceClient: BlobServiceClient | null = null;
  private readonly containerName: string;
  private storageAccountName: string | null = null;
  private storageAccountKey: string | null = null;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
    this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
    this.storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY ?? null;
    this.containerName = process.env.BACKUP_CONTAINER ?? 'org-backups';

    if (this.storageAccountName && !connectionString) {
      this.blobServiceClient = this.initManagedIdentity(this.storageAccountName);
    } else if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.parseConnectionString(connectionString);
      logger.info('Initialized backup storage with connection string');
    }
  }

  private initManagedIdentity(accountName: string): BlobServiceClient | null {
    try {
      const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
      const accountUrl = `https://${accountName}.blob.core.windows.net`;
      const client = new BlobServiceClient(accountUrl, credential);
      logger.info('Initialized backup storage with Managed Identity');
      return client;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to initialize backup storage with Managed Identity:', {
        error: errorMessage,
      });
      return null;
    }
  }

  private parseConnectionString(connectionString: string): void {
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
      logger.warn('Failed to parse storage account details for backup storage:', error);
    }
  }

  public isConfigured(): boolean {
    return this.blobServiceClient !== null;
  }

  private async ensureContainerExists(): Promise<ContainerClient> {
    if (!this.blobServiceClient) {
      throw new Error(
        'Azure Blob Storage is not configured for backups. Set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING.'
      );
    }

    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    await containerClient.createIfNotExists();
    return containerClient;
  }

  private validateSafeIdentifier(value: string, fieldName: string): void {
    const safePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePattern.test(value)) {
      throw new Error(
        `Invalid ${fieldName}: must contain only alphanumeric characters, hyphens, and underscores`
      );
    }
  }

  /**
   * Upload backup data to Azure Blob Storage
   */
  public async uploadBackup(
    organizationId: string,
    backupId: string,
    backupData: Record<string, unknown>
  ): Promise<{ blobName: string; sizeBytes: number }> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for backups');
    }

    this.validateSafeIdentifier(organizationId, 'organizationId');
    this.validateSafeIdentifier(backupId, 'backupId');

    const containerClient = await this.ensureContainerExists();

    const timestamp = Date.now();
    const blobName = `${organizationId}/${backupId}/${timestamp}.json`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const jsonContent = JSON.stringify(backupData, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/json',
        blobContentDisposition: `attachment; filename="backup-${organizationId}-${backupId}.json"`,
      },
      metadata: {
        organizationId,
        backupId,
        backupDate: new Date().toISOString(),
        dataType: 'org-backup',
      },
    });

    logger.info('Backup uploaded to blob storage', {
      organizationId,
      backupId,
      blobName,
      size: buffer.length,
    });

    return { blobName, sizeBytes: buffer.length };
  }

  /**
   * Generate SAS URL for downloading backup
   */
  public generateDownloadUrl(blobName: string, expirationMinutes: number = 15): string {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for backups');
    }

    if (!this.storageAccountKey) {
      logger.warn('Cannot generate SAS URL without AZURE_STORAGE_ACCOUNT_KEY');
      return `${BLOB_DOWNLOAD_PROXY_MARKER}:${blobName}`;
    }

    const accountName = this.storageAccountName ?? '';
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, this.storageAccountKey);

    const startsOn = new Date();
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expirationMinutes);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
      },
      sharedKeyCredential
    ).toString();

    return `https://${accountName}.blob.core.windows.net/${this.containerName}/${blobName}?${sasToken}`;
  }

  /**
   * Delete backup blob from storage
   */
  public async deleteBackup(blobName: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const containerClient = await this.ensureContainerExists();
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.deleteIfExists();

      logger.info('Backup blob deleted', { blobName });
    } catch (error: unknown) {
      logger.error('Failed to delete backup blob:', { blobName, error: getErrorMessage(error) });
    }
  }
}

// Singleton
let backupStorageServiceInstance: BackupStorageService | null = null;

export function getBackupStorageService(): BackupStorageService {
  backupStorageServiceInstance ??= new BackupStorageService();
  return backupStorageServiceInstance;
}

