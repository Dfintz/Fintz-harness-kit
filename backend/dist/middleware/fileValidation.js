"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFileMetadata = exports.requireFile = exports.handleFileUploadError = exports.multipleImagesUploadConfig = exports.generalUploadConfig = exports.documentUploadConfig = exports.csvUploadConfig = exports.imageUploadConfig = exports.FILE_SIZE_LIMITS = exports.ALLOWED_DOCUMENT_TYPES = exports.ALLOWED_CSV_TYPES = exports.ALLOWED_IMAGE_TYPES = void 0;
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
exports.ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
exports.ALLOWED_CSV_TYPES = ['text/csv', 'application/vnd.ms-excel'];
exports.ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
exports.FILE_SIZE_LIMITS = {
    IMAGE: 10 * 1024 * 1024,
    CSV: 5 * 1024 * 1024,
    DOCUMENT: 20 * 1024 * 1024,
    GENERAL: 15 * 1024 * 1024
};
const validateFileExtension = (filename, allowedExtensions) => {
    const ext = path_1.default.extname(filename).toLowerCase();
    return allowedExtensions.includes(ext);
};
const createStorage = (destination = 'uploads/') => multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, destination);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path_1.default.extname(file.originalname);
        const name = path_1.default.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});
exports.imageUploadConfig = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: exports.FILE_SIZE_LIMITS.IMAGE,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (!exports.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
        }
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!validateFileExtension(file.originalname, allowedExtensions)) {
            return cb(new Error('Invalid file extension.'));
        }
        cb(null, true);
    }
});
exports.csvUploadConfig = (0, multer_1.default)({
    storage: createStorage('uploads/csv/'),
    limits: {
        fileSize: exports.FILE_SIZE_LIMITS.CSV,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (!exports.ALLOWED_CSV_TYPES.includes(file.mimetype) && !file.originalname.endsWith('.csv')) {
            return cb(new Error('Invalid file type. Only CSV files are allowed.'));
        }
        if (!validateFileExtension(file.originalname, ['.csv'])) {
            return cb(new Error('Invalid file extension. Only .csv files are allowed.'));
        }
        cb(null, true);
    }
});
exports.documentUploadConfig = (0, multer_1.default)({
    storage: createStorage('uploads/documents/'),
    limits: {
        fileSize: exports.FILE_SIZE_LIMITS.DOCUMENT,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (!exports.ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
        }
        const allowedExtensions = ['.pdf', '.doc', '.docx'];
        if (!validateFileExtension(file.originalname, allowedExtensions)) {
            return cb(new Error('Invalid file extension.'));
        }
        cb(null, true);
    }
});
exports.generalUploadConfig = (0, multer_1.default)({
    storage: createStorage('uploads/'),
    limits: {
        fileSize: exports.FILE_SIZE_LIMITS.GENERAL,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.dylib'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (dangerousExtensions.includes(ext)) {
            return cb(new Error('Executable files are not allowed.'));
        }
        cb(null, true);
    }
});
exports.multipleImagesUploadConfig = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: exports.FILE_SIZE_LIMITS.IMAGE,
        files: 10
    },
    fileFilter: (req, file, cb) => {
        if (!exports.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only image files are allowed.'));
        }
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!validateFileExtension(file.originalname, allowedExtensions)) {
            return cb(new Error('Invalid file extension.'));
        }
        cb(null, true);
    }
});
const handleFileUploadError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
                message: 'File too large',
                error: 'The uploaded file exceeds the maximum allowed size.'
            });
            return;
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            res.status(400).json({
                message: 'Too many files',
                error: 'You can only upload a limited number of files at once.'
            });
            return;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            res.status(400).json({
                message: 'Unexpected file field',
                error: 'The file field name is not recognized.'
            });
            return;
        }
    }
    if (err) {
        res.status(400).json({
            message: 'File upload error',
            error: err.message || 'An error occurred during file upload.'
        });
        return;
    }
    next();
};
exports.handleFileUploadError = handleFileUploadError;
const requireFile = (req, res, next) => {
    if (!req.file && !req.files) {
        res.status(400).json({
            message: 'No file uploaded',
            error: 'A file is required for this request.'
        });
        return;
    }
    next();
};
exports.requireFile = requireFile;
const validateFileMetadata = (req, res, next) => {
    if (!req.file) {
        next();
        return;
    }
    const file = req.file;
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        res.status(400).json({
            message: 'Invalid filename',
            error: 'The filename contains invalid characters.'
        });
        return;
    }
    if (file.originalname.length > 255) {
        res.status(400).json({
            message: 'Filename too long',
            error: 'The filename must be less than 255 characters.'
        });
        return;
    }
    next();
};
exports.validateFileMetadata = validateFileMetadata;
//# sourceMappingURL=fileValidation.js.map