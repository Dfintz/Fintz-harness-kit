import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class ContactRequestController extends BaseController {
    private readonly contactService;
    private readonly permissionService;
    private readonly memberService;
    private readonly federationService;
    submitContactRequest: (req: AuthRequest, res: Response) => Promise<void>;
    getSentMessages: (req: AuthRequest, res: Response) => Promise<void>;
    getInboxMessage: (req: AuthRequest, res: Response) => Promise<void>;
    addSenderReply: (req: AuthRequest, res: Response) => Promise<void>;
    archiveMessage: (req: AuthRequest, res: Response) => Promise<void>;
    deleteMessage: (req: AuthRequest, res: Response) => Promise<void>;
    getUnreadCount: (req: AuthRequest, res: Response) => Promise<void>;
    getContactOptions: (req: AuthRequest, res: Response) => Promise<void>;
    getOrganizationContactRequests: (req: AuthRequest, res: Response) => Promise<void>;
    getOrganizationContactStats: (req: AuthRequest, res: Response) => Promise<void>;
    getOrganizationContactRequest: (req: AuthRequest, res: Response) => Promise<void>;
    updateOrganizationContactRequest: (req: AuthRequest, res: Response) => Promise<void>;
    deleteOrganizationContactRequest: (req: AuthRequest, res: Response) => Promise<void>;
    getAllianceContactRequests: (req: AuthRequest, res: Response) => Promise<void>;
    getAllianceContactStats: (req: AuthRequest, res: Response) => Promise<void>;
    getAllianceContactRequest: (req: AuthRequest, res: Response) => Promise<void>;
    updateAllianceContactRequest: (req: AuthRequest, res: Response) => Promise<void>;
    deleteAllianceContactRequest: (req: AuthRequest, res: Response) => Promise<void>;
    getOrganizationContactReplies: (req: AuthRequest, res: Response) => Promise<void>;
    addOrganizationReply: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=contactRequestController.d.ts.map