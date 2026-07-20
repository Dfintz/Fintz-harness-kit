import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class AttendanceController extends BaseController {
    private attendanceService;
    constructor();
    initializeAttendance: (req: Request, res: Response) => Promise<void>;
    confirmAttendance: (req: Request, res: Response) => Promise<void>;
    recordAttendance: (req: Request, res: Response) => Promise<void>;
    markNoShow: (req: Request, res: Response) => Promise<void>;
    sendConfirmationRequests: (req: Request, res: Response) => Promise<void>;
    getAttendanceStats: (req: Request, res: Response) => Promise<void>;
    getUserHistory: (req: Request, res: Response) => Promise<void>;
    getAttendanceReport: (req: Request, res: Response) => Promise<void>;
    getLeaderboard: (req: Request, res: Response) => Promise<void>;
    addRating: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=attendanceController.d.ts.map