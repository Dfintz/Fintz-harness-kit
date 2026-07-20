export interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
}
export interface OrgRelationship {
    orgId: string;
    targetOrgId: string;
    relationship: string;
}
export declare enum EventRole {
    PILOT = "pilot",
    ENGINEER = "engineer",
    GUNNER = "gunner",
    MEDIC = "medic",
    VEHICLE_OPERATOR = "vehicle_operator",
    MARINE = "marine",
    GROUND_SUPPORT = "ground_support",
    TANK = "tank",
    DPS = "dps",
    SUPPORT = "support",
    ANY = "any"
}
export declare enum RSVPStatus {
    ACCEPTED = "accepted",
    TENTATIVE = "tentative",
    DECLINED = "declined"
}
export declare enum RecurrencePattern {
    NONE = "none",
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly"
}
export interface EventAttendee {
    userId: string;
    role: EventRole;
    status: RSVPStatus;
    shipName?: string;
    shipType?: string;
}
export interface Event {
    id: string;
    title: string;
    description: string;
    date: Date;
    location: string;
    attendees: string[];
    attendeesDetailed?: EventAttendee[];
    organizerId?: string;
    organizationId?: string;
    sharedWithOrgs?: string[];
    roleRequirements?: {
        [key in EventRole]?: number;
    };
    autoRemind?: boolean;
    reminderTime?: Date;
    recurrencePattern?: RecurrencePattern;
    recurrenceEndDate?: Date;
    parentEventId?: string;
    isTemplate?: boolean;
    templateId?: string;
    waitlist?: string[];
    maxAttendees?: number;
    discordServerId?: string;
}
export declare enum LFGActivity {
    PVP = "PvP",
    PVE = "PvE",
    MINING = "Mining",
    TRADING = "Trading",
    EXPLORATION = "Exploration",
    BOUNTY_HUNTING = "Bounty Hunting",
    CARGO_HAULING = "Cargo Hauling",
    RACING = "Racing",
    OTHER = "Other"
}
export interface LFGPost {
    id: string;
    activity: LFGActivity;
    description: string;
    creatorId: string;
    creatorName: string;
    currentPlayers: number;
    maxPlayers: number;
    members: string[];
    createdAt: Date;
    expiresAt: Date;
    guildId: string;
    channelId: string;
    voiceChannelId?: string;
    autoCreatedVoiceChannel?: boolean;
    isAutoLfg?: boolean;
    status: 'open' | 'full' | 'closed';
    messageId?: string;
    game?: string;
    postedToServers?: string[];
    isPublic?: boolean;
}
export declare enum VoiceChannelType {
    EVENT = "event",
    ACTIVITY = "activity",
    TEMPORARY = "temporary",
    PERMANENT = "permanent",
    DYNAMIC = "dynamic"
}
export interface VoiceActivityLog {
    userId: string;
    userName: string;
    channelId: string;
    channelName: string;
    guildId: string;
    action: 'join' | 'leave' | 'move';
    timestamp: Date;
}
export interface VoiceChannel {
    id: string;
    name: string;
    guildId: string;
    channelId: string;
    type: VoiceChannelType;
    creatorId: string;
    eventId?: string;
    createdAt: Date;
    expiresAt?: Date;
    userLimit?: number;
    isTemporary: boolean;
    activityLogs: VoiceActivityLog[];
    templateId?: string;
    bitrate?: number;
    customizations?: {
        name?: string;
        userLimit?: number;
        bitrate?: number;
        permissions?: Record<string, unknown>;
    };
}
export interface VoiceChannelTemplate {
    id: string;
    name: string;
    description: string;
    userLimit: number;
    bitrate: number;
    category?: string;
    permissions?: {
        canSpeak?: boolean;
        canStream?: boolean;
        canUseVoiceActivity?: boolean;
        canPrioritySpeaker?: boolean;
    };
    autoDelete: boolean;
    autoDeleteDelay: number;
    namingPattern?: string;
    icon?: string;
    createdAt: Date;
    createdBy: string;
}
export interface VoiceChannelConfig {
    guildId: string;
    enabled: boolean;
    creatorChannelId?: string;
    categoryId?: string;
    defaultTemplate?: string;
    maxChannelsPerUser: number;
    maxTotalChannels: number;
    autoCleanup: boolean;
    cleanupInterval: number;
    trackStats: boolean;
}
export interface ChannelUsageStats {
    channelId: string;
    guildId: string;
    totalSessions: number;
    totalUsers: number;
    totalDuration: number;
    averageDuration: number;
    peakUsers: number;
    lastUsed: Date;
    userStats: Map<string, {
        userId: string;
        username: string;
        sessionCount: number;
        totalTime: number;
    }>;
}
export declare enum PermissionTemplateType {
    ADMIN = "admin",
    MODERATOR = "moderator",
    MEMBER = "member",
    RECRUITER = "recruiter",
    FLEET_COMMANDER = "fleet_commander",
    EVENT_COORDINATOR = "event_coordinator",
    FINANCE_MANAGER = "finance_manager",
    GUEST = "guest",
    CUSTOM = "custom"
}
export interface PermissionTemplateItem {
    resource: string;
    action: string;
    description?: string;
}
export interface PermissionTemplate {
    id: string;
    name: string;
    type: PermissionTemplateType;
    description: string;
    permissions: PermissionTemplateItem[];
    securityLevel: number;
    isSystemTemplate: boolean;
    organizationId?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface PermissionUsageStats {
    userId: string;
    username: string;
    organizationId: string;
    organizationName: string;
    totalPermissions: number;
    activePermissions: number;
    expiredPermissions: number;
    lastUsed?: Date;
    mostUsedPermissions: Array<{
        resource: string;
        action: string;
        usageCount: number;
    }>;
}
export interface PermissionAuditEntry {
    id: string;
    eventType: 'GRANT' | 'REVOKE' | 'UPDATE' | 'EXPIRE' | 'TEMPLATE_APPLY' | 'SECURITY_LEVEL_CHANGE';
    userId: string;
    username: string;
    organizationId: string;
    targetUserId?: string;
    targetUsername?: string;
    resource?: string;
    action?: string;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string;
    performedBy: string;
    performedByUsername: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
export interface PermissionUsageReport {
    organizationId: string;
    organizationName: string;
    reportDate: Date;
    totalUsers: number;
    totalPermissions: number;
    activePermissions: number;
    expiredPermissions: number;
    permissionsByType: Record<string, number>;
    topUsers: PermissionUsageStats[];
    recentChanges: PermissionAuditEntry[];
    securityLevelDistribution: Record<number, number>;
    templatesUsed: Record<string, number>;
}
export * from './models';
//# sourceMappingURL=index.d.ts.map