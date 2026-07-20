import { Request, Response } from 'express';
type AuthRequest = Request & {
    user?: {
        id?: string;
        username?: string;
        currentOrganizationId?: string;
    };
};
export declare class OperationCommandController {
    private readonly commandService;
    setCommandChain(req: AuthRequest, res: Response): Promise<void>;
    getCommandChain(req: AuthRequest, res: Response): Promise<void>;
    issueCommand(req: AuthRequest, res: Response): Promise<void>;
    getCommands(req: AuthRequest, res: Response): Promise<void>;
    getCommand(req: AuthRequest, res: Response): Promise<void>;
    acknowledgeCommand(req: AuthRequest, res: Response): Promise<void>;
    preflightCheck(req: AuthRequest, res: Response): Promise<void>;
}
export {};
//# sourceMappingURL=operationCommandController.d.ts.map