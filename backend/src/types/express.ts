import { Request } from 'express';

/**
 * Express Request with Multer file upload
 */
export interface RequestWithFile extends Request {
    file?: Express.Multer.File;
}

/**
 * Express Request with multiple Multer file uploads
 */
export interface RequestWithFiles extends Request {
    files?: Express.Multer.File[];
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
    error: string;
    message?: string;
    details?: unknown;
}

/**
 * CSV Row data structure for ship imports
 */
export interface ShipCSVRow {
    id?: string;
    name: string;
    type: string;
    manufacturer: string;
    ownerId?: string;
    quantity?: string;
    insurance?: string;
    [key: string]: string | undefined;
}
