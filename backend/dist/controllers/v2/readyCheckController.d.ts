import { Request, Response } from 'express';
type AuthRequest = Request & {
    user?: {
        id?: string;
        username?: string;
        currentOrganizationId?: string;
    };
};
export declare class ReadyCheckController {
    private readonly readyCheckService;
    initiateReadyCheck(req: AuthRequest, res: Response): Promise<void>;
    respondToReadyCheck(req: AuthRequest, res: Response): Promise<void>;
    getReadyCheck(req: AuthRequest, res: Response): Promise<void>;
    cancelReadyCheck(req: AuthRequest, res: Response): Promise<void>;
}
export {};
//# sourceMappingURL=readyCheckController.d.ts.map