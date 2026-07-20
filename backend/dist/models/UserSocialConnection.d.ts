import { User } from './User';
export declare enum UserSocialConnectionType {
    FRIEND = "friend",
    FOLLOWER = "follower",
    BLOCKED = "blocked"
}
export declare enum UserSocialConnectionStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    REJECTED = "rejected"
}
export declare class UserSocialConnection {
    id: string;
    userId: string;
    user: User;
    targetUserId: string;
    targetUser: User;
    connectionType: UserSocialConnectionType;
    status: UserSocialConnectionStatus;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=UserSocialConnection.d.ts.map