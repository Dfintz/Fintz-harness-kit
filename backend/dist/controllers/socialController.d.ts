import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class SocialController {
    private readonly socialGroupService;
    constructor();
    private parseStatusFilter;
    createGroup(req: AuthRequest, res: Response): void;
    listGroups(req: AuthRequest, res: Response): Promise<void>;
    joinGroup(req: AuthRequest, res: Response): void;
    leaveGroup(req: AuthRequest, res: Response): void;
    closeGroup(req: AuthRequest, res: Response): void;
    convertGroupToTeam(req: AuthRequest, res: Response): Promise<void>;
    createSession(req: AuthRequest, res: Response): Promise<void>;
    listSessions(req: AuthRequest, res: Response): Promise<void>;
    getSession(req: AuthRequest, res: Response): Promise<void>;
    joinSession(req: AuthRequest, res: Response): Promise<void>;
    leaveSession(req: AuthRequest, res: Response): Promise<void>;
    startSession(req: AuthRequest, res: Response): Promise<void>;
    completeSession(req: AuthRequest, res: Response): Promise<void>;
    cancelSession(req: AuthRequest, res: Response): Promise<void>;
    getFriends(req: AuthRequest, res: Response): Promise<void>;
    addFriend(req: AuthRequest, res: Response): Promise<void>;
    removeFriend(req: AuthRequest, res: Response): Promise<void>;
    acceptFriend(req: AuthRequest, res: Response): Promise<void>;
    private handleFriendshipError;
    blockUser(req: AuthRequest, res: Response): void;
    unblockUser(req: AuthRequest, res: Response): void;
    getFeed(req: AuthRequest, res: Response): void;
    createPost(req: AuthRequest, res: Response): void;
    likePost(req: AuthRequest, res: Response): void;
    getPresence(req: AuthRequest, res: Response): void;
}
export declare const socialController: SocialController;
//# sourceMappingURL=socialController.d.ts.map