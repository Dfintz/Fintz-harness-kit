import { User } from '../../models/User';
export interface PublicUserProfile {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    joinedAt?: Date;
    createdAt?: Date;
    lastActiveAt?: Date;
    isPrivateProfile: boolean;
    showShips: boolean;
    showActivity: boolean;
    showRsiInfo?: boolean;
    showVerifiedBadge?: boolean;
    showOrganizations?: boolean;
    showScStats?: boolean;
    bio?: string;
    rsiHandle?: string;
    rsiVerified?: boolean;
    email?: string;
    role?: string;
    organizations?: Array<{
        orgId: string;
        orgName: string;
        orgLogo?: string;
        roleName: string;
    }>;
}
export declare class UserProfileService {
    private static readonly UUID_IDENTIFIER_REGEX;
    private readonly userRepository;
    private findUserById;
    getUserProfile(userId: string): Promise<User | null>;
    updateProfile(userId: string, profileData: Partial<User>): Promise<User>;
    updateAvatar(userId: string, avatarUrl: string): Promise<User>;
    updateDisplayName(userId: string, displayName: string): Promise<User>;
    updateEmail(userId: string, newEmail: string): Promise<User>;
    getUserByEmail(email: string): Promise<User | null>;
    isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean>;
    verifyEmail(userId: string, verificationToken: string): Promise<boolean>;
    requestEmailVerification(userId: string): Promise<string>;
    updateUsername(userId: string, newUsername: string): Promise<User>;
    isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean>;
    getUsernameHistory(userId: string): Promise<Array<{
        username: string;
        changedAt: Date;
    }>>;
    getProfileCompletion(userId: string): Promise<number>;
    getProfileActivity(userId: string): Promise<{
        profileViews: number;
        lastProfileUpdate: Date | null;
        joinedDate: Date;
        emailVerified: boolean;
        profileCompletion: number;
    }>;
    updateProfileVisibility(userId: string, visibilitySettings: {
        profilePublic?: boolean;
        showEmail?: boolean;
        showLocation?: boolean;
        showJoinDate?: boolean;
        allowDirectMessages?: boolean;
    }): Promise<User>;
    private findUserByIdentifier;
    private generateVerificationToken;
    incrementProfileViews(userId: string, viewerUserId?: string): Promise<void>;
    getPublicProfile(identifier: string, requestingUserId: string): Promise<PublicUserProfile | null>;
}
//# sourceMappingURL=UserProfileService.d.ts.map