import { type ParticipantInfo } from '@sc-fleet-manager/shared-types';
export declare enum LFGSessionStatus {
    OPEN = "open",
    FULL = "full",
    IN_PROGRESS = "in-progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export interface LFGSession {
    id: string;
    hostUserId: string;
    organizationId: string;
    activityType: string;
    title: string;
    description?: string;
    maxPlayers: number;
    minPlayers?: number;
    currentPlayers: string[];
    status: LFGSessionStatus;
    scheduledAt?: Date;
    createdAt: Date;
    expiresAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
    tags?: string[];
}
export interface CreateLFGSessionDto {
    hostUserId: string;
    organizationId: string;
    activityType: string;
    title: string;
    description?: string;
    maxPlayers: number;
    minPlayers?: number;
    scheduledAt?: Date;
    metadata?: Record<string, unknown>;
    tags?: string[];
    ttlSeconds?: number;
}
export interface LFGSessionFilterOptions {
    activityType?: string;
    organizationId?: string;
    status?: LFGSessionStatus | LFGSessionStatus[];
    minAvailableSlots?: number;
    tags?: string[];
    hostUserId?: string;
}
export interface JoinSessionResult {
    success: boolean;
    session?: LFGSession;
    error?: string;
}
export declare class LFGSessionService {
    private readonly SESSION_PREFIX;
    private readonly ACTIVITY_PREFIX;
    private readonly ORG_PREFIX;
    private readonly USER_SESSIONS_PREFIX;
    private readonly HOST_PREFIX;
    private readonly GUILD_PREFIX;
    private readonly DEFAULT_TTL;
    createSession(data: CreateLFGSessionDto): Promise<LFGSession>;
    getSession(sessionId: string): Promise<LFGSession | null>;
    static toParticipantInfo(userId: string, session: LFGSession, options?: {
        username?: string;
        displayName?: string;
    }): ParticipantInfo;
    toParticipantInfo(userId: string, session: LFGSession, options?: {
        username?: string;
        displayName?: string;
    }): ParticipantInfo;
    updateSession(sessionId: string, updates: Partial<LFGSession>): Promise<LFGSession | null>;
    joinSession(sessionId: string, userId: string): Promise<JoinSessionResult>;
    leaveSession(sessionId: string, userId: string): Promise<JoinSessionResult>;
    startSession(sessionId: string, userId: string): Promise<JoinSessionResult>;
    completeSession(sessionId: string, userId: string): Promise<JoinSessionResult>;
    cancelSession(sessionId: string, userId: string): Promise<JoinSessionResult>;
    findOpenSessions(filters?: LFGSessionFilterOptions): Promise<LFGSession[]>;
    getUserSessions(userId: string): Promise<LFGSession[]>;
    getHostedSessions(userId: string): Promise<LFGSession[]>;
    getSessionCountByActivity(activityType: string): Promise<number>;
    extendSession(sessionId: string, additionalSeconds: number): Promise<LFGSession | null>;
    private cleanupSessionIndexes;
    private deserializeSession;
    getSessionsByGuild(guildId: string): Promise<LFGSession[]>;
    healthCheck(): Promise<{
        healthy: boolean;
        sessionCount: number;
    }>;
}
export declare const lfgSessionService: LFGSessionService;
//# sourceMappingURL=LFGSessionService.d.ts.map