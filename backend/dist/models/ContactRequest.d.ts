import type { ContactRequestReply } from './ContactRequestReply';
import { Organization } from './Organization';
import { User } from './User';
export declare enum ContactRequestStatus {
    PENDING = "pending",
    READ = "read",
    REPLIED = "replied",
    ARCHIVED = "archived",
    SPAM = "spam"
}
export declare enum ContactTargetType {
    ORGANIZATION = "organization",
    ALLIANCE = "alliance"
}
export declare enum MessageVisibility {
    ALL = "all",
    LEADERSHIP = "leadership",
    HR = "hr",
    DIPLOMACY = "diplomacy",
    RECRUITMENT = "recruitment",
    CUSTOM = "custom"
}
export declare class ContactRequest {
    id: string;
    targetType: ContactTargetType;
    organizationId?: string;
    organization?: Organization;
    allianceId?: string;
    senderUserId?: string;
    senderUser?: User;
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
    senderIp?: string;
    userAgent?: string;
    visibility: MessageVisibility;
    visibleToRoles?: string[];
    createdAt: Date;
    updatedAt: Date;
    replies?: ContactRequestReply[];
}
//# sourceMappingURL=ContactRequest.d.ts.map