"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprExportStorageService = void 0;
exports.getGdprExportStorageService = getGdprExportStorageService;
const identity_1 = require("@azure/identity");
const storage_blob_1 = require("@azure/storage-blob");
const azureIdentity_1 = require("../../utils/azureIdentity");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const BLOB_DOWNLOAD_PROXY_MARKER = '__BACKEND_PROXY__';
class GdprExportStorageService {
    blobServiceClient = null;
    containerName;
    storageAccountName = null;
    storageAccountKey = null;
    constructor() {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || null;
        this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || null;
        this.storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || null;
        this.containerName = process.env.GDPR_EXPORT_CONTAINER || 'gdpr-exports';
        if (this.storageAccountName && !connectionString) {
            try {
                const credential = new identity_1.DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
                const accountUrl = `https://${this.storageAccountName}.blob.core.windows.net`;
                this.blobServiceClient = new storage_blob_1.BlobServiceClient(accountUrl, credential);
                logger_1.logger.info('Initialized GDPR export storage with Managed Identity');
            }
            catch (error) {
                const errorMessage = (0, errorHandler_1.getErrorMessage)(error);
                logger_1.logger.error('Failed to initialize GDPR export storage with Managed Identity:', {
                    error: errorMessage,
                });
                throw new Error(`GDPR export storage initialization failed for Managed Identity: ${errorMessage}`);
            }
        }
        else if (connectionString) {
            this.blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
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
                logger_1.logger.warn('Failed to parse storage account name/key from connection string for GDPR export storage:', error);
            }
            logger_1.logger.info('Initialized GDPR export storage with connection string');
        }
    }
    isConfigured() {
        return this.blobServiceClient !== null;
    }
    async ensureContainerExists() {
        if (!this.blobServiceClient) {
            throw new Error('Azure Blob Storage is not configured for GDPR exports. Please set AZURE_STORAGE_ACCOUNT_NAME (for Managed Identity) or AZURE_STORAGE_CONNECTION_STRING (for local development).');
        }
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        await containerClient.createIfNotExists();
        logger_1.logger.debug(`GDPR export container "${this.containerName}" ensured`);
        return containerClient;
    }
    validateSafeIdentifier(value, fieldName) {
        const safePattern = /^[a-zA-Z0-9_-]+$/;
        if (!safePattern.test(value)) {
            throw new Error(`Invalid ${fieldName}: must contain only alphanumeric characters, hyphens, and underscores`);
        }
    }
    async uploadExport(userId, requestId, exportData) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured for GDPR exports');
        }
        this.validateSafeIdentifier(userId, 'userId');
        this.validateSafeIdentifier(requestId, 'requestId');
        const containerClient = await this.ensureContainerExists();
        const timestamp = Date.now();
        const blobName = `${userId}/${requestId}/${timestamp}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const jsonContent = JSON.stringify(exportData, null, 2);
        const buffer = Buffer.from(jsonContent, 'utf-8');
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
        logger_1.logger.info('GDPR export uploaded to blob storage', {
            userId,
            requestId,
            blobName,
            size: buffer.length,
        });
        return blobName;
    }
    async generateSasUrl(blobName, expirationHours = 24) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured for GDPR exports');
        }
        if (!this.storageAccountKey) {
            logger_1.logger.warn('Cannot generate SAS URL without AZURE_STORAGE_ACCOUNT_KEY. Downloads must be proxied through backend.');
            return `${BLOB_DOWNLOAD_PROXY_MARKER}:${blobName}`;
        }
        try {
            const sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(this.storageAccountName, this.storageAccountKey);
            const startsOn = new Date();
            const expiresOn = new Date();
            expiresOn.setHours(expiresOn.getHours() + expirationHours);
            const sasToken = (0, storage_blob_1.generateBlobSASQueryParameters)({
                containerName: this.containerName,
                blobName,
                permissions: storage_blob_1.BlobSASPermissions.parse('r'),
                startsOn,
                expiresOn,
            }, sharedKeyCredential).toString();
            const downloadUrl = `https://${this.storageAccountName}.blob.core.windows.net/${this.containerName}/${blobName}?${sasToken}`;
            logger_1.logger.info('SAS URL generated for GDPR export', {
                blobName,
                expiresOn: expiresOn.toISOString(),
            });
            return downloadUrl;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate SAS URL for GDPR export', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                blobName,
            });
            throw new Error('Failed to generate secure download URL');
        }
    }
    async downloadExport(blobName) {
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
            logger_1.logger.info('GDPR export downloaded from blob storage', {
                blobName,
                size: buffer.length,
            });
            return buffer;
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes('Azure Blob Storage is not configured')) {
                throw error;
            }
            logger_1.logger.error('Failed to download GDPR export from blob storage', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                blobName,
            });
            throw new Error('Failed to download export data');
        }
    }
    async deleteExport(blobName) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured for GDPR exports');
        }
        const containerClient = await this.ensureContainerExists();
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        try {
            await blockBlobClient.delete();
            logger_1.logger.info('GDPR export deleted from blob storage', { blobName });
            return true;
        }
        catch (error) {
            const statusCode = error && typeof error === 'object' && 'statusCode' in error
                ? error.statusCode
                : undefined;
            if (statusCode === 404) {
                logger_1.logger.warn('GDPR export not found for deletion', { blobName });
                return false;
            }
            logger_1.logger.error('Failed to delete GDPR export from blob storage', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                blobName,
            });
            throw error;
        }
    }
    async exportExists(blobName) {
        if (!this.isConfigured()) {
            return false;
        }
        const containerClient = await this.ensureContainerExists();
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        try {
            return await blockBlobClient.exists();
        }
        catch (error) {
            logger_1.logger.error('Failed to check if GDPR export exists', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                blobName,
            });
            return false;
        }
    }
    async getBlobProperties(blobName) {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get GDPR export properties', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                blobName,
            });
            return null;
        }
    }
    async streamToBuffer(readableStream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            readableStream.on('data', (data) => {
                chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
            });
            readableStream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            readableStream.on('error', reject);
        });
    }
}
exports.GdprExportStorageService = GdprExportStorageService;
let gdprExportStorageServiceInstance = null;
function getGdprExportStorageService() {
    gdprExportStorageServiceInstance ??= new GdprExportStorageService();
    return gdprExportStorageServiceInstance;
}
//# sourceMappingURL=GdprExportStorageService.js.map