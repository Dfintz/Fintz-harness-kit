import { Response } from 'express';
import { RequestWithFile } from '../types/express';
import { BaseController } from './BaseController';
export declare class ImageController extends BaseController {
    private readonly azureBlobService;
    constructor();
    uploadImage: (req: RequestWithFile, res: Response) => Promise<void>;
    private saveToLocalFilesystem;
    downloadImage: (req: RequestWithFile, res: Response) => Promise<void>;
    private getImageContentType;
    private sendImageResponse;
    private serveLocalImage;
    getImageUrl: (req: RequestWithFile, res: Response) => Promise<void>;
    deleteImage: (req: RequestWithFile, res: Response) => Promise<void>;
    validateImage: (req: RequestWithFile, res: Response) => Promise<void>;
    listImages: (req: RequestWithFile, res: Response) => Promise<void>;
}
//# sourceMappingURL=imageController.d.ts.map