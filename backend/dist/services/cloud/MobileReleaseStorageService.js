"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileReleaseStorageService = void 0;
const identity_1 = require("@azure/identity");
const storage_blob_1 = require("@azure/storage-blob");
const apiErrors_1 = require("../../utils/apiErrors");
const azureIdentity_1 = require("../../utils/azureIdentity");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const DEFAULT_MOBILE_RELEASES_CONTAINER = 'mobile-releases';
const DEFAULT_APK_CONTENT_TYPE = 'application/vnd.android.package-archive';
class MobileReleaseStorageService {
    blobServiceClient = null;
    containerName;
    storageAccountName = null;
    constructor() {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
        this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
        this.containerName =
            process.env.AZURE_MOBILE_RELEASES_CONTAINER ?? DEFAULT_MOBILE_RELEASES_CONTAINER;
        if (this.storageAccountName && !connectionString) {
            try {
                const credential = new identity_1.DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
                const accountUrl = `https://${this.storageAccountName}.blob.core.windows.net`;
                this.blobServiceClient = new storage_blob_1.BlobServiceClient(accountUrl, credential);
            }
            catch (error) {
                logger_1.logger.error('Failed to initialize mobile release storage with Managed Identity', {
                    error: (0, errorHandler_1.getErrorMessage)(error),
                });
            }
        }
        else if (connectionString) {
            this.blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
        }
    }
    isConfigured() {
        return this.blobServiceClient !== null;
    }
    async downloadRelease(fileName) {
        if (!this.blobServiceClient) {
            throw new apiErrors_1.ServiceUnavailableError('Mobile release storage is not configured');
        }
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        let downloadResponse;
        try {
            downloadResponse = await blockBlobClient.download(0);
        }
        catch (error) {
            const statusCode = error.statusCode;
            if (statusCode === 404) {
                throw new apiErrors_1.NotFoundError('Mobile release');
            }
            logger_1.logger.error('Mobile release blob download failed', {
                container: this.containerName,
                fileName,
                statusCode,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            throw new apiErrors_1.ServiceUnavailableError('Mobile release storage service is temporarily unavailable. Please try again later.');
        }
        if (!downloadResponse.readableStreamBody) {
            throw new apiErrors_1.ServiceUnavailableError('Failed to stream mobile release from storage');
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
exports.MobileReleaseStorageService = MobileReleaseStorageService;
//# sourceMappingURL=MobileReleaseStorageService.js.map