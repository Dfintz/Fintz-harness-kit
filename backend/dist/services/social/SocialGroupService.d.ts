import { type ParticipantInfo } from '@sc-fleet-manager/shared-types';
import { Activity } from '../../models/Activity';
import { LFGGroupHistory } from '../../models/LFGGroupHistory';
import { LFGActivity, LFGPost } from '../../types';
import { TenantService } from '../base/TenantService';
import type { CreateGroupHistoryParams, GroupHistoryStats, LFGMatch, LFGPreferences, MatchCriteria } from './SocialGroupService.types';
export type { CreateGroupHistoryParams, GroupHistoryStats, LFGMatch, LFGPreferences, MatchCriteria } from './SocialGroupService.types';
export declare class SocialGroupService extends TenantService<Activity> {
    private historyRepository;
    private posts;
    private static instance;
    private cleanupInterval?;
    private readonly sessionService;
    constructor();
    static getInstance(): SocialGroupService;
    stopCleanup(): void;
    createPost(activity: LFGActivity, description: string, creatorId: string, creatorName: string, maxPlayers: number, guildId: string, channelId: string, expirationMinutes?: number, options?: {
        voiceChannelId?: string;
        isAutoLfg?: boolean;
        game?: string;
        isPublic?: boolean;
    }): LFGPost;
    getPost(postId: string): LFGPost | undefined;
    getActivePostsByGuild(guildId: string): Promise<LFGPost[]>;
    private hydrateFromRedis;
    getAllActivePosts(): Promise<LFGPost[]>;
    joinPost(postId: string, userId: string): LFGPost;
    leavePost(postId: string, userId: string): LFGPost;
    closePost(postId: string, userId: string): LFGPost;
    deletePost(postId: string): void;
    setMessageId(postId: string, messageId: string): void;
    private persistMessageIdToRedis;
    private closeRedisSession;
    clearAllPosts(): void;
    static toParticipantInfo(userId: string, post: LFGPost, options?: {
        username?: string;
        displayName?: string;
    }): ParticipantInfo;
    toParticipantInfo(userId: string, post: LFGPost, options?: {
        username?: string;
        displayName?: string;
    }): ParticipantInfo;
    private cleanupExpiredPosts;
    private markExpiredPostsAsClosed;
    private removeStaleClosedPosts;
    private editExpiredMessage;
    private deleteExpiredMessage;
    private deleteAutoCreatedVoiceChannel;
    private getDiscordClient;
    finalizeClosedSession(post: LFGPost): Promise<void>;
    recordSession(params: CreateGroupHistoryParams): Promise<LFGGroupHistory[]>;
    recordFromLFGPost(post: LFGPost, wasSuccessful: boolean, durationMinutes?: number, completionNote?: string, submittedBy?: string): Promise<LFGGroupHistory[]>;
    getUserHistory(userId: string, limit?: number): Promise<LFGGroupHistory[]>;
    getUserHistoryByActivity(userId: string, activity: string, limit?: number): Promise<LFGGroupHistory[]>;
    getUserStats(userId: string): Promise<GroupHistoryStats>;
    getUserActivityStats(userId: string): Promise<{
        [activity: string]: {
            sessions: number;
            successful: number;
            averageRating: number;
        };
    }>;
    getRecentSessions(guildId: string, limit?: number): Promise<LFGGroupHistory[]>;
    getSession(sessionId: string): Promise<LFGGroupHistory | null>;
    getSharedSessions(userId1: string, userId2: string, limit?: number): Promise<LFGGroupHistory[]>;
    findFrequentPositiveMatches(userId: string, guildId: string, minSessions?: number): Promise<Array<{
        userId: string;
        sharedSessionCount: number;
        mutualPositive: boolean;
    }>>;
    cleanupOldHistory(daysOld?: number): Promise<number>;
    findMatches(userId: string, preferences: LFGPreferences, criteria: MatchCriteria, organizationId?: string): Promise<LFGMatch[]>;
    private calculateMatchScore;
    private getMatchReasons;
    formalizeToActivity(lfgPostId: string): Promise<Activity>;
    completeLFG(lfgPostId: string, wasSuccessful: boolean, createActivityRecord?: boolean, recordHistory?: boolean): Promise<void>;
    convertToTeam(lfgPostId: string, organizationId: string, teamName: string, teamType?: string): Promise<{
        teamId: string;
        memberCount: number;
    }>;
    convertToTeamFromUsers(guildId: string, memberIds: string[], teamName: string, leaderId: string, teamType?: string): Promise<{
        teamId: string;
        memberCount: number;
    }>;
    private getOrganizationIdForGuild;
}
//# sourceMappingURL=SocialGroupService.d.ts.map