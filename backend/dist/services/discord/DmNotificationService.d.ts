import { Client, EmbedBuilder } from 'discord.js';
export declare enum DmEventType {
    TICKET_CREATED = "ticket_created",
    TICKET_ASSIGNED = "ticket_assigned",
    TICKET_REPLIED = "ticket_replied",
    TICKET_CLOSED = "ticket_closed",
    TICKET_ESCALATED = "ticket_escalated",
    RECRUITMENT_RECEIVED = "recruitment_received",
    RECRUITMENT_ACCEPTED = "recruitment_accepted",
    RECRUITMENT_DENIED = "recruitment_denied",
    EVENT_REMINDER = "event_reminder",
    EVENT_CANCELLED = "event_cancelled",
    LFG_PLAYER_JOINED = "lfg_player_joined"
}
export interface DmNotificationPayload {
    eventType: DmEventType;
    recipientDiscordIds: string[];
    embed: EmbedBuilder;
    content?: string;
    guildId?: string;
}
export interface DmNotificationSettings {
    enabled: boolean;
    ticketCreatedNotify?: boolean;
    ticketAssignedNotify?: boolean;
    ticketRepliedNotify?: boolean;
    ticketClosedNotify?: boolean;
    ticketEscalatedNotify?: boolean;
    ticketTranscriptInDm?: boolean;
    recruitmentReceivedNotify?: boolean;
    recruitmentAcceptedNotify?: boolean;
    recruitmentDeniedNotify?: boolean;
    eventReminderNotify?: boolean;
    lfgJoinNotify?: boolean;
}
export declare const DEFAULT_DM_NOTIFICATION_SETTINGS: DmNotificationSettings;
export interface DmNotificationResult {
    sent: number;
    failed: number;
    errors: string[];
}
export interface DmRetryResult {
    expired: number;
    succeeded: number;
    rescheduled: number;
    dropped: number;
}
export declare class DmNotificationService {
    private static instance;
    private client;
    private shouldFailClosedOnPreferenceError;
    private filterRecipientsByPreference;
    private sendNotificationToRecipient;
    static getInstance(): DmNotificationService;
    initialize(client: Client): void;
    isEventEnabled(eventType: DmEventType, settings?: DmNotificationSettings): boolean;
    sendNotifications(payload: DmNotificationPayload): Promise<DmNotificationResult>;
    private getFailedRepo;
    private persistFailedDelivery;
    retryFailedDms(): Promise<DmRetryResult>;
    private processRetryRow;
    buildTicketCreatedEmbed(ticketNumber: string, subject: string, category: string): EmbedBuilder;
    buildTicketAssignedEmbed(ticketNumber: string, assigneeName: string): EmbedBuilder;
    buildTicketRepliedEmbed(ticketNumber: string, replierName: string, preview: string): EmbedBuilder;
    buildTicketClosedEmbed(ticketNumber: string, resolution?: string, transcriptUrl?: string): EmbedBuilder;
    buildTicketEscalatedEmbed(ticketNumber: string, reason?: string): EmbedBuilder;
    buildRecruitmentReceivedEmbed(applicantName: string, position?: string): EmbedBuilder;
    buildRecruitmentAcceptedEmbed(organizationName: string, position?: string): EmbedBuilder;
    buildRecruitmentDeniedEmbed(organizationName: string, reason?: string): EmbedBuilder;
    buildLfgJoinedEmbed(activity: string, playerName: string, currentPlayers: number, maxPlayers: number): EmbedBuilder;
}
//# sourceMappingURL=DmNotificationService.d.ts.map