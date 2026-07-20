export declare class MemberEngagement {
    id: string;
    guildId: string;
    userId: string;
    date: string;
    messageCount: number;
    voiceMinutes: number;
    reactionsGiven: number;
    threadsCreated: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class StatRole {
    id: string;
    guildId: string;
    roleId: string;
    roleName: string;
    minMessages: number;
    minVoiceMinutes: number;
    windowDays: number;
    autoRemove: boolean;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class ChannelCounter {
    id: string;
    guildId: string;
    channelId: string;
    counterType: string;
    nameTemplate: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class InviteTracking {
    id: string;
    guildId: string;
    invitedUserId: string;
    inviterUserId?: string;
    inviteCode?: string;
    joinedAt: Date;
    createdAt: Date;
}
//# sourceMappingURL=MemberEngagement.d.ts.map