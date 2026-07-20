"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileReleaseController = void 0;
const promises_1 = require("node:stream/promises");
const MobileReleaseStorageService_1 = require("../services/cloud/MobileReleaseStorageService");
const apiErrors_1 = require("../utils/apiErrors");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
const SAFE_APK_FILE_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,255}\.apk$/i;
const DEFAULT_APK_CONTENT_TYPE = 'application/vnd.android.package-archive';
function resolveApkContentType(reportedContentType) {
    const normalized = reportedContentType.trim().toLowerCase();
    if (!normalized || normalized === 'application/octet-stream') {
        return DEFAULT_APK_CONTENT_TYPE;
    }
    return reportedContentType;
}
function sanitizeMobileReleaseFileName(fileName) {
    let decodedFileName;
    try {
        decodedFileName = decodeURIComponent(fileName);
    }
    catch {
        throw new apiErrors_1.ValidationError('Invalid file name encoding');
    }
    if (!SAFE_APK_FILE_NAME_RE.test(decodedFileName) ||
        decodedFileName.includes('..') ||
        decodedFileName.includes('/') ||
        decodedFileName.includes('\\')) {
        throw new apiErrors_1.ValidationError('Invalid APK file name');
    }
    return decodedFileName;
}
class MobileReleaseController extends BaseController_1.BaseController {
    mobileReleaseStorageService;
    constructor() {
        super();
        this.mobileReleaseStorageService = new MobileReleaseStorageService_1.MobileReleaseStorageService();
    }
    downloadRelease = async (req, res) => {
        await this.execute(req, res, async () => {
            const { fileName } = req.params;
            if (!fileName) {
                throw new apiErrors_1.ValidationError('File name is required');
            }
            const safeFileName = sanitizeMobileReleaseFileName(fileName);
            if (!this.mobileReleaseStorageService.isConfigured()) {
                throw new apiErrors_1.ServiceUnavailableError('Mobile release storage is not configured');
            }
            const release = await this.mobileReleaseStorageService.downloadRelease(safeFileName);
            const contentType = resolveApkContentType(release.contentType);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
            res.setHeader('Cache-Control', 'public, max-age=300');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (typeof release.contentLength === 'number') {
                res.setHeader('Content-Length', String(release.contentLength));
            }
            if (release.eTag) {
                res.setHeader('ETag', release.eTag);
            }
            if (release.lastModified) {
                res.setHeader('Last-Modified', release.lastModified.toUTCString());
            }
            try {
                await (0, promises_1.pipeline)(release.stream, res);
            }
            catch (error) {
                logger_1.logger.error('Failed streaming mobile release to client', {
                    fileName: safeFileName,
                    error: (0, errorHandler_1.getErrorMessage)(error),
                });
                if (!res.headersSent) {
                    throw new apiErrors_1.ServiceUnavailableError('Mobile release download is temporarily unavailable. Please try again later.');
                }
            }
        });
    };
}
exports.MobileReleaseController = MobileReleaseController;
//# sourceMappingURL=mobileReleaseController.js.map