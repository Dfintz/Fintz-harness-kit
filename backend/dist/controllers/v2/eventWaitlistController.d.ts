import { Request, Response } from 'express';
export declare class EventWaitlistControllerV2 {
    private waitlistService;
    constructor();
    joinWaitlist(req: Request, res: Response): Promise<void>;
    leaveWaitlist(req: Request, res: Response): Promise<void>;
    getWaitlist(req: Request, res: Response): Promise<void>;
    promoteFromWaitlist(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=eventWaitlistController.d.ts.map