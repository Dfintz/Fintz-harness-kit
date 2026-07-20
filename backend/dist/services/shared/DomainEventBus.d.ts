export interface DomainEventBase {
    readonly timestamp: string;
    readonly correlationId?: string;
}
export interface MemberDiscordLeftPayload extends DomainEventBase {
    readonly userId: string;
    readonly discordId: string;
    readonly discordUsername: string;
    readonly guildId: string;
    readonly guildName: string;
    readonly organizationId: string;
    readonly reason: 'kick' | 'ban' | 'leave' | null;
}
export interface MemberDiscordRoleChangedPayload extends DomainEventBase {
    readonly userId: string;
    readonly discordId: string;
    readonly guildId: string;
    readonly organizationId: string;
    readonly addedRoles: readonly string[];
    readonly removedRoles: readonly string[];
}
export interface MemberDiscordTimeoutPayload extends DomainEventBase {
    readonly userId: string;
    readonly discordId: string;
    readonly guildId: string;
    readonly guildName: string;
    readonly organizationId: string;
    readonly durationMinutes: number;
    readonly moderatorDiscordId?: string;
    readonly reason?: string;
}
export interface RsiOrgLeftPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly rsiHandle: string;
    readonly rsiOrgSid: string;
    readonly rsiOrgName: string;
}
export interface RsiOrgJoinedPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly rsiHandle: string;
    readonly rsiOrgSid: string;
    readonly rsiOrgName: string;
    readonly isHostile: boolean;
    readonly isRedacted: boolean;
}
export interface RsiRankChangedPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly rsiHandle: string;
    readonly rsiOrgSid: string;
    readonly oldRank: string;
    readonly newRank: string;
}
export interface RsiSyncFailedPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly rsiHandle: string;
    readonly failureReason: string;
    readonly consecutiveFailures: number;
}
export interface RsiHandleChangedPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly oldHandle: string;
    readonly newHandle: string;
    readonly rsiOrgSid: string;
}
export interface RsiOrgDissolvedPayload extends DomainEventBase {
    readonly organizationId: string;
    readonly rsiOrgSid: string;
    readonly rsiOrgName: string;
    readonly affectedUserIds: readonly string[];
}
export interface MemberDiscordUnlinkedPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly discordId: string;
    readonly discordUsername?: string;
}
export interface ModerationActionPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly incidentId: string;
    readonly incidentType: string;
    readonly severity: number;
    readonly moderatorId: string;
    readonly reason?: string;
    readonly isShared: boolean;
}
export interface PrimaryOrgSwitchedPayload extends DomainEventBase {
    readonly userId: string;
    readonly previousOrgId: string | null;
    readonly newOrgId: string;
}
export interface PrimaryOrgClearedPayload extends DomainEventBase {
    readonly userId: string;
    readonly previousOrgId: string;
    readonly reason: 'manual_clear' | 'system_stale_membership';
    readonly staleOrganizationId?: string;
    readonly path?: string;
}
export interface MemberPlatformLeftPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly username: string;
}
export interface MemberPlatformRoleChangedPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly previousRoleName: string;
    readonly newRoleName: string;
    readonly performedById: string;
}
export interface TeamCreatedPayload extends DomainEventBase {
    readonly teamId: string;
    readonly organizationId: string;
    readonly teamName: string;
    readonly teamType: string;
    readonly parentTeamId?: string;
    readonly createdBy?: string;
}
export interface TeamDeletedPayload extends DomainEventBase {
    readonly teamId: string;
    readonly organizationId: string;
    readonly teamName: string;
    readonly memberCount: number;
}
export interface TeamMemberAddedPayload extends DomainEventBase {
    readonly teamId: string;
    readonly organizationId: string;
    readonly userId: string;
    readonly role: string;
    readonly teamName: string;
}
export interface TeamMemberRemovedPayload extends DomainEventBase {
    readonly teamId: string;
    readonly organizationId: string;
    readonly userId: string;
    readonly teamName: string;
    readonly reason?: string;
}
export interface ActivityCreatedPayload extends DomainEventBase {
    readonly activityId: string;
    readonly organizationId: string;
    readonly activityType: string;
    readonly title: string;
    readonly hostUserId: string;
    readonly scheduledAt?: string;
    readonly maxParticipants?: number;
    readonly timezone?: string;
    readonly description?: string;
    readonly location?: string;
    readonly estimatedDuration?: number;
    readonly voiceChannelMode?: 'none' | 'current' | 'temp';
    readonly voiceChannelLimit?: number;
    readonly discordServerId?: string;
}
export interface ActivityCompletedPayload extends DomainEventBase {
    readonly activityId: string;
    readonly organizationId: string;
    readonly participantCount: number;
}
export interface ActivityCancelledPayload extends DomainEventBase {
    readonly activityId: string;
    readonly organizationId: string;
    readonly reason?: string;
    readonly participantCount: number;
}
export interface ActivityRescheduledPayload extends DomainEventBase {
    readonly activityId: string;
    readonly organizationId: string;
    readonly previousStartDate?: string;
    readonly newStartDate: string;
    readonly newEndDate?: string;
    readonly reason?: string;
}
export interface ActivityUpdatedPayload extends DomainEventBase {
    readonly activityId: string;
    readonly organizationId: string;
    readonly updatedFields: string[];
    readonly title?: string;
    readonly description?: string;
    readonly scheduledAt?: string;
    readonly timezone?: string;
    readonly estimatedDuration?: number;
    readonly location?: string;
}
export interface ActivityDeletedPayload extends DomainEventBase {
    readonly activityId: string;
    readonly organizationId: string;
    readonly discordEventId?: string;
}
export interface TeamMemberStatusChangedPayload extends DomainEventBase {
    readonly teamId: string;
    readonly organizationId: string;
    readonly userId: string;
    readonly memberName?: string;
    readonly previousStatus: string;
    readonly newStatus: string;
}
export interface TeamEmblemUpdatedPayload extends DomainEventBase {
    readonly teamId: string;
    readonly organizationId: string;
    readonly emblemUrl: string | null;
}
export interface AvailabilityUpdatedPayload extends DomainEventBase {
    readonly userId: string;
    readonly organizationId: string;
    readonly slotCount: number;
}
export interface DomainEventMap {
    'member:discord_left': MemberDiscordLeftPayload;
    'member:discord_role_changed': MemberDiscordRoleChangedPayload;
    'member:discord_timeout': MemberDiscordTimeoutPayload;
    'member:rsi_org_left': RsiOrgLeftPayload;
    'member:rsi_org_joined': RsiOrgJoinedPayload;
    'member:rsi_rank_changed': RsiRankChangedPayload;
    'member:rsi_sync_failed': RsiSyncFailedPayload;
    'member:rsi_handle_changed': RsiHandleChangedPayload;
    'member:rsi_org_dissolved': RsiOrgDissolvedPayload;
    'member:moderation_action': ModerationActionPayload;
    'member:primary_org_switched': PrimaryOrgSwitchedPayload;
    'member:primary_org_cleared': PrimaryOrgClearedPayload;
    'member:platform_left': MemberPlatformLeftPayload;
    'member:platform_role_changed': MemberPlatformRoleChangedPayload;
    'member:discord_unlinked': MemberDiscordUnlinkedPayload;
    'team:created': TeamCreatedPayload;
    'team:deleted': TeamDeletedPayload;
    'team:member_added': TeamMemberAddedPayload;
    'team:member_removed': TeamMemberRemovedPayload;
    'team:member_status_changed': TeamMemberStatusChangedPayload;
    'team:emblem_updated': TeamEmblemUpdatedPayload;
    'activity:created': ActivityCreatedPayload;
    'activity:completed': ActivityCompletedPayload;
    'activity:cancelled': ActivityCancelledPayload;
    'activity:rescheduled': ActivityRescheduledPayload;
    'activity:updated': ActivityUpdatedPayload;
    'activity:deleted': ActivityDeletedPayload;
    'availability:updated': AvailabilityUpdatedPayload;
    'analytics:cas_updated': {
        organizationId: string;
        score: number;
        previousScore: number;
        tier: string;
        previousTier: string;
        breakdown: Record<string, number>;
        computedAt: string;
    };
}
export type DomainEventName = keyof DomainEventMap;
type DomainEventListener<T> = (payload: T) => void | Promise<void>;
export declare class DomainEventBus {
    private readonly emitter;
    private static instance;
    constructor();
    static getInstance(): DomainEventBus;
    static resetInstance(): void;
    emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]): void;
    private safeWrap;
    on<K extends DomainEventName>(event: K, listener: DomainEventListener<DomainEventMap[K]>): this;
    once<K extends DomainEventName>(event: K, listener: DomainEventListener<DomainEventMap[K]>): this;
    off<K extends DomainEventName>(event: K, listener: DomainEventListener<DomainEventMap[K]>): this;
    removeAllListeners(event?: DomainEventName): this;
    listenerCount(event: DomainEventName): number;
    activeEvents(): DomainEventName[];
}
export declare const domainEvents: DomainEventBus;
export {};
//# sourceMappingURL=DomainEventBus.d.ts.map