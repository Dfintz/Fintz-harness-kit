import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TicketRecipientType } from '../models/Ticket';
import { BaseController } from './BaseController';
export declare function resolveVisibleRecipientTypesForOrgRole(roleName: string): TicketRecipientType[] | undefined;
export declare function canUserResolveTicket(ticket: {
    creatorId: string;
    assigneeId?: string;
}, user: AuthRequest['user']): boolean;
export declare class TicketController extends BaseController {
    private readonly ticketService;
    private readonly routingService;
    constructor();
    listTickets: (req: AuthRequest, res: Response) => Promise<void>;
    private getTicketListPagination;
    private buildTicketListFilters;
    private applyTicketListVisibility;
    createTicket: (req: AuthRequest, res: Response) => Promise<void>;
    getTicket: (req: AuthRequest, res: Response) => Promise<void>;
    getTicketByNumber: (req: AuthRequest, res: Response) => Promise<void>;
    updateTicket: (req: AuthRequest, res: Response) => Promise<void>;
    deleteTicket: (req: AuthRequest, res: Response) => Promise<void>;
    addMessage: (req: AuthRequest, res: Response) => Promise<void>;
    assignTicket: (req: AuthRequest, res: Response) => Promise<void>;
    resolveTicket: (req: AuthRequest, res: Response) => Promise<void>;
    closeTicket: (req: AuthRequest, res: Response) => Promise<void>;
    reopenTicket: (req: AuthRequest, res: Response) => Promise<void>;
    addFeedback: (req: AuthRequest, res: Response) => Promise<void>;
    getRoutingRules: (req: AuthRequest, res: Response) => Promise<void>;
    createRoutingRule: (req: AuthRequest, res: Response) => Promise<void>;
    updateRoutingRule: (req: AuthRequest, res: Response) => Promise<void>;
    deleteRoutingRule: (req: AuthRequest, res: Response) => Promise<void>;
    testRoutingRule: (req: AuthRequest, res: Response) => Promise<void>;
    getRoutingStats: (req: AuthRequest, res: Response) => Promise<void>;
    getStats: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=ticketController.d.ts.map