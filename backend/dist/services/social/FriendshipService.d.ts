import { UserSocialConnection } from '../../models/UserSocialConnection';
export interface FriendSummary {
    connectionId: string;
    userId: string;
    username: string;
    connectedAt: Date;
}
export interface FriendRequestSummary {
    connectionId: string;
    fromUserId: string;
    fromUsername: string;
    createdAt: Date;
}
export declare class FriendshipService {
    private static instance;
    private readonly connectionRepo;
    private readonly userRepo;
    private constructor();
    static getInstance(): FriendshipService;
    sendFriendRequest(userId: string, targetUserId: string): Promise<UserSocialConnection>;
    acceptFriendRequest(userId: string, requesterId: string): Promise<UserSocialConnection>;
    rejectFriendRequest(userId: string, requesterId: string): Promise<void>;
    removeFriend(userId: string, otherUserId: string): Promise<void>;
    getFriends(userId: string): Promise<FriendSummary[]>;
    getIncomingRequests(userId: string): Promise<FriendRequestSummary[]>;
    getFriendUserIds(userId: string): Promise<Set<string>>;
    private findFriendConnection;
    private acceptByConnection;
}
export declare const friendshipService: FriendshipService;
//# sourceMappingURL=FriendshipService.d.ts.map