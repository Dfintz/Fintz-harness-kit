import { Client } from 'discord.js';
import { TeamDiscordChannel } from '../../models/TeamDiscordChannel';
export declare class TeamVoiceService {
    private static instance;
    private client;
    private channelRepository;
    private settingsRepository;
    private userRepository;
    private initialized;
    private readonly teamCreatedListener;
    private readonly teamDeletedListener;
    private readonly teamMemberAddedListener;
    private readonly teamMemberRemovedListener;
    private constructor();
    static getInstance(): TeamVoiceService;
    initialize(client: Client): void;
    shutdown(): void;
    private onTeamCreated;
    private onTeamDeleted;
    private onMemberAdded;
    private onMemberRemoved;
    createTeamChannels(organizationId: string, teamId: string, guildId: string, teamNameRaw: string, createdBy: string): Promise<TeamDiscordChannel | null>;
    deleteTeamChannels(organizationId: string, teamId: string): Promise<void>;
    addMemberToTeamChannels(organizationId: string, teamId: string, userId: string, memberRole?: string): Promise<void>;
    removeMemberFromTeamChannels(organizationId: string, teamId: string, userId: string): Promise<void>;
    getTeamChannelsByOrg(organizationId: string): Promise<TeamDiscordChannel[]>;
    getTeamChannel(organizationId: string, teamId: string): Promise<TeamDiscordChannel | null>;
    private buildCategoryPermissions;
    private buildVoicePermissions;
    private getTeamVoiceSettings;
    private resolveDiscordId;
    private deleteTeamChannelResources;
    private slugify;
}
//# sourceMappingURL=TeamVoiceService.d.ts.map