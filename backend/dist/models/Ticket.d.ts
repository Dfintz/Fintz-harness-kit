import { TenantEntity } from './base/TenantEntity';
export declare enum TicketCategory {
    HR = "hr",
    RECRUITMENT = "recruitment",
    DIPLOMACY = "diplomacy",
    GENERAL = "general",
    SUPPORT = "support"
}
export declare enum TicketPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    URGENT = "urgent"
}
export declare enum TicketStatus {
    OPEN = "open",
    IN_PROGRESS = "in_progress",
    AWAITING_RESPONSE = "awaiting_response",
    ON_HOLD = "on_hold",
    RESOLVED = "resolved",
    CLOSED = "closed"
}
export declare enum TicketRecipientType {
    ORG_LEADERSHIP = "org_leadership",
    ORG_OFFICERS = "org_officers",
    TEAM_LEADER = "team_leader",
    ALLIANCE_COUNCIL = "alliance_council",
    HR_DEPARTMENT = "hr_department",
    RECRUITMENT = "recruitment",
    DIPLOMACY = "diplomacy",
    SPECIFIC_USER = "specific_user",
    PLATFORM_ADMIN = "platform_admin"
}
export interface TicketMessage {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: Date;
    isInternal: boolean;
    attachments?: string[];
}
export interface TicketAssignment {
    assigneeId: string;
    assigneeName: string;
    assignedAt: Date;
    assignedBy: string;
}
export interface TicketDiscordSettings {
    enabled: boolean;
    channelId?: string;
    threadId?: string;
    notifyOnUpdate: boolean;
    roleId?: string;
    webhookUrl?: string;
}
export declare class Ticket extends TenantEntity {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    creatorId: string;
    creatorName: string;
    creatorDiscordId?: string;
    creatorEmail?: string;
    recipientType?: TicketRecipientType;
    recipientId?: string;
    recipientName?: string;
    assigneeId?: string;
    assigneeName?: string;
    assignmentHistory: TicketAssignment[];
    messages: TicketMessage[];
    discordSettings?: TicketDiscordSettings;
    discordChannelId?: string;
    discordThreadId?: string;
    relatedRecruitmentId?: string;
    relatedDiplomacyId?: string;
    relatedApplicationId?: string;
    tags: string[];
    resolution?: string;
    resolvedAt?: Date;
    resolvedBy?: string;
    satisfactionRating?: number;
    feedback?: string;
    dueDate?: Date;
    slaBreached: boolean;
    firstResponseAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
    get isOpen(): boolean;
    get hasDiscordIntegration(): boolean;
    get responseTimeMs(): number | null;
}
//# sourceMappingURL=Ticket.d.ts.map