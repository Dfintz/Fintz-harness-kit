import { Poll } from './Poll';
export declare enum PollMirrorStatus {
    PENDING = "pending",
    ACTIVE = "active",
    CLOSED = "closed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare enum PollMirrorScope {
    ORGANIZATION = "organization",
    FEDERATION = "federation"
}
export declare const MAX_MIRROR_RETRY_COUNT = 3;
export declare class PollDiscordMirror {
    id: string;
    pollId: string;
    poll: Poll;
    scope: PollMirrorScope;
    federationId?: string;
    organizationId: string;
    guildId: string;
    channelId?: string;
    messageId?: string;
    status: PollMirrorStatus;
    retryCount: number;
    errorMessage?: string;
    deliveredAt?: Date;
    lastUpdatedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    get isPending(): boolean;
    get isActive(): boolean;
    get isClosed(): boolean;
    get isFailed(): boolean;
    get canRetry(): boolean;
}
//# sourceMappingURL=PollDiscordMirror.d.ts.map