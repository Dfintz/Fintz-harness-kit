import { Request, Response } from 'express';
export declare class RsiCrawlerController {
    listOrganizations: (req: Request, res: Response) => Promise<void>;
    getOrganization: (req: Request, res: Response) => Promise<void>;
    getOrganizationMembers: (req: Request, res: Response) => Promise<void>;
    getUserMemberships: (req: Request, res: Response) => Promise<void>;
    refreshOrganization: (req: Request, res: Response) => Promise<void>;
    private readonly runPostCrawlPipeline;
    getStatistics: (req: Request, res: Response) => Promise<void>;
    deleteOrganization: (req: Request, res: Response) => Promise<void>;
    clearCache: (_req: Request, res: Response) => void;
    getMemberCountHistory: (req: Request, res: Response) => Promise<void>;
}
export declare const rsiCrawlerController: RsiCrawlerController;
//# sourceMappingURL=rsiCrawlerController.d.ts.map