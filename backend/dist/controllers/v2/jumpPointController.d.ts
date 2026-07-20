import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class JumpPointController extends BaseController {
    private readonly tunnelService;
    constructor();
    private getOwnedTunnel;
    private resolveDiscordNames;
    private enrichTunnels;
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    activate: (req: AuthRequest, res: Response) => Promise<void>;
    deactivate: (req: AuthRequest, res: Response) => Promise<void>;
    getStatus: (req: AuthRequest, res: Response) => Promise<void>;
    getTraffic: (req: AuthRequest, res: Response) => Promise<void>;
    linkByCode: (req: AuthRequest, res: Response) => Promise<void>;
    banUser: (req: AuthRequest, res: Response) => Promise<void>;
    unbanUser: (req: AuthRequest, res: Response) => Promise<void>;
    listBans: (req: AuthRequest, res: Response) => Promise<void>;
    getAnalyticsHistory: (req: AuthRequest, res: Response) => Promise<void>;
    getMessages: (req: AuthRequest, res: Response) => Promise<void>;
    regenerateInviteCode: (req: AuthRequest, res: Response) => Promise<void>;
    getSystemStats: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=jumpPointController.d.ts.map