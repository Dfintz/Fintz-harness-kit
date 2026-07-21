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
 * Document Storage Service for Azure Blob Storage
 *
 * Manages organization document files with:
 * - Versioned file uploads (immutable per version)
 * - SAS URL generation for time-limited downloads
 * - Private container access
 *
 * Container Structure:
 * - Container: org-documents (private access)
 * - Blob path: {organizationId}/{folderId|root}/{documentId}/v{version}
 */
export class DocumentStorageService {
  private readonly blobServiceClient: BlobServiceClient | null = null;
  private readonly containerName: string;
  private storageAccountName: string | null = null;
  private storageAccountKey: string | null = null;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
    this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
    this.storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY ?? null;
    this.containerName = process.env.DOCUMENT_CONTAINER ?? 'org-documents';

    if (this.storageAccountName && !connectionString) {
      this.blobServiceClient = this.initManagedIdentity(this.storageAccountName);
    } else if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.parseConnectionString(connectionString);
      logger.info('Initialized document storage with connection string');
    }
  }

  private initManagedIdentity(accountName: string): BlobServiceClient | null {
    try {
      const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
      const accountUrl = `https://${accountName}.blob.core.windows.net`;
      const client = new BlobServiceClient(accountUrl, credential);
      logger.info('Initialized document storage with Managed Identity');
      return client;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to initialize document storage with Managed Identity:', {
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
      logger.warn('Failed to parse storage account details for document storage:', error);
    }
  }

  public isConfigured(): boolean {
    return this.blobServiceClient !== null;
  }

  private async ensureContainerExists(): Promise<ContainerClient> {
    if (!this.blobServiceClient) {
      throw new Error(
        'Azure Blob Storage is not configured for documents. Set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING.'
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
   * Upload a document file to Azure Blob Storage
   */
  public async uploadDocument(
    organizationId: string,
    documentId: string,
    folderId: string | null,
    versionNumber: number,
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<{ blobPath: string; sizeBytes: number }> {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for documents');
    }

    this.validateSafeIdentifier(organizationId, 'organizationId');
    this.validateSafeIdentifier(documentId, 'documentId');

    const containerClient = await this.ensureContainerExists();

    const folderSegment = folderId ?? 'root';
    this.validateSafeIdentifier(folderSegment, 'folderId');
    const blobPath = `${organizationId}/${folderSegment}/${documentId}/v${versionNumber}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
        blobContentDisposition: `attachment; filename="${fileName}"`,
      },
      metadata: {
        organizationId,
        documentId,
        version: String(versionNumber),
        uploadDate: new Date().toISOString(),
      },
    });

    logger.info('Document uploaded to blob storage', {
      organizationId,
      documentId,
      blobPath,
      size: fileBuffer.length,
    });

    return { blobPath, sizeBytes: fileBuffer.length };
  }

  /**
   * Generate SAS URL for downloading a document
   */
  public generateDownloadUrl(blobPath: string, expirationMinutes: number = 15): string {
    if (!this.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured for documents');
    }

    if (!this.storageAccountKey) {
      logger.warn('Cannot generate SAS URL without AZURE_STORAGE_ACCOUNT_KEY');
      return `${BLOB_DOWNLOAD_PROXY_MARKER}:${blobPath}`;
    }

    const accountName = this.storageAccountName ?? '';
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, this.storageAccountKey);

    const startsOn = new Date();
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expirationMinutes);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: blobPath,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
      },
      sharedKeyCredential
    ).toString();

    return `https://${accountName}.blob.core.windows.net/${this.containerName}/${blobPath}?${sasToken}`;
  }

  /**
   * Delete a document blob from storage
   */
  public async deleteBlob(blobPath: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const containerClient = await this.ensureContainerExists();
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      await blockBlobClient.deleteIfExists();

      logger.info('Document blob deleted', { blobPath });
    } catch (error: unknown) {
      logger.error('Failed to delete document blob:', {
        blobPath,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Delete all blobs for a document (all versions)
   */
  public async deleteAllVersions(organizationId: string, documentId: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      this.validateSafeIdentifier(organizationId, 'organizationId');
      this.validateSafeIdentifier(documentId, 'documentId');

      const containerClient = await this.ensureContainerExists();
      const prefix = `${organizationId}/`;

      // List and delete all blobs containing the documentId
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        if (blob.name.includes(`/${documentId}/`)) {
          const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
          await blockBlobClient.deleteIfExists();
        }
      }

      logger.info('All document versions deleted from blob storage', {
        organizationId,
        documentId,
      });
    } catch (error: unknown) {
      logger.error('Failed to delete document versions:', {
        organizationId,
        documentId,
        error: getErrorMessage(error),
      });
    }
  }
}

// Singleton
let documentStorageServiceInstance: DocumentStorageService | null = null;

export function getDocumentStorageService(): DocumentStorageService {
  documentStorageServiceInstance ??= new DocumentStorageService();
  return documentStorageServiceInstance;
}

