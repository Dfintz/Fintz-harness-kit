import { Ticket, TicketCategory, TicketDiscordSettings, TicketPriority, TicketRecipientType, TicketStatus } from '../../../models/Ticket';
export interface CreateTicketDTO {
    subject: string;
    description: string;
    category: TicketCategory;
    priority?: TicketPriority;
    creatorId: string;
    creatorName: string;
    creatorDiscordId?: string;
    creatorEmail?: string;
    recipientType: TicketRecipientType;
    recipientId?: string;
    recipientName?: string;
    tags?: string[];
    relatedRecruitmentId?: string;
    relatedDiplomacyId?: string;
    relatedApplicationId?: string;
    discordSettings?: TicketDiscordSettings;
}
export interface UpdateTicketDTO {
    subject?: string;
    description?: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    status?: TicketStatus;
    assigneeId?: string;
    assigneeName?: string;
    tags?: string[];
    dueDate?: Date;
}
export interface TicketFilters {
    category?: TicketCategory;
    status?: TicketStatus | TicketStatus[];
    priority?: TicketPriority;
    assigneeId?: string;
    creatorId?: string;
    creatorDiscordId?: string;
    searchTerm?: string;
    tags?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    isOpen?: boolean;
    visibleToUserId?: string;
    visibleToRecipientTypes?: TicketRecipientType[];
    visibleToDiscordId?: string;
}
export interface AddMessageDTO {
    authorId: string;
    authorName: string;
    content: string;
    isInternal?: boolean;
    attachments?: string[];
}
export interface ResolveTicketDTO {
    resolution: string;
    resolvedBy: string;
}
export declare class TicketService {
    private static instance;
    static getInstance(): TicketService;
    private readonly ticketRepository;
    private readonly discordSettingsRepository;
    private readonly supportWebhookUrl;
    private readonly supportInviteUrl;
    constructor();
    private generateTicketNumber;
    createTicket(organizationId: string, dto: CreateTicketDTO): Promise<Ticket>;
    private createTicketForAttempt;
    private postTechnicalTicketToSupportDiscord;
    private resolveSupportDiscordConfig;
    private selectPrimarySupportGuildSettings;
    private isDuplicateTicketError;
    private applyAutoRouting;
    private applyRoutingResultToTicket;
    private applyRoutingAssignment;
    getTicketById(id: string): Promise<Ticket | null>;
    getTicketByNumber(ticketNumber: string): Promise<Ticket | null>;
    updateTicket(id: string, dto: UpdateTicketDTO, updatedBy?: string): Promise<Ticket>;
    private buildStatusFilter;
    searchTickets(organizationId: string, filters: TicketFilters, page?: number, limit?: number): Promise<{
        tickets: Ticket[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    private buildBaseSearchWhere;
    private buildSearchWhereWithVisibility;
    private buildSearchWhereWithoutVisibility;
    addMessage(ticketId: string, dto: AddMessageDTO): Promise<Ticket>;
    assignTicket(ticketId: string, assigneeId: string, assigneeName: string, assignedBy: string): Promise<Ticket>;
    resolveTicket(ticketId: string, dto: ResolveTicketDTO): Promise<Ticket>;
    closeTicket(ticketId: string): Promise<Ticket>;
    reopenTicket(ticketId: string): Promise<Ticket>;
    addFeedback(ticketId: string, rating: number, feedback?: string): Promise<Ticket>;
    updateDiscordSettings(ticketId: string, settings: TicketDiscordSettings): Promise<Ticket>;
    getTicketByDiscordThread(threadId: string): Promise<Ticket | null>;
    getTicketStats(organizationId: string): Promise<{
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
        closed: number;
        byCategory: Record<TicketCategory, number>;
        byPriority: Record<TicketPriority, number>;
        averageResponseTimeMs: number | null;
        averageSatisfactionRating: number | null;
    }>;
    deleteTicket(ticketId: string): Promise<void>;
}
//# sourceMappingURL=TicketService.d.ts.map