"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupStorageService = void 0;
exports.getBackupStorageService = getBackupStorageService;
const identity_1 = require("@azure/identity");
const storage_blob_1 = require("@azure/storage-blob");
const azureIdentity_1 = require("../../utils/azureIdentity");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const BLOB_DOWNLOAD_PROXY_MARKER = '__BACKEND_PROXY__';
class BackupStorageService {
    blobServiceClient = null;
    containerName;
    storageAccountName = null;
    storageAccountKey = null;
    constructor() {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
        this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
        this.storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY ?? null;
        this.containerName = process.env.BACKUP_CONTAINER ?? 'org-backups';
        if (this.storageAccountName && !connectionString) {
            this.blobServiceClient = this.initManagedIdentity(this.storageAccountName);
        }
        else if (connectionString) {
            this.blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
            this.parseConnectionString(connectionString);
            logger_1.logger.info('Initialized backup storage with connection string');
        }
    }
    initManagedIdentity(accountName) {
        try {
            const credential = new identity_1.DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
            const accountUrl = `https://${accountName}.blob.core.windows.net`;
            const client = new storage_blob_1.BlobServiceClient(accountUrl, credential);
            logger_1.logger.info('Initialized backup storage with Managed Identity');
            return client;
        }
        catch (error) {
            const errorMessage = (0, errorHandler_1.getErrorMessage)(error);
            logger_1.logger.error('Failed to initialize backup storage with Managed Identity:', {
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
            logger_1.logger.warn('Failed to parse storage account details for backup storage:', error);
        }
    }
    isConfigured() {
        return this.blobServiceClient !== null;
    }
    async ensureContainerExists() {
        if (!this.blobServiceClient) {
            throw new Error('Azure Blob Storage is not configured for backups. Set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING.');
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
    async uploadBackup(organizationId, backupId, backupData) {
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
        logger_1.logger.info('Backup uploaded to blob storage', {
            organizationId,
            backupId,
            blobName,
            size: buffer.length,
        });
        return { blobName, sizeBytes: buffer.length };
    }
    generateDownloadUrl(blobName, expirationMinutes = 15) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured for backups');
        }
        if (!this.storageAccountKey) {
            logger_1.logger.warn('Cannot generate SAS URL without AZURE_STORAGE_ACCOUNT_KEY');
            return `${BLOB_DOWNLOAD_PROXY_MARKER}:${blobName}`;
        }
        const accountName = this.storageAccountName ?? '';
        const sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(accountName, this.storageAccountKey);
        const startsOn = new Date();
        const expiresOn = new Date();
        expiresOn.setMinutes(expiresOn.getMinutes() + expirationMinutes);
        const sasToken = (0, storage_blob_1.generateBlobSASQueryParameters)({
            containerName: this.containerName,
            blobName,
            permissions: storage_blob_1.BlobSASPermissions.parse('r'),
            startsOn,
            expiresOn,
        }, sharedKeyCredential).toString();
        return `https://${accountName}.blob.core.windows.net/${this.containerName}/${blobName}?${sasToken}`;
    }
    async deleteBackup(blobName) {
        if (!this.isConfigured()) {
            return;
        }
        try {
            const containerClient = await this.ensureContainerExists();
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.deleteIfExists();
            logger_1.logger.info('Backup blob deleted', { blobName });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete backup blob:', { blobName, error: (0, errorHandler_1.getErrorMessage)(error) });
        }
    }
}
exports.BackupStorageService = BackupStorageService;
let backupStorageServiceInstance = null;
function getBackupStorageService() {
    backupStorageServiceInstance ??= new BackupStorageService();
    return backupStorageServiceInstance;
}
//# sourceMappingURL=BackupStorageService.js.map