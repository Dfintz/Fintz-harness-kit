import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
export declare const ALLOWED_IMAGE_TYPES: string[];
export declare const ALLOWED_CSV_TYPES: string[];
export declare const ALLOWED_DOCUMENT_TYPES: string[];
export declare const FILE_SIZE_LIMITS: {
    IMAGE: number;
    CSV: number;
    DOCUMENT: number;
    GENERAL: number;
};
export declare const imageUploadConfig: multer.Multer;
export declare const csvUploadConfig: multer.Multer;
export declare const documentUploadConfig: multer.Multer;
export declare const generalUploadConfig: multer.Multer;
export declare const multipleImagesUploadConfig: multer.Multer;
export declare const handleFileUploadError: (err: Error & {
    code?: string;
    message: string;
}, req: Request, res: Response, next: NextFunction) => void;
export declare const requireFile: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateFileMetadata: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=fileValidation.d.ts.map