import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare class DiscordControllerV2 {
    getUserRoles(req: Request, res: Response): Promise<void>;
    assignRole(req: Request, res: Response): Promise<void>;
    removeRole(req: Request, res: Response): Promise<void>;
    getGuildRoles(req: Request, res: Response): Promise<void>;
    getGuildInfo(req: Request, res: Response): Promise<void>;
    getGuildMembers(req: Request, res: Response): Promise<void>;
    checkMyMembership(req: AuthRequest, res: Response): Promise<void>;
    getGuildChannels(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=discordController.d.ts.map