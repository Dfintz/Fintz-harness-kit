import { Organization } from './Organization';
import { User } from './User';
export declare enum InvitationStatus {
    PENDING = "pending",
    APPROVED = "approved",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    DECLINED = "declined",
    EXPIRED = "expired"
}
export declare class Invitation {
    id: string;
    organizationId: string;
    organization?: Organization;
    inviteeUserId: string;
    invitee?: User;
    inviterId: string | null;
    inviter?: User;
    inviterRole: string;
    status: InvitationStatus;
    message?: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Invitation.d.ts.map