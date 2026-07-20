import { ContactRequest } from './ContactRequest';
import { User } from './User';
export declare class ContactRequestReply {
    id: string;
    contactRequestId: string;
    contactRequest?: ContactRequest;
    senderUserId: string;
    senderUser?: User;
    message: string;
    isOrgReply: boolean;
    createdAt: Date;
}
//# sourceMappingURL=ContactRequestReply.d.ts.map