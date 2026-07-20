import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class PollController extends BaseController {
    private readonly pollService;
    private readonly discordPollService;
    constructor();
    listPolls: (req: AuthRequest, res: Response) => Promise<void>;
    createPoll: (req: AuthRequest, res: Response) => Promise<void>;
    getPoll: (req: AuthRequest, res: Response) => Promise<void>;
    updatePoll: (req: AuthRequest, res: Response) => Promise<void>;
    deletePoll: (req: AuthRequest, res: Response) => Promise<void>;
    castVote: (req: AuthRequest, res: Response) => Promise<void>;
    getResults: (req: AuthRequest, res: Response) => Promise<void>;
    closePoll: (req: AuthRequest, res: Response) => Promise<void>;
    mirrorToGuild: (req: AuthRequest, res: Response) => Promise<void>;
    mirrorToFederation: (req: AuthRequest, res: Response) => Promise<void>;
    listMirrors: (req: AuthRequest, res: Response) => Promise<void>;
    deleteMirror: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=pollController.d.ts.map