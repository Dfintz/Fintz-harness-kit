import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class WikiController extends BaseController {
    private wikiService;
    constructor();
    createPage: (req: Request, res: Response) => Promise<void>;
    getPage: (req: Request, res: Response) => Promise<void>;
    getAllPages: (req: Request, res: Response) => Promise<void>;
    updatePage: (req: Request, res: Response) => Promise<void>;
    deletePage: (req: Request, res: Response) => Promise<void>;
    getPageTree: (req: Request, res: Response) => Promise<void>;
    movePage: (req: Request, res: Response) => Promise<void>;
    getRevisions: (req: Request, res: Response) => Promise<void>;
    getRevision: (req: Request, res: Response) => Promise<void>;
    restoreRevision: (req: Request, res: Response) => Promise<void>;
    searchPages: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=wikiController.d.ts.map