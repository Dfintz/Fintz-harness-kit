import path from 'path';

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

/**
 * File validation middleware for secure file uploads
 */

// Allowed file types
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_CSV_TYPES = ['text/csv', 'application/vnd.ms-excel'];
export const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    IMAGE: 10 * 1024 * 1024,    // 10MB
    CSV: 5 * 1024 * 1024,       // 5MB
    DOCUMENT: 20 * 1024 * 1024, // 20MB
    GENERAL: 15 * 1024 * 1024   // 15MB
};

/**
 * Validate file extension against allowed extensions
 */
const validateFileExtension = (filename: string, allowedExtensions: string[]): boolean => {
    const ext = path.extname(filename).toLowerCase();
    return allowedExtensions.includes(ext);
};

/**
 * Create multer storage configuration
 */
const createStorage = (destination: string = 'uploads/') => multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, destination);
        },
        filename: (req, file, cb) => {
            // Generate unique filename with timestamp
            const uniqueSuffix = `${Date.now()  }-${  Math.round(Math.random() * 1E9)}`;
            const ext = path.extname(file.originalname);
            const name = path.basename(file.originalname, ext);
            cb(null, `${name}-${uniqueSuffix}${ext}`);
        }
    });

/**
 * Image upload configuration with validation
 */
export const imageUploadConfig = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: FILE_SIZE_LIMITS.IMAGE,
        files: 1 // Only allow single file upload
    },
    fileFilter: (req, file, cb) => {
        // Validate MIME type
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
        }

        // Validate file extension
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!validateFileExtension(file.originalname, allowedExtensions)) {
            return cb(new Error('Invalid file extension.'));
        }

        cb(null, true);
    }
});

/**
 * CSV upload configuration with validation
 */
export const csvUploadConfig = multer({
    storage: createStorage('uploads/csv/'),
    limits: {
        fileSize: FILE_SIZE_LIMITS.CSV,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Validate MIME type
        if (!ALLOWED_CSV_TYPES.includes(file.mimetype) && !file.originalname.endsWith('.csv')) {
            return cb(new Error('Invalid file type. Only CSV files are allowed.'));
        }

        // Validate file extension
        if (!validateFileExtension(file.originalname, ['.csv'])) {
            return cb(new Error('Invalid file extension. Only .csv files are allowed.'));
        }

        cb(null, true);
    }
});

/**
 * Document upload configuration with validation
 */
export const documentUploadConfig = multer({
    storage: createStorage('uploads/documents/'),
    limits: {
        fileSize: FILE_SIZE_LIMITS.DOCUMENT,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Validate MIME type
        if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
        }

        // Validate file extension
        const allowedExtensions = ['.pdf', '.doc', '.docx'];
        if (!validateFileExtension(file.originalname, allowedExtensions)) {
            return cb(new Error('Invalid file extension.'));
        }

        cb(null, true);
    }
});

/**
 * General file upload configuration
 */
export const generalUploadConfig = multer({
    storage: createStorage('uploads/'),
    limits: {
        fileSize: FILE_SIZE_LIMITS.GENERAL,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Prevent executable files
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.dylib'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (dangerousExtensions.includes(ext)) {
            return cb(new Error('Executable files are not allowed.'));
        }

        cb(null, true);
    }
});

/**
 * Multiple images upload configuration
 */
export const multipleImagesUploadConfig = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: FILE_SIZE_LIMITS.IMAGE,
        files: 10 // Maximum 10 images
    },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only image files are allowed.'));
        }

        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!validateFileExtension(file.originalname, allowedExtensions)) {
            return cb(new Error('Invalid file extension.'));
        }

        cb(null, true);
    }
});

/**
 * Middleware to handle multer errors
 */
export const handleFileUploadError = (err: Error & { code?: string; message: string }, req: Request, res: Response, next: NextFunction): void => {
    if (err instanceof multer.MulterError) {
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

/**
 * Validate that a file was uploaded
 */
export const requireFile = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
        res.status(400).json({
            message: 'No file uploaded',
            error: 'A file is required for this request.'
        });
        return;
    }
    next();
};

/**
 * Validate file metadata
 */
export const validateFileMetadata = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file) {
        next();
        return;
    }

    const file = req.file;

    // Check if filename is suspicious
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        res.status(400).json({
            message: 'Invalid filename',
            error: 'The filename contains invalid characters.'
        });
        return;
    }

    // Check if filename is too long
    if (file.originalname.length > 255) {
        res.status(400).json({
            message: 'Filename too long',
            error: 'The filename must be less than 255 characters.'
        });
        return;
    }

    next();
};
