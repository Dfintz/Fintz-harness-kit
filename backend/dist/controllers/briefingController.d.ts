import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class BriefingController extends BaseController {
    private readonly briefingService;
    private readonly briefingDiscordService;
    constructor();
    createBriefing: (req: Request, res: Response) => Promise<void>;
    getBriefing: (req: Request, res: Response) => Promise<void>;
    postToDiscord: (req: Request, res: Response) => Promise<void>;
    getAllBriefings: (req: Request, res: Response) => Promise<void>;
    getBriefingsByMission: (req: Request, res: Response) => Promise<void>;
    updateBriefing: (req: Request, res: Response) => Promise<void>;
    deleteBriefing: (req: Request, res: Response) => Promise<void>;
    addElement: (req: Request, res: Response) => Promise<void>;
    updateElement: (req: Request, res: Response) => Promise<void>;
    deleteElement: (req: Request, res: Response) => Promise<void>;
    addParticipant: (req: Request, res: Response) => Promise<void>;
    removeParticipant: (req: Request, res: Response) => Promise<void>;
    updateStatus: (req: Request, res: Response) => Promise<void>;
    createVersion: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=briefingController.d.ts.map