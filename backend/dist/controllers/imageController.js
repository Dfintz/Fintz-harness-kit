"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageController = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const uuid_1 = require("uuid");
const urls_1 = require("../config/urls");
const infrastructure_1 = require("../services/infrastructure");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const pagination_1 = require("../utils/pagination");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
const LOCAL_UPLOADS_DIR = node_path_1.default.join(process.cwd(), 'data', 'uploads');
const SAFE_STORAGE_FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);
const FORMAT_EXTENSION_MAP = {
    jpeg: '.jpeg',
    png: '.png',
    webp: '.webp',
    avif: '.avif',
};
function parseSupportedImageFormat(rawFormat) {
    if (rawFormat === 'jpeg' || rawFormat === 'png' || rawFormat === 'webp' || rawFormat === 'avif') {
        return rawFormat;
    }
    return undefined;
}
function normalizeImageExtension(originalName) {
    const extension = node_path_1.default.extname(originalName).toLowerCase();
    return ALLOWED_IMAGE_EXTENSIONS.has(extension) ? extension : '.bin';
}
function sanitizeStorageFileName(fileName) {
    let decodedFileName = fileName;
    try {
        decodedFileName = decodeURIComponent(fileName);
    }
    catch {
        throw new apiErrors_1.ValidationError('Invalid file name encoding');
    }
    if (!SAFE_STORAGE_FILE_NAME_RE.test(decodedFileName) ||
        decodedFileName.includes('..') ||
        decodedFileName.includes('/') ||
        decodedFileName.includes('\\')) {
        throw new apiErrors_1.ValidationError('Invalid file name');
    }
    return decodedFileName;
}
function resolveSafeLocalImagePath(fileName) {
    const safeName = sanitizeStorageFileName(fileName);
    return node_path_1.default.join(LOCAL_UPLOADS_DIR, safeName);
}
function toProxyUrl(blobUrl) {
    try {
        const fileName = new URL(blobUrl).pathname.split('/').pop();
        if (fileName) {
            const base = (0, urls_1.getBackendUrl)();
            return `${base}/api/v2/images/download/${encodeURIComponent(fileName)}`;
        }
    }
    catch {
    }
    return blobUrl;
}
class ImageController extends BaseController_1.BaseController {
    azureBlobService;
    constructor() {
        super();
        this.azureBlobService = new infrastructure_1.AzureBlobService();
    }
    uploadImage = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.file) {
                throw new apiErrors_1.ValidationError('No file uploaded');
            }
            const validationResult = await this.azureBlobService.validateFile(req.file.buffer, req.file.mimetype);
            if (!validationResult.valid) {
                throw new apiErrors_1.ValidationError(validationResult.error ?? 'File validation failed');
            }
            logger_1.logger.info(`File validated: ${validationResult.detectedMimeType}, size: ${validationResult.fileSize} bytes`);
            const quality = req.query.quality ? Number.parseInt(req.query.quality, 10) : 85;
            const format = parseSupportedImageFormat(req.query.format);
            const resizeOption = req.query.resize;
            const createVariants = (0, queryUtils_1.parseBooleanQuery)(req.query.variants);
            const customWidth = req.query.width
                ? Number.parseInt(req.query.width, 10)
                : undefined;
            const customHeight = req.query.height
                ? Number.parseInt(req.query.height, 10)
                : undefined;
            const fileExtension = format
                ? FORMAT_EXTENSION_MAP[format]
                : normalizeImageExtension(req.file.originalname);
            const uniqueFileName = `${(0, uuid_1.v4)()}${fileExtension}`;
            const optimizationOptions = {
                quality: Math.min(Math.max(quality, 1), 100),
                format,
                compress: true,
            };
            if (resizeOption && this.azureBlobService.SIZE_VARIANTS[resizeOption]) {
                const variant = this.azureBlobService.SIZE_VARIANTS[resizeOption];
                optimizationOptions.resize = {
                    width: variant.width,
                    height: variant.height,
                    fit: variant.fit,
                };
            }
            else if (customWidth || customHeight) {
                optimizationOptions.resize = {
                    width: customWidth,
                    height: customHeight,
                    fit: 'inside',
                };
            }
            if (!this.azureBlobService.isConfigured()) {
                logger_1.logger.info('Azure Blob Storage not configured — saving to local filesystem');
                const localUrl = await this.saveToLocalFilesystem(uniqueFileName, req.file.buffer, optimizationOptions);
                res.status(200).json({
                    message: 'Image uploaded successfully (local storage)',
                    fileName: uniqueFileName,
                    url: localUrl,
                    originalName: req.file.originalname,
                    originalSize: req.file.size,
                    detectedMimeType: validationResult.detectedMimeType,
                    optimizationApplied: true,
                    storage: 'local',
                });
                return;
            }
            try {
                if (createVariants) {
                    const variantKeys = ['thumbnail', 'small', 'medium', 'large'];
                    const result = await this.azureBlobService.uploadImageWithVariants(uniqueFileName, req.file.buffer, validationResult.detectedMimeType ?? req.file.mimetype, variantKeys);
                    const proxyVariants = {};
                    for (const [key, val] of Object.entries(result.variants)) {
                        proxyVariants[key] = toProxyUrl(val);
                    }
                    res.status(200).json({
                        message: 'Image uploaded successfully with variants',
                        fileName: uniqueFileName,
                        url: toProxyUrl(result.original),
                        variants: proxyVariants,
                        originalName: req.file.originalname,
                        originalSize: req.file.size,
                        detectedMimeType: validationResult.detectedMimeType,
                        optimizationApplied: true,
                    });
                }
                else {
                    const imageUrl = await this.azureBlobService.uploadImage(uniqueFileName, req.file.buffer, validationResult.detectedMimeType ?? req.file.mimetype, optimizationOptions);
                    res.status(200).json({
                        message: 'Image uploaded successfully',
                        fileName: uniqueFileName,
                        url: toProxyUrl(imageUrl),
                        originalName: req.file.originalname,
                        originalSize: req.file.size,
                        detectedMimeType: validationResult.detectedMimeType,
                        optimizationApplied: true,
                        optimizationOptions: {
                            quality: optimizationOptions.quality,
                            format: optimizationOptions.format,
                            resized: !!optimizationOptions.resize,
                        },
                    });
                }
            }
            catch (blobError) {
                logger_1.logger.warn('Azure Blob Storage upload failed, falling back to local filesystem', {
                    error: blobError instanceof Error ? blobError.message : String(blobError),
                });
                const localUrl = await this.saveToLocalFilesystem(uniqueFileName, req.file.buffer, optimizationOptions);
                res.status(200).json({
                    message: 'Image uploaded successfully (local storage fallback)',
                    fileName: uniqueFileName,
                    url: localUrl,
                    originalName: req.file.originalname,
                    originalSize: req.file.size,
                    detectedMimeType: validationResult.detectedMimeType,
                    optimizationApplied: true,
                    storage: 'local',
                });
            }
        });
    };
    async saveToLocalFilesystem(fileName, buffer, options) {
        const safeFileName = sanitizeStorageFileName(fileName);
        try {
            await node_fs_1.default.promises.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
        }
        catch (mkdirErr) {
            logger_1.logger.error('Failed to create local uploads directory', {
                directory: LOCAL_UPLOADS_DIR,
                error: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
            });
            throw new apiErrors_1.ServiceUnavailableError('Image storage is temporarily unavailable. Please try again later.');
        }
        let outputBuffer = buffer;
        try {
            const optimized = await this.azureBlobService.optimizeImage(buffer, options);
            outputBuffer = optimized.buffer;
        }
        catch (err) {
            logger_1.logger.warn('Sharp optimization failed for local save, using original buffer', err);
        }
        try {
            const filePath = resolveSafeLocalImagePath(safeFileName);
            await node_fs_1.default.promises.writeFile(filePath, outputBuffer);
        }
        catch (writeErr) {
            logger_1.logger.error('Failed to write image to local filesystem', {
                fileName,
                error: writeErr instanceof Error ? writeErr.message : String(writeErr),
            });
            throw new apiErrors_1.ServiceUnavailableError('Image storage is temporarily unavailable. Please try again later.');
        }
        const base = (0, urls_1.getBackendUrl)();
        return `${base}/api/v2/images/download/${encodeURIComponent(safeFileName)}`;
    }
    downloadImage = async (req, res) => {
        await this.execute(req, res, async () => {
            const { fileName } = req.params;
            if (!fileName) {
                throw new apiErrors_1.ValidationError('File name is required');
            }
            const safeFileName = sanitizeStorageFileName(fileName);
            const contentType = this.getImageContentType(safeFileName);
            if (!this.azureBlobService.isConfigured()) {
                await this.serveLocalImage(res, safeFileName, contentType);
                return;
            }
            try {
                const exists = await this.azureBlobService.imageExists(safeFileName);
                if (!exists) {
                    throw new apiErrors_1.NotFoundError('Image');
                }
                const imageBuffer = await this.azureBlobService.downloadImage(safeFileName);
                this.sendImageResponse(res, imageBuffer, safeFileName, contentType);
            }
            catch (blobError) {
                if (blobError instanceof apiErrors_1.NotFoundError) {
                    logger_1.logger.debug('Image not found in Azure Blob, trying local filesystem', {
                        fileName: safeFileName,
                    });
                }
                else {
                    logger_1.logger.warn('Azure Blob download failed, trying local filesystem', {
                        error: blobError instanceof Error ? blobError.message : String(blobError),
                    });
                }
                await this.serveLocalImage(res, safeFileName, contentType);
            }
        });
    };
    getImageContentType(fileName) {
        const contentTypeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
        };
        return contentTypeMap[node_path_1.default.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
    }
    sendImageResponse(res, buffer, fileName, contentType) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${node_path_1.default.basename(fileName)}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(buffer);
    }
    async serveLocalImage(res, fileName, contentType) {
        const localPath = resolveSafeLocalImagePath(fileName);
        const exists = await node_fs_1.default.promises
            .access(localPath)
            .then(() => true)
            .catch(() => false);
        if (!exists) {
            throw new apiErrors_1.NotFoundError('Image');
        }
        const fileBuffer = await node_fs_1.default.promises.readFile(localPath);
        this.sendImageResponse(res, fileBuffer, fileName, contentType);
    }
    getImageUrl = async (req, res) => {
        await this.execute(req, res, async () => {
            const { fileName } = req.params;
            if (!fileName) {
                throw new apiErrors_1.ValidationError('File name is required');
            }
            const safeFileName = sanitizeStorageFileName(fileName);
            if (!this.azureBlobService.isConfigured()) {
                throw new apiErrors_1.ServiceUnavailableError('Azure Blob Storage is not configured');
            }
            const exists = await this.azureBlobService.imageExists(safeFileName);
            if (!exists) {
                throw new apiErrors_1.NotFoundError('Image');
            }
            const url = await this.azureBlobService.getImageUrl(safeFileName);
            res.status(200).json({
                fileName: safeFileName,
                url: toProxyUrl(url),
            });
        });
    };
    deleteImage = async (req, res) => {
        await this.execute(req, res, async () => {
            const { fileName } = req.params;
            if (!fileName) {
                throw new apiErrors_1.ValidationError('File name is required');
            }
            const safeFileName = sanitizeStorageFileName(fileName);
            if (!this.azureBlobService.isConfigured()) {
                throw new apiErrors_1.ServiceUnavailableError('Azure Blob Storage is not configured');
            }
            const deleted = await this.azureBlobService.deleteImage(safeFileName);
            if (deleted) {
                res.status(200).json({
                    message: 'Image deleted successfully',
                    fileName: safeFileName,
                });
            }
            else {
                throw new apiErrors_1.NotFoundError('Image');
            }
        });
    };
    validateImage = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.file) {
                throw new apiErrors_1.ValidationError('No file uploaded');
            }
            if (!this.azureBlobService.isConfigured()) {
                throw new apiErrors_1.ServiceUnavailableError('Azure Blob Storage is not configured');
            }
            const validationResult = await this.azureBlobService.validateFile(req.file.buffer, req.file.mimetype);
            if (validationResult.valid) {
                res.status(200).json({
                    valid: true,
                    message: 'File is valid',
                    detectedMimeType: validationResult.detectedMimeType,
                    declaredMimeType: req.file.mimetype,
                    fileSize: validationResult.fileSize,
                    fileName: req.file.originalname,
                });
            }
            else {
                res.status(400).json({
                    valid: false,
                    error: validationResult.error,
                    detectedMimeType: validationResult.detectedMimeType,
                    declaredMimeType: req.file.mimetype,
                    fileSize: req.file.size,
                    fileName: req.file.originalname,
                });
            }
        });
    };
    listImages = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!this.azureBlobService.isConfigured()) {
                throw new apiErrors_1.ServiceUnavailableError('Azure Blob Storage is not configured');
            }
            const prefix = req.query.prefix;
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            const images = await this.azureBlobService.listImages(prefix);
            const sortFunction = (a, b) => {
                if (paginationOptions.sortBy === 'lastModified' && a.lastModified && b.lastModified) {
                    const order = paginationOptions.sortOrder === 'DESC' ? -1 : 1;
                    return order * (new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
                }
                const order = paginationOptions.sortOrder === 'DESC' ? -1 : 1;
                return order * a.name.localeCompare(b.name);
            };
            const result = (0, pagination_1.paginateArray)(images.map(name => ({ name })), paginationOptions, sortFunction);
            res.status(200).json(result);
        });
    };
}
exports.ImageController = ImageController;
//# sourceMappingURL=imageController.js.map