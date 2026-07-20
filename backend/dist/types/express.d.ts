import { Request } from 'express';
export interface RequestWithFile extends Request {
    file?: Express.Multer.File;
}
export interface RequestWithFiles extends Request {
    files?: Express.Multer.File[];
}
export interface ErrorResponse {
    error: string;
    message?: string;
    details?: unknown;
}
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
//# sourceMappingURL=express.d.ts.map