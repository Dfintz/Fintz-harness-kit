"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureBlobService = void 0;
const identity_1 = require("@azure/identity");
const storage_blob_1 = require("@azure/storage-blob");
const sharp_1 = __importDefault(require("sharp"));
const apiErrors_1 = require("../../utils/apiErrors");
const azureIdentity_1 = require("../../utils/azureIdentity");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
let fileTypeFromBuffer = null;
void (async () => {
    try {
        const fileTypeModule = await Promise.resolve().then(() => __importStar(require('file-type')));
        const mod = fileTypeModule;
        const def = (fileTypeModule.default ?? {});
        const fn = (mod.fileTypeFromBuffer ?? def.fileTypeFromBuffer);
        fileTypeFromBuffer = fn ?? null;
    }
    catch (_error) {
        logger_1.logger.warn('file-type module not available, using basic MIME type validation');
    }
})();
const _BufferConstructor = global.Buffer;
class AzureBlobService {
    blobServiceClient = null;
    containerName;
    connectionString = null;
    storageAccountName = null;
    SIZE_VARIANTS = {
        thumbnail: { name: 'thumb', width: 150, height: 150, fit: 'cover' },
        small: { name: 'small', width: 400, height: 400, fit: 'inside' },
        medium: { name: 'medium', width: 800, height: 800, fit: 'inside' },
        large: { name: 'large', width: 1920, height: 1920, fit: 'inside' },
    };
    ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
    ];
    MAX_FILE_SIZE = 10 * 1024 * 1024;
    constructor() {
        this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING ?? null;
        this.storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? null;
        this.containerName = process.env.AZURE_STORAGE_CONTAINER ?? 'images';
        if (this.storageAccountName && !this.connectionString) {
            try {
                const credential = new identity_1.DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
                const accountUrl = `https://${this.storageAccountName}.blob.core.windows.net`;
                this.blobServiceClient = new storage_blob_1.BlobServiceClient(accountUrl, credential);
            }
            catch (error) {
                logger_1.logger.error('Failed to initialize Azure Blob Storage with Managed Identity:', error);
            }
        }
        else if (this.connectionString) {
            this.blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(this.connectionString);
        }
    }
    isConfigured() {
        return this.blobServiceClient !== null;
    }
    async ensureContainerExists() {
        if (!this.blobServiceClient) {
            throw new Error('Azure Blob Storage is not configured. Please set AZURE_STORAGE_ACCOUNT_NAME (for Managed Identity) or AZURE_STORAGE_CONNECTION_STRING (for local development) environment variable.');
        }
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        try {
            await containerClient.createIfNotExists();
        }
        catch (error) {
            const statusCode = error.statusCode;
            logger_1.logger.error('Azure Blob container initialization failed', {
                container: this.containerName,
                statusCode,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new apiErrors_1.ServiceUnavailableError('Image storage service is temporarily unavailable. Please try again later.');
        }
        return containerClient;
    }
    async validateFile(fileBuffer, declaredMimeType) {
        if (fileBuffer.length > this.MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
                fileSize: fileBuffer.length,
            };
        }
        if (fileBuffer.length === 0) {
            return {
                valid: false,
                error: 'File is empty',
            };
        }
        try {
            if (!fileTypeFromBuffer) {
                logger_1.logger.warn('file-type module not loaded, falling back to basic MIME validation');
                if (!this.ALLOWED_MIME_TYPES.includes(declaredMimeType.toLowerCase())) {
                    return {
                        valid: false,
                        error: `File type ${declaredMimeType} is not allowed`,
                        detectedMimeType: declaredMimeType,
                    };
                }
                return {
                    valid: true,
                    detectedMimeType: declaredMimeType,
                    fileSize: fileBuffer.length,
                };
            }
            const fileType = await fileTypeFromBuffer(fileBuffer);
            if (!fileType) {
                return {
                    valid: false,
                    error: 'Unable to determine file type',
                };
            }
            if (!this.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
                return {
                    valid: false,
                    error: `File type ${fileType.mime} is not allowed`,
                    detectedMimeType: fileType.mime,
                };
            }
            const normalizedDeclared = declaredMimeType.toLowerCase().replace('jpg', 'jpeg');
            const normalizedDetected = fileType.mime.toLowerCase();
            if (normalizedDeclared !== normalizedDetected) {
                logger_1.logger.warn(`MIME type mismatch: declared=${declaredMimeType}, detected=${fileType.mime}`);
            }
            return {
                valid: true,
                detectedMimeType: fileType.mime,
                fileSize: fileBuffer.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating file:', error);
            return {
                valid: false,
                error: 'File validation failed',
            };
        }
    }
    async optimizeImage(fileBuffer, options = {}) {
        try {
            let pipeline = (0, sharp_1.default)(fileBuffer);
            const metadata = await pipeline.metadata();
            logger_1.logger.info(`Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}, size: ${fileBuffer.length} bytes`);
            if (options.resize) {
                pipeline = pipeline.resize({
                    width: options.resize.width,
                    height: options.resize.height,
                    fit: options.resize.fit ?? 'inside',
                    withoutEnlargement: true,
                });
            }
            pipeline = pipeline.rotate();
            const format = options.format ?? metadata.format;
            const quality = options.quality ?? 85;
            switch (format) {
                case 'jpeg':
                case 'jpg':
                    pipeline = pipeline.jpeg({
                        quality,
                        progressive: true,
                        mozjpeg: true,
                    });
                    break;
                case 'png':
                    pipeline = pipeline.png({
                        compressionLevel: 9,
                        progressive: true,
                    });
                    break;
                case 'webp':
                    pipeline = pipeline.webp({
                        quality,
                        effort: 6,
                    });
                    break;
                case 'avif':
                    pipeline = pipeline.avif({
                        quality,
                        effort: 4,
                    });
                    break;
                default:
                    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
                        pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
                    }
            }
            const optimizedBuffer = await pipeline.toBuffer();
            const compressionRatio = ((1 - optimizedBuffer.length / fileBuffer.length) * 100).toFixed(2);
            logger_1.logger.info(`Optimized image: size: ${optimizedBuffer.length} bytes, compression: ${compressionRatio}%`);
            const contentType = format === 'jpeg' || format === 'jpg'
                ? 'image/jpeg'
                : format === 'png'
                    ? 'image/png'
                    : format === 'webp'
                        ? 'image/webp'
                        : format === 'avif'
                            ? 'image/avif'
                            : 'image/jpeg';
            return { buffer: optimizedBuffer, contentType };
        }
        catch (error) {
            logger_1.logger.error('Error optimizing image:', error);
            throw new Error(`Image optimization failed: ${(0, errorHandler_1.getErrorMessage)(error, 'Unknown error')}`);
        }
    }
    async uploadImage(fileName, fileBuffer, contentType, options) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const containerClient = await this.ensureContainerExists();
        let uploadBuffer = fileBuffer;
        let uploadContentType = contentType;
        if (options) {
            const optimized = await this.optimizeImage(fileBuffer, options);
            uploadBuffer = optimized.buffer;
            uploadContentType = optimized.contentType;
        }
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        try {
            await blockBlobClient.uploadData(uploadBuffer, {
                blobHTTPHeaders: {
                    blobContentType: uploadContentType,
                    blobCacheControl: 'public, max-age=31536000',
                },
            });
        }
        catch (error) {
            const statusCode = error.statusCode;
            logger_1.logger.error('Azure Blob upload failed', {
                fileName,
                statusCode,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new apiErrors_1.ServiceUnavailableError('Image storage service is temporarily unavailable. Please try again later.');
        }
        return blockBlobClient.url;
    }
    async uploadImageWithVariants(fileName, fileBuffer, contentType, variants = ['thumbnail', 'medium', 'large']) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const urls = {};
        const originalUrl = await this.uploadImage(fileName, fileBuffer, contentType, {
            quality: 90,
            compress: true,
        });
        for (const variantKey of variants) {
            const variant = this.SIZE_VARIANTS[variantKey];
            if (!variant) {
                logger_1.logger.warn(`Unknown variant: ${variantKey}`);
                continue;
            }
            const variantFileName = fileName.replace(/\.(\w+)$/, `-${variant.name}.$1`);
            try {
                const variantUrl = await this.uploadImage(variantFileName, fileBuffer, contentType, {
                    resize: {
                        width: variant.width,
                        height: variant.height,
                        fit: variant.fit,
                    },
                    quality: 85,
                    format: 'webp',
                });
                urls[variantKey] = variantUrl;
            }
            catch (error) {
                logger_1.logger.error(`Error uploading variant ${variantKey}:`, error);
            }
        }
        return {
            original: originalUrl,
            variants: urls,
        };
    }
    async uploadImageFromStream(fileName, stream, contentType, size) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const containerClient = await this.ensureContainerExists();
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        try {
            await blockBlobClient.uploadStream(stream, size, 5, {
                blobHTTPHeaders: {
                    blobContentType: contentType,
                },
            });
        }
        catch (error) {
            const statusCode = error.statusCode;
            logger_1.logger.error('Azure Blob stream upload failed', {
                fileName,
                statusCode,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new apiErrors_1.ServiceUnavailableError('Image storage service is temporarily unavailable. Please try again later.');
        }
        return blockBlobClient.url;
    }
    async downloadImage(fileName) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const containerClient = await this.ensureContainerExists();
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        let downloadResponse;
        try {
            downloadResponse = await blockBlobClient.download();
        }
        catch (error) {
            const statusCode = error.statusCode;
            if (statusCode === 404) {
                throw new Error('Image not found');
            }
            logger_1.logger.error('Azure Blob download failed', {
                fileName,
                statusCode,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new apiErrors_1.ServiceUnavailableError('Image storage service is temporarily unavailable. Please try again later.');
        }
        if (!downloadResponse.readableStreamBody) {
            throw new Error('Failed to download image: no stream available');
        }
        return this.streamToBuffer(downloadResponse.readableStreamBody);
    }
    async getImageUrl(fileName) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const containerClient = await this.ensureContainerExists();
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        return blockBlobClient.url;
    }
    async deleteImage(fileName) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const containerClient = await this.ensureContainerExists();
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        try {
            await blockBlobClient.delete();
            return true;
        }
        catch (error) {
            const statusCode = error.statusCode;
            if (statusCode === 404) {
                return false;
            }
            logger_1.logger.error('Azure Blob delete failed', {
                fileName,
                statusCode,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new apiErrors_1.ServiceUnavailableError('Image storage service is temporarily unavailable. Please try again later.');
        }
    }
    async listImages(prefix) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const containerClient = await this.ensureContainerExists();
        const images = [];
        const options = prefix ? { prefix } : {};
        for await (const blob of containerClient.listBlobsFlat(options)) {
            images.push(blob.name);
        }
        return images;
    }
    async imageExists(fileName) {
        if (!this.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured');
        }
        const containerClient = await this.ensureContainerExists();
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        return blockBlobClient.exists();
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
exports.AzureBlobService = AzureBlobService;
//# sourceMappingURL=AzureBlobService.js.map