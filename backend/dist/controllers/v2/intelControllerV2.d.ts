import { Request, Response } from 'express';
declare function getIntelEntries(req: Request, res: Response): Promise<void>;
declare function getIntelEntry(req: Request, res: Response): Promise<void>;
declare function updateIntelVisibility(req: Request, res: Response): Promise<void>;
declare function healthCheck(_req: Request, res: Response): Promise<void>;
export declare const intelControllerV2: {
    getIntelEntries: typeof getIntelEntries;
    getIntelEntry: typeof getIntelEntry;
    updateIntelVisibility: typeof updateIntelVisibility;
    healthCheck: typeof healthCheck;
};
export {};
//# sourceMappingURL=intelControllerV2.d.ts.map