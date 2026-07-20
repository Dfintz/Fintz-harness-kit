export type FederationAnnouncementAudience = 'all-members' | 'council' | 'public';
export interface FederationAnnouncementData {
    id: string;
    federationId: string;
    title: string;
    content: string;
    targetAudience: FederationAnnouncementAudience;
    createdBy: string;
    createdByName: string | null;
    status: string;
    createdAt: Date;
    sentAt: Date | null;
    pinnedAt: Date | null;
}
export interface FederationAnnouncementDiscordPostResult {
    announcement: FederationAnnouncementData;
    guildId: string;
    channelId: string;
    messageId: string;
}
export declare class FederationAnnouncementService {
    private static instance;
    private readonly announcementRepository;
    private readonly federationRepository;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationAnnouncementService;
    private toData;
    private requireAnnouncePermission;
    private requireViewAccess;
    createAnnouncement(federationId: string, userId: string, data: {
        title: string;
        content: string;
        targetAudience?: FederationAnnouncementAudience;
        createdByName?: string;
    }): Promise<FederationAnnouncementData>;
    listAnnouncements(federationId: string, userId: string): Promise<FederationAnnouncementData[]>;
    getAnnouncement(federationId: string, userId: string, announcementId: string): Promise<FederationAnnouncementData>;
    deleteAnnouncement(federationId: string, userId: string, announcementId: string): Promise<void>;
    togglePin(federationId: string, userId: string, announcementId: string): Promise<FederationAnnouncementData>;
    postAnnouncementToDiscord(federationId: string, userId: string, announcementId: string, channelId: string): Promise<FederationAnnouncementDiscordPostResult>;
}
//# sourceMappingURL=FederationAnnouncementService.d.ts.map