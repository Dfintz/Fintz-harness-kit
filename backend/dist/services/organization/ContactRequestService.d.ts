import { ContactRequest, ContactRequestStatus, ContactTargetType, MessageVisibility } from '../../models/ContactRequest';
import { ContactRequestReply } from '../../models/ContactRequestReply';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface ContactRequestFilterOptions {
    status?: ContactRequestStatus;
    statuses?: ContactRequestStatus[];
    startDate?: Date;
    endDate?: Date;
    searchTerm?: string;
    viewerRole?: string;
}
export interface CreateContactRequestInput {
    targetType: ContactTargetType;
    organizationId?: string;
    allianceId?: string;
    senderUserId?: string;
    senderName: string;
    senderEmail?: string;
    rsiHandle?: string;
    discordUsername?: string;
    subject: string;
    message: string;
    contactType?: string;
    visibility?: MessageVisibility;
    visibleToRoles?: string[];
    senderIp?: string;
    userAgent?: string;
}
export interface UpdateContactRequestInput {
    status?: ContactRequestStatus;
    internalNotes?: string;
}
export interface ContactRequestListItem {
    id: string;
    targetType: ContactTargetType;
    organizationId?: string;
    organizationName?: string;
    allianceId?: string;
    allianceName?: string;
    senderUserId?: string;
    senderName: string;
    senderEmail?: string;
    rsiHandle?: string;
    discordUsername?: string;
    subject: string;
    message: string;
    contactType: string;
    status: ContactRequestStatus;
    internalNotes?: string;
    handledBy?: string;
    handledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    replyCount?: number;
}
export interface ContactRequestReplyItem {
    id: string;
    contactRequestId: string;
    senderUserId: string;
    senderUsername?: string;
    message: string;
    isOrgReply: boolean;
    createdAt: Date;
}
export interface CreateContactRequestReplyInput {
    contactRequestId: string;
    senderUserId: string;
    message: string;
    isOrgReply: boolean;
}
export interface ContactRequestStats {
    total: number;
    pending: number;
    read: number;
    replied: number;
    archived: number;
    spam: number;
    lastWeek: number;
}
export declare class ContactRequestService {
    private readonly contactRepository;
    private readonly replyRepository;
    private readonly profileRepository;
    private readonly organizationRepository;
    private readonly federationRepository;
    private readonly federationService;
    constructor();
    submitContactRequest(input: CreateContactRequestInput): Promise<ContactRequest>;
    getOrganizationContactRequests(organizationId: string, filters?: ContactRequestFilterOptions, pagination?: PaginationOptions): Promise<PaginatedResponse<ContactRequestListItem>>;
    getAllianceContactRequests(allianceId: string, filters?: ContactRequestFilterOptions, pagination?: PaginationOptions): Promise<PaginatedResponse<ContactRequestListItem>>;
    private getContactRequests;
    getOrganizationContactRequest(requestId: string, organizationId: string): Promise<ContactRequestListItem | null>;
    getAllianceContactRequest(requestId: string, allianceId: string): Promise<ContactRequestListItem | null>;
    private getContactRequest;
    updateOrganizationContactRequest(requestId: string, organizationId: string, input: UpdateContactRequestInput, userId: string): Promise<ContactRequest | null>;
    updateAllianceContactRequest(requestId: string, allianceId: string, input: UpdateContactRequestInput, userId: string): Promise<ContactRequest | null>;
    private updateContactRequest;
    markOrganizationRequestAsRead(requestId: string, organizationId: string, userId: string): Promise<ContactRequest | null>;
    markAllianceRequestAsRead(requestId: string, allianceId: string, userId: string): Promise<ContactRequest | null>;
    markOrganizationRequestAsReplied(requestId: string, organizationId: string, userId: string): Promise<ContactRequest | null>;
    markAllianceRequestAsReplied(requestId: string, allianceId: string, userId: string): Promise<ContactRequest | null>;
    archiveOrganizationRequest(requestId: string, organizationId: string, userId: string): Promise<ContactRequest | null>;
    archiveAllianceRequest(requestId: string, allianceId: string, userId: string): Promise<ContactRequest | null>;
    markOrganizationRequestAsSpam(requestId: string, organizationId: string, userId: string): Promise<ContactRequest | null>;
    markAllianceRequestAsSpam(requestId: string, allianceId: string, userId: string): Promise<ContactRequest | null>;
    deleteOrganizationContactRequest(requestId: string, organizationId: string): Promise<boolean>;
    deleteAllianceContactRequest(requestId: string, allianceId: string): Promise<boolean>;
    getOrganizationContactRequestStats(organizationId: string): Promise<ContactRequestStats>;
    getAllianceContactRequestStats(allianceId: string): Promise<ContactRequestStats>;
    private getContactRequestStats;
    getOrganizationPendingCount(organizationId: string): Promise<number>;
    getAlliancePendingCount(allianceId: string): Promise<number>;
    getContactTypeOptions(): string[];
    getStatusOptions(): ContactRequestStatus[];
    getTargetTypeOptions(): ContactTargetType[];
    getUserSentMessages(userId: string, pagination?: PaginationOptions): Promise<PaginatedResponse<ContactRequestListItem>>;
    archiveUserMessage(requestId: string, userId: string): Promise<boolean>;
    deleteUserMessage(requestId: string, userId: string): Promise<boolean>;
    getUserContactRequest(requestId: string, userId: string): Promise<(ContactRequestListItem & {
        organizationName?: string;
        allianceName?: string;
    }) | null>;
    addReply(input: CreateContactRequestReplyInput): Promise<ContactRequestReply>;
    getReplies(contactRequestId: string): Promise<ContactRequestReplyItem[]>;
    getUserInboxUnreadCount(userId: string, organizationId?: string): Promise<number>;
}
//# sourceMappingURL=ContactRequestService.d.ts.map