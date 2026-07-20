import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class RsiSyncScheduleController extends BaseController {
    getSchedule: (req: AuthRequest, res: Response) => Promise<void>;
    upsertSchedule: (req: AuthRequest, res: Response) => Promise<void>;
    enableSchedule: (req: AuthRequest, res: Response) => Promise<void>;
    disableSchedule: (req: AuthRequest, res: Response) => Promise<void>;
    deleteSchedule: (req: AuthRequest, res: Response) => Promise<void>;
    getAuditLogs: (req: AuthRequest, res: Response) => Promise<void>;
    getAuditStats: (req: AuthRequest, res: Response) => Promise<void>;
    getAuditLogById: (req: AuthRequest, res: Response) => Promise<void>;
    triggerManualSync: (req: AuthRequest, res: Response) => Promise<void>;
    listMembers: (req: AuthRequest, res: Response) => Promise<void>;
    manualAssign: (req: AuthRequest, res: Response) => Promise<void>;
    manualVerify: (req: AuthRequest, res: Response) => Promise<void>;
    removeMember: (req: AuthRequest, res: Response) => Promise<void>;
    bulkVerify: (req: AuthRequest, res: Response) => Promise<void>;
    bulkAssign: (req: AuthRequest, res: Response) => Promise<void>;
    getReviewQueue: (req: AuthRequest, res: Response) => Promise<void>;
    resolveReviewItem: (req: AuthRequest, res: Response) => Promise<void>;
    getReviewStats: (req: AuthRequest, res: Response) => Promise<void>;
    flagForReview: (req: AuthRequest, res: Response) => Promise<void>;
    private verifyOrgAccess;
}
//# sourceMappingURL=rsiSyncScheduleController.d.ts.map