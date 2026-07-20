import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class DocumentController extends BaseController {
    private readonly documentService;
    constructor();
    listDocuments: (req: AuthRequest, res: Response) => Promise<void>;
    uploadDocument: (req: AuthRequest, res: Response) => Promise<void>;
    getDocument: (req: AuthRequest, res: Response) => Promise<void>;
    updateDocument: (req: AuthRequest, res: Response) => Promise<void>;
    deleteDocument: (req: AuthRequest, res: Response) => Promise<void>;
    downloadDocument: (req: AuthRequest, res: Response) => Promise<void>;
    shareDocument: (req: AuthRequest, res: Response) => Promise<void>;
    uploadVersion: (req: AuthRequest, res: Response) => Promise<void>;
    getVersionHistory: (req: AuthRequest, res: Response) => Promise<void>;
    getFolderTree: (req: AuthRequest, res: Response) => Promise<void>;
    createFolder: (req: AuthRequest, res: Response) => Promise<void>;
    updateFolder: (req: AuthRequest, res: Response) => Promise<void>;
    deleteFolder: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=documentController.d.ts.map