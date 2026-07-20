export type TeamChannelSyncStatus = 'synced' | 'pending' | 'error';
export declare class TeamDiscordChannel {
    id: string;
    organizationId: string;
    teamId: string;
    guildId: string;
    categoryId: string;
    textChannelId: string;
    voiceChannelId: string;
    teamRoleId: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    lastSyncedAt?: Date;
    syncStatus: TeamChannelSyncStatus;
    lastSyncError?: string;
}
//# sourceMappingURL=TeamDiscordChannel.d.ts.map