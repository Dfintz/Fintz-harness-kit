"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentStorageService = void 0;
exports.getDocumentStorageService = getDocumentStorageService;
const identity_1 = require("@azure/identity");
const storage_blob_1 = require("@azure/storage-blob");
const azureIdentity_1 = require("../../utils/azureIdentity");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const BLOB_DOWNLOAD_PROXY_MARKER = '__BACKEND_PROXY__';
class DocumentStorageService {
    blobServiceClient = null;
    containerName;
    storageAccountName = null;
    storageAccountKey = null;
    constructor() {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
        this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
        this.storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY ?? null;
        this.containerName = process.env.DOCUMENT_CONTAINER ?? 'org-documents';
        if (this.storageAccountName && !connectionString) {
            this.blobServiceClient = this.initManagedIdentity(this.storageAccountName);
        }
        else if (connectionString) {
            this.blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
            this.parseConnectionString(connectionString);
            logger_1.logger.info('Initialized document storage with connection string');
        }
    }
    initManagedIdentity(accountName) {
        try {
            const credential = new identity_1.DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
            const accountUrl = `https://${accountName}.blob.core.windows.net`;
            const client = new storage_blob_1.BlobServiceClient(accountUrl, credential);
            logger_1.logger.info('Initialized document storage with Managed Identity');
            return client;
        }
        catch (error) {
            const errorMessage = (0, errorHandler_1.getErrorMessage)(error);
            logger_1.logger.error('Failed to initialize document storage with Managed Identity:', {
                error: errorMessage,
            });
            return null;
        }
    }
    parseConnectionString(connectionString) {
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
                }
                else if (!this.storageAccountKey && key === 'accountkey') {
                    this.storageAccountKey = value;
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to parse storage account details for document storage:', error);
        }
    }
    isConfigured() {
        return this.blobServiceClient !== null;
    }
    async ensureContainerExists() {
        if (!this.blobServiceClient) {
            throw new Error('Azure Blob Storage is not configured for documents. Set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING.');
        }
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        await containerClient.createIfNotExists();
        return containerClient;
    }
    validateSafeIdentifier(value, fieldName) {
        const safePattern = /^[a-zA-Z0-9_-]+$/;
        if (!safePattern.test(value)) {
            throw new Error(`Invalid ${fieldName}: must contain only alphanumeric characters, hyphens, and underscores`);
        }
    }
    async uploadDocument(organizationId, documentId, folderId, versionNumber, fileBuffer, mimeType, fileName) {
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
        logger_1.logger.info('Document uploaded to blob storage', {
            organizationId,
            documentId,
            blobPath,
            size: fileBuffer.length,
        });
        return { blobPath, sizeBytes: fileBuffer.length };
    }
    generateDownloadUrl(blobPath, expirationMinutes = 15) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured for documents');
        }
        if (!this.storageAccountKey) {
            logger_1.logger.warn('Cannot generate SAS URL without AZURE_STORAGE_ACCOUNT_KEY');
            return `${BLOB_DOWNLOAD_PROXY_MARKER}:${blobPath}`;
        }
        const accountName = this.storageAccountName ?? '';
        const sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(accountName, this.storageAccountKey);
        const startsOn = new Date();
        const expiresOn = new Date();
        expiresOn.setMinutes(expiresOn.getMinutes() + expirationMinutes);
        const sasToken = (0, storage_blob_1.generateBlobSASQueryParameters)({
            containerName: this.containerName,
            blobName: blobPath,
            permissions: storage_blob_1.BlobSASPermissions.parse('r'),
            startsOn,
            expiresOn,
        }, sharedKeyCredential).toString();
        return `https://${accountName}.blob.core.windows.net/${this.containerName}/${blobPath}?${sasToken}`;
    }
    async deleteBlob(blobPath) {
        if (!this.isConfigured()) {
            return;
        }
        try {
            const containerClient = await this.ensureContainerExists();
            const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
            await blockBlobClient.deleteIfExists();
            logger_1.logger.info('Document blob deleted', { blobPath });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete document blob:', {
                blobPath,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
        }
    }
    async deleteAllVersions(organizationId, documentId) {
        if (!this.isConfigured()) {
            return;
        }
        try {
            this.validateSafeIdentifier(organizationId, 'organizationId');
            this.validateSafeIdentifier(documentId, 'documentId');
            const containerClient = await this.ensureContainerExists();
            const prefix = `${organizationId}/`;
            for await (const blob of containerClient.listBlobsFlat({ prefix })) {
                if (blob.name.includes(`/${documentId}/`)) {
                    const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
                    await blockBlobClient.deleteIfExists();
                }
            }
            logger_1.logger.info('All document versions deleted from blob storage', {
                organizationId,
                documentId,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete document versions:', {
                organizationId,
                documentId,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
        }
    }
}
exports.DocumentStorageService = DocumentStorageService;
let documentStorageServiceInstance = null;
function getDocumentStorageService() {
    documentStorageServiceInstance ??= new DocumentStorageService();
    return documentStorageServiceInstance;
}
//# sourceMappingURL=DocumentStorageService.js.map